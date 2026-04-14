class AdminManager {
    constructor() {
        this.currentUser = null;
        this.products = [];
        this.orders = [];
        this.users = [];
        this.currency = 'ZAR';
        this.charts = {}; // store Chart.js instances
        this.init();
    }

    // ========== ENHANCED ANALYTICS ==========
    async loadAnalytics() {
        await this.loadChartLibs();
        const container = document.getElementById('sales-chart');
        container.innerHTML = '';
        await this.buildAnalyticsDashboard();
    }

    async loadChartLibs() {
        if (typeof Chart === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        if (typeof XLSX === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
    }

    async buildAnalyticsDashboard() {
        const container = document.getElementById('sales-chart');
        const kpis = await this.getDescriptiveKPIs();
        const salesData = await this.getSalesTimeSeries();
        const orderStatusData = await this.getOrderStatusDistribution();
        const topProductsData = await this.getTopProductsData();
        const forecast = this.calculateForecast(salesData);

        const dashboardHtml = `
            <div class="analytics-full-dashboard">
                ${this.renderKPIcards(kpis)}
                <div class="analytics-row" style="display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 1.5rem 0;">
                    <div class="analytics-card" style="flex: 2; min-width: 300px;">
                        <h3>Sales Trend (Last 30 Days)</h3>
                        <canvas id="salesTrendChart" width="400" height="200"></canvas>
                    </div>
                    <div class="analytics-card" style="flex: 1; min-width: 250px;">
                        <h3>Order Status (Diagnostic)</h3>
                        <canvas id="orderStatusChart" width="200" height="200"></canvas>
                    </div>
                </div>
                <div class="analytics-row" style="display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 1.5rem 0;">
                    <div class="analytics-card" style="flex: 2;">
                        <h3>Top 5 Products by Quantity</h3>
                        <canvas id="topProductsChart" width="400" height="200"></canvas>
                    </div>
                    <div class="analytics-card" style="flex: 1;">
                        <h3>Predictive: Next 7 Days Sales Forecast</h3>
                        <canvas id="forecastChart" width="200" height="200"></canvas>
                        <div id="forecastInsight" style="font-size: 0.85rem; margin-top: 0.5rem;"></div>
                    </div>
                </div>
                <div class="analytics-row">
                    <div class="analytics-card">
                        <h3>Prescriptive Insights</h3>
                        <div id="prescriptiveInsights"></div>
                    </div>
                </div>
                <div style="margin-top: 1rem; text-align: right;">
                    <button id="exportExcelBtn" class="btn-primary" style="background: #2c5e2e;">📊 Download Excel Report</button>
                </div>
            </div>
        `;
        container.innerHTML = dashboardHtml;

        this.renderSalesTrendChart(salesData);
        this.renderOrderStatusChart(orderStatusData);
        this.renderTopProductsChart(topProductsData);
        this.renderForecastChart(forecast, salesData);
        await this.renderPrescriptiveInsights(salesData, topProductsData, orderStatusData);

        document.getElementById('exportExcelBtn')?.addEventListener('click', () => this.exportToExcel());
    }

    async getDescriptiveKPIs() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: paidOrders } = await window.supabase
            .from('orders')
            .select('total_amount, created_at')
            .eq('payment_status', 'paid')
            .gte('created_at', thirtyDaysAgo);
        const totalRevenue = paidOrders?.reduce((s, o) => s + parseFloat(o.total_amount), 0) || 0;
        const orderCount = paidOrders?.length || 0;
        const avgOrderValue = orderCount ? totalRevenue / orderCount : 0;
        const { count: totalProducts } = await window.supabase.from('products').select('*', { count: 'exact', head: true });
        const { count: totalOrdersAll } = await window.supabase.from('orders').select('*', { count: 'exact', head: true });
        return { totalRevenue, orderCount, avgOrderValue, totalProducts, totalOrdersAll };
    }

    renderKPIcards(kpis) {
        return `
            <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="kpi-card" style="background:#f9f5f0; padding:1rem; border-radius:8px;">
                    <div style="font-size:0.8rem;">30‑Day Revenue</div>
                    <div style="font-size:1.8rem; font-weight:bold;">R${kpis.totalRevenue.toFixed(2)}</div>
                </div>
                <div class="kpi-card" style="background:#f9f5f0; padding:1rem; border-radius:8px;">
                    <div style="font-size:0.8rem;">Paid Orders (30d)</div>
                    <div style="font-size:1.8rem; font-weight:bold;">${kpis.orderCount}</div>
                </div>
                <div class="kpi-card" style="background:#f9f5f0; padding:1rem; border-radius:8px;">
                    <div style="font-size:0.8rem;">Average Order Value</div>
                    <div style="font-size:1.8rem; font-weight:bold;">R${kpis.avgOrderValue.toFixed(2)}</div>
                </div>
                <div class="kpi-card" style="background:#f9f5f0; padding:1rem; border-radius:8px;">
                    <div style="font-size:0.8rem;">Total Products</div>
                    <div style="font-size:1.8rem; font-weight:bold;">${kpis.totalProducts}</div>
                </div>
                <div class="kpi-card" style="background:#f9f5f0; padding:1rem; border-radius:8px;">
                    <div style="font-size:0.8rem;">All Time Orders</div>
                    <div style="font-size:1.8rem; font-weight:bold;">${kpis.totalOrdersAll}</div>
                </div>
            </div>
        `;
    }

    async getSalesTimeSeries() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await window.supabase
            .from('orders')
            .select('created_at, total_amount')
            .eq('payment_status', 'paid')
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: true });
        if (!data) return { dates: [], amounts: [] };
        const daily = {};
        data.forEach(order => {
            const date = new Date(order.created_at).toISOString().split('T')[0];
            daily[date] = (daily[date] || 0) + parseFloat(order.total_amount);
        });
        const dates = Object.keys(daily).sort();
        const amounts = dates.map(d => daily[d]);
        return { dates, amounts };
    }

    renderSalesTrendChart(salesData) {
        const ctx = document.getElementById('salesTrendChart')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.salesTrend) this.charts.salesTrend.destroy();
        this.charts.salesTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: salesData.dates.map(d => d.slice(5)),
                datasets: [{
                    label: 'Daily Sales (R)',
                    data: salesData.amounts,
                    borderColor: '#c5a059',
                    backgroundColor: 'rgba(197,160,89,0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }

    async getOrderStatusDistribution() {
        const { data } = await window.supabase.from('orders').select('status');
        if (!data) return {};
        const counts = {};
        data.forEach(order => { counts[order.status] = (counts[order.status] || 0) + 1; });
        return counts;
    }

    renderOrderStatusChart(statusData) {
        const ctx = document.getElementById('orderStatusChart')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.orderStatus) this.charts.orderStatus.destroy();
        this.charts.orderStatus = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(statusData),
                datasets: [{
                    data: Object.values(statusData),
                    backgroundColor: ['#c5a059', '#4a6fa5', '#6c757d', '#28a745', '#dc3545']
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    async getTopProductsData() {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await window.supabase
            .from('order_items')
            .select(`quantity, products(name)`)
            .gte('created_at', ninetyDaysAgo);
        if (!data) return { names: [], quantities: [] };
        const productQty = {};
        data.forEach(item => {
            const name = item.products?.name;
            if (name) productQty[name] = (productQty[name] || 0) + item.quantity;
        });
        const sorted = Object.entries(productQty).sort((a,b) => b[1] - a[1]).slice(0,5);
        return { names: sorted.map(p => p[0]), quantities: sorted.map(p => p[1]) };
    }

    renderTopProductsChart(productsData) {
        const ctx = document.getElementById('topProductsChart')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.topProducts) this.charts.topProducts.destroy();
        this.charts.topProducts = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: productsData.names,
                datasets: [{
                    label: 'Units Sold (last 90 days)',
                    data: productsData.quantities,
                    backgroundColor: '#c5a059'
                }]
            },
            options: { responsive: true, indexAxis: 'y' }
        });
    }

    calculateForecast(salesData) {
        const amounts = salesData.amounts;
        if (amounts.length < 7) return { forecastDays: [1,2,3,4,5,6,7], forecastValues: Array(7).fill(0) };
        const recent = amounts.slice(-14);
        const x = Array.from({ length: recent.length }, (_, i) => i);
        const n = recent.length;
        const sumX = x.reduce((a,b) => a+b, 0);
        const sumY = recent.reduce((a,b) => a+b, 0);
        const sumXY = x.reduce((a,b,i) => a + b * recent[i], 0);
        const sumX2 = x.reduce((a,b) => a + b*b, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        const forecastDays = [1,2,3,4,5,6,7];
        const forecastValues = forecastDays.map(day => Math.max(0, intercept + slope * (recent.length + day)));
        return { forecastDays, forecastValues };
    }

    renderForecastChart(forecast, salesData) {
        const ctx = document.getElementById('forecastChart')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.forecast) this.charts.forecast.destroy();
        this.charts.forecast = new Chart(ctx, {
            type: 'line',
            data: {
                labels: forecast.forecastDays.map(d => `Day ${d}`),
                datasets: [{
                    label: 'Forecasted Sales (R)',
                    data: forecast.forecastValues,
                    borderColor: '#2c5e2e',
                    borderDash: [5,5],
                    tension: 0.1
                }]
            },
            options: { responsive: true, plugins: { tooltip: { callbacks: { label: (ctx) => `R${ctx.raw.toFixed(2)}` } } } }
        });
        const totalForecast = forecast.forecastValues.reduce((a,b)=>a+b,0);
        const insightDiv = document.getElementById('forecastInsight');
        if (insightDiv) insightDiv.innerHTML = `📈 Expected next 7‑day revenue: <strong>R${totalForecast.toFixed(2)}</strong><br>Based on linear trend of last 14 days.`;
    }

    async renderPrescriptiveInsights(salesData, topProductsData, orderStatusData) {
        const { data: lowStock } = await window.supabase.from('products').select('name, stock_quantity').lt('stock_quantity', 10).eq('is_active', true);
        const lowStockHtml = lowStock?.length ? `<li>Restock soon: ${lowStock.map(p => `${p.name} (${p.stock_quantity} left)`).join(', ')}</li>` : '<li>All stock levels healthy</li>';
        const totalOrders = Object.values(orderStatusData).reduce((a,b)=>a+b,0);
        const cancelled = orderStatusData.cancelled || 0;
        const cancelRate = totalOrders ? (cancelled/totalOrders*100).toFixed(1) : 0;
        const cancelAdvice = cancelRate > 10 ? `<li>⚠️ High cancellation rate (${cancelRate}%). Review payment or fulfilment process.</li>` : '';
        const topProduct = topProductsData.names[0];
        const promoAdvice = topProduct ? `<li>✨ Promote "${topProduct}" – it's your best seller.</li>` : '';
        const peakDay = this.getPeakDay(salesData);
        const prescHtml = `
            <ul style="margin:0; padding-left:1.2rem;">
                ${lowStockHtml}
                ${cancelAdvice}
                ${promoAdvice}
                <li>📅 Run a weekend campaign – sales peak on ${peakDay}.</li>
            </ul>
        `;
        const insightDiv = document.getElementById('prescriptiveInsights');
        if (insightDiv) insightDiv.innerHTML = prescHtml;
    }

    getPeakDay(salesData) {
        if (!salesData.dates.length) return 'Friday';
        const daySums = {};
        salesData.dates.forEach((date, i) => {
            const day = new Date(date).toLocaleDateString('en', { weekday: 'long' });
            daySums[day] = (daySums[day] || 0) + salesData.amounts[i];
        });
        const sorted = Object.entries(daySums).sort((a,b)=>b[1]-a[1]);
        return sorted[0]?.[0] || 'weekend';
    }

    async exportToExcel() {
        const { data: orders } = await window.supabase.from('orders').select('*');
        const { data: products } = await window.supabase.from('products').select('*');
        const { data: users } = await window.supabase.from('users').select('*');
        const wb = XLSX.utils.book_new();
        const ordersSheet = XLSX.utils.json_to_sheet(orders || []);
        XLSX.utils.book_append_sheet(wb, ordersSheet, 'Orders');
        const productsSheet = XLSX.utils.json_to_sheet(products || []);
        XLSX.utils.book_append_sheet(wb, productsSheet, 'Products');
        const usersSheet = XLSX.utils.json_to_sheet(users || []);
        XLSX.utils.book_append_sheet(wb, usersSheet, 'Users');
        const kpis = await this.getDescriptiveKPIs();
        const summaryData = [
            { Metric: '30-Day Revenue', Value: `R${kpis.totalRevenue.toFixed(2)}` },
            { Metric: 'Paid Orders (30d)', Value: kpis.orderCount },
            { Metric: 'Average Order Value', Value: `R${kpis.avgOrderValue.toFixed(2)}` },
            { Metric: 'Total Products', Value: kpis.totalProducts },
            { Metric: 'All Time Orders', Value: kpis.totalOrdersAll }
        ];
        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Analytics_Summary');
        XLSX.writeFile(wb, `patriocele_analytics_${new Date().toISOString().slice(0,19)}.xlsx`);
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
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
        const addBtn = document.getElementById('add-product-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.openProductModal());
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });
        const productForm = document.getElementById('product-form');
        if (productForm) productForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });
        const productSearch = document.getElementById('product-search');
        if (productSearch) productSearch.addEventListener('input', (e) => this.filterProducts(e.target.value));
        const orderStatusFilter = document.getElementById('order-status-filter');
        if (orderStatusFilter) orderStatusFilter.addEventListener('change', (e) => this.filterOrders(e.target.value));
        const productStatusFilter = document.getElementById('product-status');
        if (productStatusFilter) productStatusFilter.addEventListener('change', () => this.loadProducts());
        const dateFrom = document.getElementById('order-date-from');
        const dateTo = document.getElementById('order-date-to');
        if (dateFrom && dateTo) {
            dateFrom.addEventListener('change', () => this.filterOrdersByDate());
            dateTo.addEventListener('change', () => this.filterOrdersByDate());
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        switch(tabName) {
            case 'products': this.loadProducts(); break;
            case 'orders': this.loadOrders(); break;
            case 'users': this.loadUsers(); break;
            case 'analytics': this.loadAnalytics(); break;
        }
    }

    // ========== DASHBOARD ==========
    async loadDashboardData() {
        try {
            const [productsCount, ordersCount, usersCount, revenueData] = await Promise.all([
                this.getProductsCount(), this.getOrdersCount(), this.getUsersCount(), this.getRevenueData()
            ]);
            document.getElementById('total-products').textContent = productsCount;
            document.getElementById('total-orders').textContent = ordersCount;
            document.getElementById('total-users').textContent = usersCount;
            document.getElementById('total-revenue').textContent = `R${revenueData.total.toFixed(2)}`;
            await this.loadRecentOrders();
            await this.loadLowStockProducts();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    async getProductsCount() {
        const { count, error } = await window.supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true);
        return error ? 0 : count;
    }
    async getOrdersCount() {
        const { count, error } = await window.supabase.from('orders').select('*', { count: 'exact', head: true });
        return error ? 0 : count;
    }
    async getUsersCount() {
        const { count, error } = await window.supabase.from('users').select('*', { count: 'exact', head: true });
        return error ? 0 : count;
    }
    async getRevenueData() {
        const { data, error } = await window.supabase.from('orders').select('total_amount').eq('payment_status', 'paid');
        if (error) return { total: 0 };
        const total = data.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
        return { total };
    }

    async loadRecentOrders() {
        const { data, error } = await window.supabase.from('orders').select(`*, users ( email, full_name )`).order('created_at', { ascending: false }).limit(5);
        if (error) { console.error(error); return; }
        const container = document.getElementById('recent-orders');
        if (!data.length) { container.innerHTML = '<p>No recent orders</p>'; return; }
        let html = '';
        data.forEach(order => {
            html += `<div class="recent-order" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
                <div><strong>Order #${order.id}</strong><span style="display: block; font-size: 0.85rem;">${order.users?.full_name || order.users?.email}</span></div>
                <div style="text-align: right;"><span class="status-badge status-${order.status}">${order.status}</span><span style="display: block;">R${order.total_amount}</span></div>
            </div>`;
        });
        container.innerHTML = html;
    }

    async loadLowStockProducts() {
        const { data, error } = await window.supabase.from('products').select('*').lt('stock_quantity', 10).eq('is_active', true).order('stock_quantity', { ascending: true }).limit(5);
        if (error) { console.error(error); return; }
        const container = document.getElementById('low-stock');
        if (!data.length) { container.innerHTML = '<p>All products have sufficient stock</p>'; return; }
        let html = '';
        data.forEach(product => {
            html += `<div style="display: flex; justify-content: space-between; padding: 0.5rem 0;"><span>${escapeHtml(product.name)}</span><span style="color: #e74c3c;">${product.stock_quantity} left</span></div>`;
        });
        container.innerHTML = html;
    }

    // ========== PRODUCTS (with fixed editing) ==========
    async loadProducts() {
        let query = window.supabase.from('products').select('*').order('created_at', { ascending: false });
        const statusFilter = document.getElementById('product-status')?.value;
        if (statusFilter === 'active') query = query.eq('is_active', true);
        else if (statusFilter === 'inactive') query = query.eq('is_active', false);
        const { data, error } = await query;
        if (error) { console.error('Error loading products:', error); return; }
        this.products = data || [];
        this.renderProducts();
    }

    renderProducts() {
        const tbody = document.getElementById('products-table-body');
        if (!this.products.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No products found</td></tr>';
            return;
        }
        let html = '';
        this.products.forEach(product => {
            html += `
                <tr>
                    <td>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <img src="${product.images?.[0] || 'https://via.placeholder.com/40x40?text=P'}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                            <div><strong>${escapeHtml(product.name)}</strong><div style="font-size: 0.8rem;">${escapeHtml(product.description?.substring(0, 50) || '')}...</div></div>
                        </div>
                    </td>
                    <td>R${product.price}</td>
                    <td><span class="${product.stock_quantity < 10 ? 'stock-warning' : ''}">${product.stock_quantity}</span></td>
                    <td><span class="status-badge ${product.is_active ? 'status-confirmed' : 'status-cancelled'}">${product.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                        <button class="btn-outline btn-sm" data-product-id="${product.id}" data-action="edit">Edit</button>
                        <button class="btn-outline btn-sm btn-danger" data-product-id="${product.id}" data-action="toggle">${product.is_active ? 'Deactivate' : 'Activate'}</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => this.editProduct(parseInt(btn.dataset.productId)));
        });
        tbody.querySelectorAll('button[data-action="toggle"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const pid = parseInt(btn.dataset.productId);
                const prod = this.products.find(p => p.id === pid);
                if (prod) this.toggleProductStatus(pid, !prod.is_active);
            });
        });
    }

    filterProducts(searchTerm) {
        const filtered = this.products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())));
        this.renderFilteredProducts(filtered);
    }

    renderFilteredProducts(filtered) {
        const tbody = document.getElementById('products-table-body');
        if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="5">No products found</td></tr>'; return; }
        let html = '';
        filtered.forEach(product => {
            html += `<tr>
                <td><div><img src="${product.images?.[0] || 'https://via.placeholder.com/40x40?text=P'}" style="width:40px;height:40px;"><strong>${escapeHtml(product.name)}</strong></div></td>
                <td>R${product.price}</td>
                <td>${product.stock_quantity}</td>
                <td><span class="status-badge ${product.is_active ? 'status-confirmed' : 'status-cancelled'}">${product.is_active ? 'Active' : 'Inactive'}</span></td>
                <td><button class="btn-outline btn-sm" data-product-id="${product.id}" data-action="edit">Edit</button> <button class="btn-outline btn-sm btn-danger" data-product-id="${product.id}" data-action="toggle">${product.is_active ? 'Deactivate' : 'Activate'}</button></td>
            </tr>`;
        });
        tbody.innerHTML = html;
        tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => btn.addEventListener('click', () => this.editProduct(parseInt(btn.dataset.productId))));
        tbody.querySelectorAll('button[data-action="toggle"]').forEach(btn => btn.addEventListener('click', () => {
            const pid = parseInt(btn.dataset.productId);
            const prod = this.products.find(p => p.id === pid);
            if (prod) this.toggleProductStatus(pid, !prod.is_active);
        }));
    }

    async editProduct(productId) {
        let product = this.products.find(p => p.id === productId);
        if (!product) {
            const { data, error } = await window.supabase.from('products').select('*').eq('id', productId).single();
            if (error || !data) { alert('Product not found'); return; }
            product = data;
        }
        this.openProductModal(product);
    }

    openProductModal(product = null) {
        const modal = document.getElementById('product-modal');
        const title = document.getElementById('product-modal-title');
        if (product) {
            title.textContent = 'Edit Product';
            this.fillProductForm(product);
        } else {
            title.textContent = 'Add New Product';
            this.clearProductForm();
        }
        modal.style.display = 'block';
    }

    closeModal() {
        document.getElementById('product-modal').style.display = 'none';
    }

    fillProductForm(product) {
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-stock').value = product.stock_quantity;
        document.getElementById('product-intensity').value = product.intensity || 'EDP';
        document.getElementById('product-occasion').value = product.occasion?.join(', ') || '';
        document.getElementById('product-images').value = product.images?.join('\n') || '';
        document.getElementById('product-active').checked = product.is_active;
    }

    clearProductForm() {
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
    }

    async saveProduct() {
        const formData = new FormData(document.getElementById('product-form'));
        const productId = formData.get('product-id');
        const productData = {
            name: formData.get('product-name'),
            description: formData.get('product-description'),
            price: parseFloat(formData.get('product-price')),
            stock_quantity: parseInt(formData.get('product-stock')),
            intensity: formData.get('product-intensity'),
            occasion: formData.get('product-occasion').split(',').map(s => s.trim()).filter(s => s),
            images: formData.get('product-images').split('\n').map(s => s.trim()).filter(s => s),
            is_active: document.getElementById('product-active').checked
        };
        try {
            let result;
            if (productId) {
                result = await window.supabase.from('products').update(productData).eq('id', productId);
            } else {
                result = await window.supabase.from('products').insert([productData]);
            }
            if (result.error) throw result.error;
            this.closeModal();
            this.loadProducts();
            alert('Product saved successfully!');
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Error saving product: ' + error.message);
        }
    }

    async toggleProductStatus(productId, newStatus) {
        try {
            const { error } = await window.supabase.from('products').update({ is_active: newStatus }).eq('id', productId);
            if (error) throw error;
            this.loadProducts();
            alert(`Product ${newStatus ? 'activated' : 'deactivated'} successfully!`);
        } catch (error) {
            console.error('Error updating product status:', error);
            alert('Error updating product status');
        }
    }

    // ========== ORDERS ==========
    async loadOrders() {
        const { data, error } = await window.supabase.from('orders').select(`*, users ( email, full_name ), order_items ( quantity, products ( name ) )`).order('created_at', { ascending: false });
        if (error) { console.error(error); return; }
        this.orders = data || [];
        this.renderOrders();
    }

    renderOrders() {
        const tbody = document.getElementById('orders-table-body');
        if (!this.orders.length) { tbody.innerHTML = '<tr><td colspan="6">No orders found</td></tr>'; return; }
        let html = '';
        this.orders.forEach(order => {
            html += `<tr>
                <td>#${order.id}</td>
                <td><strong>${order.users?.full_name || 'Customer'}</strong><div style="font-size:0.8rem;">${order.users?.email}</div></td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td>R${order.total_amount}</td>
                <td><select class="status-select" data-order-id="${order.id}" onchange="adminManager.updateOrderStatus(${order.id}, this.value)">
                    ${['pending','confirmed','shipped','delivered','cancelled'].map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
                </select></td>
                <td><button class="btn-outline btn-sm" onclick="adminManager.viewOrder(${order.id})">View</button></td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }

    async updateOrderStatus(orderId, newStatus) {
        try {
            const { error } = await window.supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
            if (error) throw error;
            alert('Order status updated');
            this.loadOrders();
        } catch (error) { console.error(error); alert('Error updating order status'); }
    }

    filterOrders(status) {
        const filtered = status ? this.orders.filter(o => o.status === status) : this.orders;
        this.renderFilteredOrders(filtered);
    }

    filterOrdersByDate() {
        const from = document.getElementById('order-date-from')?.value;
        const to = document.getElementById('order-date-to')?.value;
        let filtered = [...this.orders];
        if (from) filtered = filtered.filter(o => new Date(o.created_at) >= new Date(from));
        if (to) { const end = new Date(to); end.setHours(23,59,59); filtered = filtered.filter(o => new Date(o.created_at) <= end); }
        this.renderFilteredOrders(filtered);
    }

    renderFilteredOrders(filtered) {
        const tbody = document.getElementById('orders-table-body');
        if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="6">No orders found</td></tr>'; return; }
        let html = '';
        filtered.forEach(order => {
            html += `<tr>
                <td>#${order.id}</td>
                <td><strong>${order.users?.full_name || 'Customer'}</strong><div style="font-size:0.8rem;">${order.users?.email}</div></td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
                <td>R${order.total_amount}</td>
                <td><select onchange="adminManager.updateOrderStatus(${order.id}, this.value)">
                    ${['pending','confirmed','shipped','delivered','cancelled'].map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select></td>
                <td><button class="btn-outline btn-sm" onclick="adminManager.viewOrder(${order.id})">View</button></td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }

    viewOrder(orderId) { alert(`View order #${orderId} – implement detailed view as needed`); }

    // ========== USERS ==========
    async loadUsers() {
        const { data, error } = await window.supabase.from('users').select(`*, orders (id)`).order('created_at', { ascending: false });
        if (error) { console.error(error); return; }
        this.users = data || [];
        this.renderUsers();
    }

    renderUsers() {
        const tbody = document.getElementById('users-table-body');
        if (!this.users.length) { tbody.innerHTML = '<tr><td colspan="7">No users found</td></tr>'; return; }
        let html = '';
        this.users.forEach(user => {
            html += `<tr>
                <td>${user.id.substring(0,8)}...</td>
                <td>${user.email}</td>
                <td>${user.full_name || 'N/A'}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>${user.orders?.length || 0}</td>
                <td><span class="status-badge ${user.is_admin ? 'status-delivered' : 'status-pending'}">${user.is_admin ? 'Admin' : 'User'}</span></td>
                <td><button class="btn-outline btn-sm" data-user-id="${user.id}" data-make-admin="${!user.is_admin}">${user.is_admin ? 'Remove Admin' : 'Make Admin'}</button></td>
            </tr>`;
        });
        tbody.innerHTML = html;
        tbody.querySelectorAll('button[data-user-id]').forEach(btn => {
            btn.addEventListener('click', () => this.toggleAdmin(btn.dataset.userId, btn.dataset.makeAdmin === 'true'));
        });
    }

    async toggleAdmin(userId, makeAdmin) {
        try {
            const { error } = await window.supabase.from('users').update({ is_admin: makeAdmin }).eq('id', userId);
            if (error) throw error;
            this.loadUsers();
            alert(`User ${makeAdmin ? 'promoted to admin' : 'removed from admin'}`);
        } catch (error) { console.error(error); alert('Error updating user role'); }
    }
}

// Helper function
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Initialize
let adminManager;
document.addEventListener('DOMContentLoaded', () => {
    adminManager = new AdminManager();
});