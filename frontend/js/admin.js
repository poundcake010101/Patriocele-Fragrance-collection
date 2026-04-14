// ========== HELPERS ==========
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function fmt(amount) {
    return `R${parseFloat(amount || 0).toFixed(2)}`;
}

// ========== ADMIN MANAGER ==========
class AdminManager {
    constructor() {
        this.currentUser = null;
        this.products = [];
        this.orders = [];
        this.users = [];
        this.charts = {};
        this.init();
    }

    // ========== INIT & AUTH ==========
    async init() {
        await window.authManager.waitForAuth();
        if (!window.authManager.isUserLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }
        this.currentUser = window.authManager.getCurrentUser();

        const { data: userData, error } = await window.supabase
            .from('users')
            .select('is_admin')
            .eq('id', this.currentUser.id)
            .single();

        if (error || !userData?.is_admin) {
            alert('Access denied. Admin privileges required.');
            window.location.href = 'index.html';
            return;
        }

        this.setupEventListeners();
        this.loadDashboardData();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Add product button
        document.getElementById('add-product-btn')?.addEventListener('click', () => this.openProductModal());

        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Close modal on backdrop click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) this.closeAllModals();
        });

        // Product form submit
        document.getElementById('product-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        // Product filters
        document.getElementById('product-search')?.addEventListener('input', (e) => this.filterProducts(e.target.value));
        document.getElementById('product-status')?.addEventListener('change', () => this.loadProducts());

        // Order filters
        document.getElementById('order-status-filter')?.addEventListener('change', (e) => this.filterOrders(e.target.value));
        document.getElementById('order-date-from')?.addEventListener('change', () => this.filterOrdersByDate());
        document.getElementById('order-date-to')?.addEventListener('change', () => this.filterOrdersByDate());
    }

    switchTab(tabName) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        document.getElementById(`${tabName}-tab`)?.classList.add('active');

        switch (tabName) {
            case 'dashboard': this.loadDashboardData(); break;
            case 'products':  this.loadProducts(); break;
            case 'orders':    this.loadOrders(); break;
            case 'users':     this.loadUsers(); break;
            case 'analytics': this.loadAnalytics(); break;
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }

    // ========== DASHBOARD ==========
    async loadDashboardData() {
        try {
            // Revenue — sum all paid orders
            const { data: paidOrders, error: revErr } = await window.supabase
                .from('orders')
                .select('total_amount')
                .eq('payment_status', 'paid');

            if (!revErr && paidOrders) {
                const total = paidOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
                document.getElementById('total-revenue').textContent = fmt(total);
            }

            // Orders count
            const { count: orderCount } = await window.supabase
                .from('orders')
                .select('*', { count: 'exact', head: true });
            document.getElementById('total-orders').textContent = orderCount ?? 0;

            // Products count (active)
            const { count: productCount } = await window.supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);
            document.getElementById('total-products').textContent = productCount ?? 0;

            // Users count
            const { count: userCount } = await window.supabase
                .from('users')
                .select('*', { count: 'exact', head: true });
            document.getElementById('total-users').textContent = userCount ?? 0;

            await this.loadRecentOrders();
            await this.loadLowStockProducts();
        } catch (err) {
            console.error('Dashboard load error:', err);
        }
    }

    async loadRecentOrders() {
        const { data, error } = await window.supabase
            .from('orders')
            .select('id, status, total_amount, created_at, users(email, full_name)')
            .order('created_at', { ascending: false })
            .limit(5);

        const container = document.getElementById('recent-orders');
        if (error || !data?.length) {
            container.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;">No recent orders.</p>';
            return;
        }

        container.innerHTML = data.map(order => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0;border-bottom:1px solid var(--border);">
                <div>
                    <span style="font-size:0.88rem;font-weight:500;">Order #${order.id}</span>
                    <span style="display:block;font-size:0.75rem;color:var(--text-light);">${order.users?.full_name || order.users?.email || 'Customer'}</span>
                </div>
                <div style="text-align:right;">
                    <span class="status-badge status-${order.status}">${order.status}</span>
                    <span style="display:block;font-size:0.85rem;margin-top:0.25rem;">${fmt(order.total_amount)}</span>
                </div>
            </div>`).join('');
    }

    async loadLowStockProducts() {
        const { data, error } = await window.supabase
            .from('products')
            .select('name, stock_quantity')
            .eq('is_active', true)
            .lt('stock_quantity', 10)
            .order('stock_quantity', { ascending: true })
            .limit(6);

        const container = document.getElementById('low-stock');
        if (error || !data?.length) {
            container.innerHTML = '<p style="color:var(--accent-green);font-size:0.85rem;">All stock levels healthy.</p>';
            return;
        }

        container.innerHTML = data.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid var(--border);">
                <span style="font-size:0.88rem;">${escapeHtml(p.name)}</span>
                <span style="color:#c44;font-weight:500;font-size:0.85rem;">${p.stock_quantity} left</span>
            </div>`).join('');
    }

    // ========== PRODUCTS ==========
    async loadProducts() {
        let query = window.supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        const statusFilter = document.getElementById('product-status')?.value;
        if (statusFilter === 'active')   query = query.eq('is_active', true);
        if (statusFilter === 'inactive') query = query.eq('is_active', false);

        const { data, error } = await query;
        if (error) { console.error('Load products error:', error); return; }
        this.products = data || [];
        this.renderProductsTable(this.products);
    }

    renderProductsTable(products) {
        const tbody = document.getElementById('products-table-body');
        if (!products.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);">No products found.</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td>
                    <div style="display:flex;gap:0.75rem;align-items:center;">
                        <img src="${p.images?.[0] || 'https://via.placeholder.com/40?text=P'}" style="width:40px;height:40px;object-fit:cover;border-radius:2px;border:1px solid var(--border);">
                        <div>
                            <span style="font-weight:500;font-size:0.9rem;">${escapeHtml(p.name)}</span>
                            <span style="display:block;font-size:0.75rem;color:var(--text-light);">${escapeHtml((p.description || '').substring(0, 50))}${p.description?.length > 50 ? '…' : ''}</span>
                        </div>
                    </div>
                </td>
                <td style="font-size:0.9rem;">${fmt(p.price)}</td>
                <td>
                    <span style="font-weight:500;${p.stock_quantity < 10 ? 'color:#c44;' : ''}">${p.stock_quantity}</span>
                    ${p.stock_quantity < 10 ? '<span style="font-size:0.65rem;color:#c44;display:block;">Low stock</span>' : ''}
                </td>
                <td><span class="status-badge ${p.is_active ? 'status-confirmed' : 'status-cancelled'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style="white-space:nowrap;">
                    <button class="btn-outline btn-sm" data-id="${p.id}" data-action="edit" style="margin-right:0.4rem;">Edit</button>
                    <button class="btn-outline btn-sm btn-danger" data-id="${p.id}" data-active="${p.is_active}" data-action="toggle">${p.is_active ? 'Deactivate' : 'Activate'}</button>
                </td>
            </tr>`).join('');

        // Bind edit buttons
        tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => this.editProduct(Number(btn.dataset.id)));
        });

        // Bind toggle buttons
        tbody.querySelectorAll('[data-action="toggle"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const newStatus = btn.dataset.active === 'true' ? false : true;
                this.toggleProductStatus(Number(btn.dataset.id), newStatus);
            });
        });
    }

    filterProducts(term) {
        const t = term.toLowerCase();
        const filtered = this.products.filter(p =>
            p.name.toLowerCase().includes(t) ||
            (p.description || '').toLowerCase().includes(t)
        );
        this.renderProductsTable(filtered);
    }

    async editProduct(productId) {
        // Try local cache first, fallback to DB
        let product = this.products.find(p => p.id === productId);
        if (!product) {
            const { data, error } = await window.supabase.from('products').select('*').eq('id', productId).single();
            if (error || !data) { alert('Product not found.'); return; }
            product = data;
        }
        this.openProductModal(product);
    }

    openProductModal(product = null) {
        const modal = document.getElementById('product-modal');
        document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add New Product';

        if (product) {
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name || '';
            document.getElementById('product-price').value = product.price || '';
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-stock').value = product.stock_quantity || 0;
            document.getElementById('product-intensity').value = product.intensity || 'EDP';
            document.getElementById('product-occasion').value = (product.occasion || []).join(', ');
            document.getElementById('product-images').value = (product.images || []).join('\n');
            document.getElementById('product-active').checked = product.is_active !== false;
        } else {
            document.getElementById('product-form').reset();
            document.getElementById('product-id').value = '';
            document.getElementById('product-active').checked = true;
        }

        modal.style.display = 'block';
    }

    async saveProduct() {
        const productId = document.getElementById('product-id').value;

        const productData = {
            name:           document.getElementById('product-name').value.trim(),
            description:    document.getElementById('product-description').value.trim(),
            price:          parseFloat(document.getElementById('product-price').value),
            stock_quantity: parseInt(document.getElementById('product-stock').value, 10),
            intensity:      document.getElementById('product-intensity').value,
            occasion:       document.getElementById('product-occasion').value.split(',').map(s => s.trim()).filter(Boolean),
            images:         document.getElementById('product-images').value.split('\n').map(s => s.trim()).filter(Boolean),
            is_active:      document.getElementById('product-active').checked,
        };

        if (!productData.name) { alert('Product name is required.'); return; }
        if (isNaN(productData.price)) { alert('Enter a valid price.'); return; }

        try {
            let error;
            if (productId) {
                ({ error } = await window.supabase.from('products').update(productData).eq('id', productId));
            } else {
                ({ error } = await window.supabase.from('products').insert([productData]));
            }
            if (error) throw error;

            this.closeAllModals();
            await this.loadProducts();
            // Refresh dashboard counts
            const { count } = await window.supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true);
            document.getElementById('total-products').textContent = count ?? 0;
        } catch (err) {
            console.error('Save product error:', err);
            alert('Error saving product: ' + err.message);
        }
    }

    async toggleProductStatus(productId, newStatus) {
        const { error } = await window.supabase.from('products').update({ is_active: newStatus }).eq('id', productId);
        if (error) { alert('Error updating product: ' + error.message); return; }
        await this.loadProducts();
    }

    // Stock adjustment helper (called if you add +/- controls later)
    async adjustStock(productId, delta) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        const newQty = Math.max(0, product.stock_quantity + delta);
        const { error } = await window.supabase.from('products').update({ stock_quantity: newQty }).eq('id', productId);
        if (error) { console.error(error); return; }
        await this.loadProducts();
        await this.loadLowStockProducts();
    }

    // ========== ORDERS ==========
    async loadOrders() {
        const { data, error } = await window.supabase
            .from('orders')
            .select('id, status, total_amount, created_at, users(email, full_name), order_items(quantity, products(name))')
            .order('created_at', { ascending: false });

        if (error) { console.error(error); return; }
        this.orders = data || [];
        this.renderOrdersTable(this.orders);
    }

    renderOrdersTable(orders) {
        const tbody = document.getElementById('orders-table-body');
        if (!orders.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);">No orders found.</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td style="font-size:0.85rem;font-weight:500;">#${o.id}</td>
                <td>
                    <span style="font-size:0.9rem;">${escapeHtml(o.users?.full_name || 'Customer')}</span>
                    <span style="display:block;font-size:0.75rem;color:var(--text-light);">${escapeHtml(o.users?.email || '')}</span>
                </td>
                <td style="font-size:0.85rem;">${new Date(o.created_at).toLocaleDateString('en-ZA')}</td>
                <td style="font-size:0.9rem;font-weight:500;">${fmt(o.total_amount)}</td>
                <td>
                    <select class="status-select" data-order-id="${o.id}">
                        ${['pending','confirmed','shipped','delivered','cancelled'].map(s =>
                            `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
                        ).join('')}
                    </select>
                </td>
                <td><button class="btn-outline btn-sm" data-order-id="${o.id}" data-action="view">View</button></td>
            </tr>`).join('');

        // Bind status selects
        tbody.querySelectorAll('.status-select').forEach(sel => {
            sel.addEventListener('change', () => this.updateOrderStatus(Number(sel.dataset.orderId), sel.value));
        });

        // Bind view buttons
        tbody.querySelectorAll('[data-action="view"]').forEach(btn => {
            btn.addEventListener('click', () => this.viewOrder(Number(btn.dataset.orderId)));
        });
    }

    async updateOrderStatus(orderId, newStatus) {
        const { error } = await window.supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
        if (error) { alert('Error updating status: ' + error.message); return; }
        // Update local cache
        const order = this.orders.find(o => o.id === orderId);
        if (order) order.status = newStatus;
    }

    filterOrders(status) {
        const filtered = status ? this.orders.filter(o => o.status === status) : this.orders;
        this.renderOrdersTable(filtered);
    }

    filterOrdersByDate() {
        const from = document.getElementById('order-date-from')?.value;
        const to   = document.getElementById('order-date-to')?.value;
        let filtered = [...this.orders];
        if (from) filtered = filtered.filter(o => new Date(o.created_at) >= new Date(from));
        if (to)   { const end = new Date(to); end.setHours(23,59,59,999); filtered = filtered.filter(o => new Date(o.created_at) <= end); }
        this.renderOrdersTable(filtered);
    }

    viewOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        const items = (order.order_items || []).map(i => `${i.quantity}x ${i.products?.name || 'Item'}`).join(', ') || 'No items';
        alert(`Order #${orderId}\nCustomer: ${order.users?.full_name || order.users?.email}\nStatus: ${order.status}\nTotal: ${fmt(order.total_amount)}\nItems: ${items}`);
    }

    // ========== USERS ==========
    async loadUsers() {
        const { data, error } = await window.supabase
            .from('users')
            .select('id, email, full_name, is_admin, created_at, orders(id)')
            .order('created_at', { ascending: false });

        if (error) { console.error(error); return; }
        this.users = data || [];
        this.renderUsersTable();
    }

    renderUsersTable() {
        const tbody = document.getElementById('users-table-body');
        if (!this.users.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-light);">No users found.</td></tr>';
            return;
        }

        tbody.innerHTML = this.users.map(u => `
            <tr>
                <td style="font-size:0.75rem;color:var(--text-light);">${u.id.substring(0,8)}…</td>
                <td style="font-size:0.85rem;">${escapeHtml(u.email)}</td>
                <td style="font-size:0.85rem;">${escapeHtml(u.full_name || '—')}</td>
                <td style="font-size:0.82rem;">${new Date(u.created_at).toLocaleDateString('en-ZA')}</td>
                <td style="font-size:0.85rem;">${u.orders?.length ?? 0}</td>
                <td><span class="status-badge ${u.is_admin ? 'status-delivered' : 'status-pending'}">${u.is_admin ? 'Admin' : 'User'}</span></td>
                <td>
                    <button class="btn-outline btn-sm" data-uid="${u.id}" data-make="${!u.is_admin}">
                        ${u.is_admin ? 'Remove Admin' : 'Make Admin'}
                    </button>
                </td>
            </tr>`).join('');

        tbody.querySelectorAll('[data-uid]').forEach(btn => {
            btn.addEventListener('click', () => this.toggleAdmin(btn.dataset.uid, btn.dataset.make === 'true'));
        });
    }

    async toggleAdmin(userId, makeAdmin) {
        const { error } = await window.supabase.from('users').update({ is_admin: makeAdmin }).eq('id', userId);
        if (error) { alert('Error: ' + error.message); return; }
        await this.loadUsers();
    }

    // ========== ANALYTICS ==========
    async loadAnalytics() {
        await this.loadChartLibs();
        await this.buildAnalyticsDashboard();
    }

    async loadChartLibs() {
        if (typeof Chart === 'undefined') {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
                s.onload = resolve; s.onerror = reject;
                document.head.appendChild(s);
            });
        }
        if (typeof XLSX === 'undefined') {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
                s.onload = resolve; s.onerror = reject;
                document.head.appendChild(s);
            });
        }
    }

    async buildAnalyticsDashboard() {
        // Destroy any existing charts
        Object.values(this.charts).forEach(c => { try { c.destroy(); } catch(e){} });
        this.charts = {};

        const [kpis, salesData, statusData, topData] = await Promise.all([
            this.getKPIs(),
            this.getSalesTimeSeries(),
            this.getOrderStatusDistribution(),
            this.getTopProductsData(),
        ]);

        const forecast = this.calculateForecast(salesData);
        const totalForecast = forecast.forecastValues.reduce((a, b) => a + b, 0);

        // Render into sales-chart container (full width)
        const container = document.getElementById('sales-chart');
        container.style.gridColumn = '1 / -1'; // span full analytics grid

        // Replace top-products panel too
        const topContainer = document.getElementById('top-products');

        // KPI cards
        container.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem;">
                ${this.kpiCard('30-Day Revenue', fmt(kpis.totalRevenue))}
                ${this.kpiCard('Paid Orders (30d)', kpis.orderCount)}
                ${this.kpiCard('Avg Order Value', fmt(kpis.avgOrderValue))}
                ${this.kpiCard('Total Products', kpis.totalProducts ?? 0)}
                ${this.kpiCard('All-Time Orders', kpis.totalOrdersAll ?? 0)}
            </div>

            <div style="display:grid;grid-template-columns:2fr 1fr;gap:1.5rem;margin-bottom:1.5rem;">
                <div style="background:var(--white);border:1px solid var(--border);border-radius:4px;padding:1.5rem;">
                    <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:400;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border);">Sales Trend — Last 30 Days</div>
                    <canvas id="salesTrendChart" height="110"></canvas>
                </div>
                <div style="background:var(--white);border:1px solid var(--border);border-radius:4px;padding:1.5rem;">
                    <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:400;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border);">Order Status</div>
                    <canvas id="orderStatusChart" height="140"></canvas>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:2fr 1fr;gap:1.5rem;margin-bottom:1.5rem;">
                <div style="background:var(--white);border:1px solid var(--border);border-radius:4px;padding:1.5rem;">
                    <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:400;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border);">Top 5 Products by Units Sold (90 days)</div>
                    <canvas id="topProductsChart" height="110"></canvas>
                </div>
                <div style="background:var(--white);border:1px solid var(--border);border-radius:4px;padding:1.5rem;">
                    <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:400;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border);">7-Day Sales Forecast</div>
                    <canvas id="forecastChart" height="140"></canvas>
                    <div style="margin-top:0.75rem;font-size:0.8rem;color:var(--text-mid);line-height:1.6;">
                        Projected 7-day revenue: <strong style="color:var(--primary);">${fmt(totalForecast)}</strong><br>
                        <span style="font-size:0.72rem;color:var(--text-light);">Linear regression on last 14 days.</span>
                    </div>
                </div>
            </div>

            <div style="background:var(--white);border:1px solid var(--border);border-radius:4px;padding:1.5rem;margin-bottom:1.5rem;">
                <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:400;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border);">Prescriptive Insights</div>
                <div id="prescriptiveInsights"></div>
            </div>

            <div style="text-align:right;">
                <button id="exportExcelBtn" class="btn-primary" style="background:var(--dark);color:var(--gold);">Download Excel Report</button>
            </div>
        `;

        // Clear the separate top-products panel (now embedded above)
        topContainer.innerHTML = '<p style="font-size:0.82rem;color:var(--text-light);">See analytics charts above.</p>';

        // Render all charts
        this.renderSalesTrendChart(salesData);
        this.renderOrderStatusChart(statusData);
        this.renderTopProductsChart(topData);
        this.renderForecastChart(forecast);
        await this.renderPrescriptiveInsights(salesData, topData, statusData);

        document.getElementById('exportExcelBtn')?.addEventListener('click', () => this.exportToExcel());
    }

    kpiCard(label, value) {
        return `
            <div style="background:var(--cream);border:1px solid var(--border);border-top:2px solid var(--gold);border-radius:4px;padding:1rem;">
                <div style="font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-light);margin-bottom:0.4rem;">${label}</div>
                <div style="font-family:'Cormorant Garamond',serif;font-size:1.7rem;font-weight:400;color:var(--primary);">${value}</div>
            </div>`;
    }

    async getKPIs() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString();

        const { data: paidOrders } = await window.supabase
            .from('orders')
            .select('total_amount')
            .eq('payment_status', 'paid')
            .gte('created_at', thirtyDaysAgo);

        const totalRevenue = (paidOrders || []).reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
        const orderCount = paidOrders?.length || 0;
        const avgOrderValue = orderCount ? totalRevenue / orderCount : 0;

        const { count: totalProducts } = await window.supabase.from('products').select('*', { count: 'exact', head: true });
        const { count: totalOrdersAll } = await window.supabase.from('orders').select('*', { count: 'exact', head: true });

        return { totalRevenue, orderCount, avgOrderValue, totalProducts, totalOrdersAll };
    }

    async getSalesTimeSeries() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString();
        const { data } = await window.supabase
            .from('orders')
            .select('created_at, total_amount')
            .eq('payment_status', 'paid')
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: true });

        if (!data?.length) return { dates: [], amounts: [] };

        const daily = {};
        data.forEach(o => {
            const d = o.created_at.slice(0, 10);
            daily[d] = (daily[d] || 0) + parseFloat(o.total_amount || 0);
        });

        const dates   = Object.keys(daily).sort();
        const amounts = dates.map(d => parseFloat(daily[d].toFixed(2)));
        return { dates, amounts };
    }

    renderSalesTrendChart(salesData) {
        const ctx = document.getElementById('salesTrendChart')?.getContext('2d');
        if (!ctx) return;
        this.charts.salesTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: salesData.dates.map(d => d.slice(5)),
                datasets: [{
                    label: 'Daily Sales (R)',
                    data: salesData.amounts,
                    borderColor: '#8B7355',
                    backgroundColor: 'rgba(139,115,85,0.08)',
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.35,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { ticks: { callback: v => `R${v}` }, grid: { color: 'rgba(0,0,0,0.04)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    async getOrderStatusDistribution() {
        const { data } = await window.supabase.from('orders').select('status');
        if (!data?.length) return {};
        const counts = {};
        data.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
        return counts;
    }

    renderOrderStatusChart(statusData) {
        const ctx = document.getElementById('orderStatusChart')?.getContext('2d');
        if (!ctx) return;
        const labels = Object.keys(statusData);
        if (!labels.length) return;
        this.charts.orderStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: Object.values(statusData),
                    backgroundColor: ['#D4AF37','#8B7355','#7A9B76','#4a6fa5','#c44'],
                    borderWidth: 2,
                    borderColor: '#FAF7F2',
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
            }
        });
    }

    async getTopProductsData() {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 864e5).toISOString();
        const { data } = await window.supabase
            .from('order_items')
            .select('quantity, products(name)')
            .gte('created_at', ninetyDaysAgo);

        if (!data?.length) return { names: [], quantities: [] };

        const qty = {};
        data.forEach(item => {
            const name = item.products?.name;
            if (name) qty[name] = (qty[name] || 0) + (item.quantity || 1);
        });

        const sorted = Object.entries(qty).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return { names: sorted.map(p => p[0]), quantities: sorted.map(p => p[1]) };
    }

    renderTopProductsChart(data) {
        const ctx = document.getElementById('topProductsChart')?.getContext('2d');
        if (!ctx) return;
        if (!data.names.length) {
            ctx.canvas.parentElement.innerHTML += '<p style="font-size:0.82rem;color:var(--text-light);margin-top:0.5rem;">No order item data yet.</p>';
            return;
        }
        this.charts.topProducts = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.names,
                datasets: [{
                    label: 'Units Sold',
                    data: data.quantities,
                    backgroundColor: 'rgba(139,115,85,0.75)',
                    borderColor: '#8B7355',
                    borderWidth: 1,
                    borderRadius: 2,
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { stepSize: 1 } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    calculateForecast(salesData) {
        const amounts = salesData.amounts;
        if (amounts.length < 3) {
            return { forecastDays: [1,2,3,4,5,6,7], forecastValues: Array(7).fill(0) };
        }
        const recent = amounts.slice(-Math.min(14, amounts.length));
        const n = recent.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const sumX  = x.reduce((a, b) => a + b, 0);
        const sumY  = recent.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, b, i) => a + b * recent[i], 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);
        const denom = n * sumX2 - sumX * sumX;
        const slope     = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
        const intercept = (sumY - slope * sumX) / n;
        const forecastValues = [1,2,3,4,5,6,7].map(d =>
            parseFloat(Math.max(0, intercept + slope * (n + d)).toFixed(2))
        );
        return { forecastDays: [1,2,3,4,5,6,7], forecastValues };
    }

    renderForecastChart(forecast) {
        const ctx = document.getElementById('forecastChart')?.getContext('2d');
        if (!ctx) return;
        this.charts.forecast = new Chart(ctx, {
            type: 'line',
            data: {
                labels: forecast.forecastDays.map(d => `Day +${d}`),
                datasets: [{
                    label: 'Forecast (R)',
                    data: forecast.forecastValues,
                    borderColor: '#D4AF37',
                    backgroundColor: 'rgba(212,175,55,0.08)',
                    borderDash: [5, 4],
                    borderWidth: 2,
                    pointRadius: 4,
                    tension: 0.2,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: c => fmt(c.raw) } }
                },
                scales: {
                    y: { ticks: { callback: v => `R${v}` }, grid: { color: 'rgba(0,0,0,0.04)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    async renderPrescriptiveInsights(salesData, topData, statusData) {
        const { data: lowStock } = await window.supabase
            .from('products')
            .select('name, stock_quantity')
            .lt('stock_quantity', 10)
            .eq('is_active', true);

        const insights = [];

        // Low stock
        if (lowStock?.length) {
            insights.push(`<strong>Restock needed:</strong> ${lowStock.map(p => `${escapeHtml(p.name)} (${p.stock_quantity} left)`).join(', ')}.`);
        } else {
            insights.push('All product stock levels are healthy.');
        }

        // Cancellation rate
        const total = Object.values(statusData).reduce((a, b) => a + b, 0);
        const cancelled = statusData.cancelled || 0;
        if (total > 0) {
            const rate = ((cancelled / total) * 100).toFixed(1);
            if (parseFloat(rate) > 10) {
                insights.push(`<strong>High cancellation rate (${rate}%)</strong> — review your payment or fulfilment process.`);
            } else {
                insights.push(`Cancellation rate is healthy at ${rate}%.`);
            }
        }

        // Best seller promo
        if (topData.names[0]) {
            insights.push(`Consider promoting <strong>"${escapeHtml(topData.names[0])}"</strong> — your best-selling product.`);
        }

        // Peak day
        const peakDay = this.getPeakDay(salesData);
        insights.push(`Sales peak on <strong>${peakDay}</strong>s — ideal day for campaigns or flash deals.`);

        const el = document.getElementById('prescriptiveInsights');
        if (el) el.innerHTML = `<ul style="padding-left:1.2rem;line-height:2;">${insights.map(i => `<li style="font-size:0.88rem;">${i}</li>`).join('')}</ul>`;
    }

    getPeakDay(salesData) {
        if (!salesData.dates.length) return 'Friday';
        const daySums = {};
        salesData.dates.forEach((d, i) => {
            const day = new Date(d).toLocaleDateString('en', { weekday: 'long' });
            daySums[day] = (daySums[day] || 0) + salesData.amounts[i];
        });
        return Object.entries(daySums).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Friday';
    }

    // ========== EXCEL EXPORT ==========
    async exportToExcel() {
        try {
            const [{ data: orders }, { data: products }, { data: users }] = await Promise.all([
                window.supabase.from('orders').select('*'),
                window.supabase.from('products').select('*'),
                window.supabase.from('users').select('id, email, full_name, is_admin, created_at'),
            ]);
            const kpis = await this.getKPIs();
            const summary = [
                { Metric: '30-Day Revenue',      Value: fmt(kpis.totalRevenue) },
                { Metric: 'Paid Orders (30d)',    Value: kpis.orderCount },
                { Metric: 'Average Order Value',  Value: fmt(kpis.avgOrderValue) },
                { Metric: 'Total Products',       Value: kpis.totalProducts },
                { Metric: 'All-Time Orders',      Value: kpis.totalOrdersAll },
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orders || []),   'Orders');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products || []), 'Products');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(users || []),    'Users');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary),        'Analytics_Summary');
            XLSX.writeFile(wb, `patriocele_analytics_${new Date().toISOString().slice(0,10)}.xlsx`);
        } catch (err) {
            console.error('Export error:', err);
            alert('Export failed: ' + err.message);
        }
    }
}

// ========== INIT ==========
let adminManager;
document.addEventListener('DOMContentLoaded', () => {
    adminManager = new AdminManager();
});