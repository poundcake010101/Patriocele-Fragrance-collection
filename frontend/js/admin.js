class AdminManager {
    constructor() {
        this.currentUser = null;
        this.products = [];
        this.orders = [];
        this.users = [];
        this.currency = 'ZAR';
        this.init();
    }

    loadAnalytics() {
        this.loadSalesChart();
        this.loadTopProducts();
    }

    async loadAnalytics() {
        await this.loadSalesChart();
        await this.loadTopProducts();
        await this.loadAnalyticsSummary();
    }

    async loadAnalyticsSummary() {
        const { data: orders, error } = await window.supabase
            .from('orders')
            .select('total_amount, payment_status, created_at')
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        if (error) {
            console.error('Error loading analytics summary:', error);
            return;
        }

        const paidOrders = orders.filter(order => order.payment_status === 'paid');
        const totalRevenue = paidOrders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
        const averageOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

        // Update the analytics tab with summary
        const summaryHtml = `
            <div class="analytics-summary">
                <div class="summary-item">
                    <h4>30-Day Revenue</h4>
                    <div class="summary-value">R${totalRevenue.toFixed(2)}</div>
                </div>
                <div class="summary-item">
                    <h4>Total Orders</h4>
                    <div class="summary-value">${paidOrders.length}</div>
                </div>
                <div class="summary-item">
                    <h4>Average Order</h4>
                    <div class="summary-value">R${averageOrderValue.toFixed(2)}</div>
                </div>
            </div>
        `;

        // Add this to the analytics tab
        const existingContent = document.getElementById('sales-chart').innerHTML;
        document.getElementById('sales-chart').innerHTML = summaryHtml + existingContent;
    }

    async loadSalesChart() {
        const { data, error } = await window.supabase
            .from('orders')
            .select('created_at, total_amount')
            .eq('payment_status', 'paid')
            .order('created_at', { ascending: true })
            .limit(30);

        if (error) {
            console.error('Error loading sales data:', error);
            return;
        }

        const container = document.getElementById('sales-chart');
        
        if (data.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem;">No sales data available yet</p>';
            return;
        }

        // Group by date and sum amounts
        const salesByDate = {};
        data.forEach(order => {
            const date = new Date(order.created_at).toLocaleDateString();
            salesByDate[date] = (salesByDate[date] || 0) + parseFloat(order.total_amount);
        });

        const dates = Object.keys(salesByDate);
        const amounts = Object.values(salesByDate);

        // Create a simple bar chart using CSS
        const maxAmount = Math.max(...amounts);
        
        let html = `
            <div class="chart-container">
                <div class="chart-title">Sales Last 30 Days</div>
                <div class="chart-bars">
        `;

        dates.forEach((date, index) => {
            const height = (amounts[index] / maxAmount) * 100;
            html += `
                <div class="chart-bar-container">
                    <div class="chart-bar" style="height: ${height}%"></div>
                    <div class="chart-label">
                        <small>R${amounts[index].toFixed(0)}</small>
                        <br>
                        <small>${date.split('/')[0]}/${date.split('/')[1]}</small>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
                <div class="chart-total">
                    Total: R${amounts.reduce((a, b) => a + b, 0).toFixed(2)}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    async init() {
        // Wait for auth to be ready
        await window.authManager.waitForAuth();
        
        if (!window.authManager.isUserLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }

        this.currentUser = window.authManager.getCurrentUser();
        
        // Check if user is admin
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
        // Tab navigation
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Product management
        document.getElementById('add-product-btn').addEventListener('click', () => {
            this.openProductModal();
        });

        // Modal handlers
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal();
            });
        });

        // Product form submission
        document.getElementById('product-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        // Filters
        document.getElementById('product-search').addEventListener('input', (e) => {
            this.filterProducts(e.target.value);
        });

        document.getElementById('order-status-filter').addEventListener('change', (e) => {
            this.filterOrders(e.target.value);
        });
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.admin-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Load tab-specific data
        switch(tabName) {
            case 'products':
                this.loadProducts();
                break;
            case 'orders':
                this.loadOrders();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    async loadDashboardData() {
        try {
            // Load stats
            const [productsCount, ordersCount, usersCount, revenueData] = await Promise.all([
                this.getProductsCount(),
                this.getOrdersCount(),
                this.getUsersCount(),
                this.getRevenueData()
            ]);

            document.getElementById('total-products').textContent = productsCount;
            document.getElementById('total-orders').textContent = ordersCount;
            document.getElementById('total-users').textContent = usersCount;
            document.getElementById('total-revenue').textContent = `R${revenueData.total.toFixed(2)}`;

            // Load recent orders
            await this.loadRecentOrders();
            
            // Load low stock products
            await this.loadLowStockProducts();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    async getProductsCount() {
        const { count, error } = await window.supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        return error ? 0 : count;
    }

    async getOrdersCount() {
        const { count, error } = await window.supabase
            .from('orders')
            .select('*', { count: 'exact', head: true });

        return error ? 0 : count;
    }

    async getUsersCount() {
        const { count, error } = await window.supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        return error ? 0 : count;
    }

    async getRevenueData() {
        const { data, error } = await window.supabase
            .from('orders')
            .select('total_amount')
            .eq('payment_status', 'paid');

        if (error) return { total: 0 };

        const total = data.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
        return { total };
    }

    async loadRecentOrders() {
        const { data, error } = await window.supabase
            .from('orders')
            .select(`
                *,
                users (
                    email,
                    full_name
                )
            `)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error('Error loading recent orders:', error);
            return;
        }

        const container = document.getElementById('recent-orders');
        if (data.length === 0) {
            container.innerHTML = '<p>No recent orders</p>';
            return;
        }

        let html = '';
        data.forEach(order => {
            const orderDate = new Date(order.created_at).toLocaleDateString();
            html += `
                <div class="recent-order">
                    <div class="order-info">
                        <strong>Order #${order.id}</strong>
                        <span>${order.users?.full_name || order.users?.email}</span>
                    </div>
                    <div class="order-meta">
                        <span class="status-badge status-${order.status}">${order.status}</span>
                        <span>R${order.total_amount}</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    async loadLowStockProducts() {
        const { data, error } = await window.supabase
            .from('products')
            .select('*')
            .lt('stock_quantity', 10)
            .eq('is_active', true)
            .order('stock_quantity', { ascending: true })
            .limit(5);

        if (error) {
            console.error('Error loading low stock products:', error);
            return;
        }

        const container = document.getElementById('low-stock');
        if (data.length === 0) {
            container.innerHTML = '<p>All products have sufficient stock</p>';
            return;
        }

        let html = '';
        data.forEach(product => {
            html += `
                <div class="low-stock-item">
                    <span class="product-name">${product.name}</span>
                    <span class="stock-warning">${product.stock_quantity} left</span>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    async loadProducts() {
        const { data, error } = await window.supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading products:', error);
            return;
        }

        this.products = data || [];
        this.renderProducts();
    }

    renderProducts() {
        const tbody = document.getElementById('products-table-body');
        
        if (this.products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No products found</td></tr>';
            return;
        }

        let html = '';
        this.products.forEach(product => {
            html += `
                <tr>
                    <td>
                        <div class="product-cell">
                            <img src="${product.images?.[0] || 'https://via.placeholder.com/40x40?text=P'}" 
                                 alt="${product.name}" 
                                 style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                            <div>
                                <strong>${product.name}</strong>
                                <div class="product-description">${product.description?.substring(0, 50)}...</div>
                            </div>
                        </div>
                    </td>
                    <td>R${product.price}</td>
                    <td>
                        <span class="${product.stock_quantity < 10 ? 'stock-warning' : ''}">
                            ${product.stock_quantity}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${product.is_active ? 'status-confirmed' : 'status-cancelled'}">
                            ${product.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-outline btn-sm" onclick="adminManager.editProduct(${product.id})">
                            Edit
                        </button>
                        <button class="btn-outline btn-sm btn-danger" onclick="adminManager.toggleProductStatus(${product.id}, ${!product.is_active})">
                            ${product.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    async loadOrders() {
        const { data, error } = await window.supabase
            .from('orders')
            .select(`
                *,
                users (
                    email,
                    full_name
                ),
                order_items (
                    quantity,
                    products (
                        name
                    )
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading orders:', error);
            return;
        }

        this.orders = data || [];
        this.renderOrders();
    }

    renderOrders() {
        const tbody = document.getElementById('orders-table-body');
        
        if (this.orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No orders found</td></tr>';
            return;
        }

        let html = '';
        this.orders.forEach(order => {
            const orderDate = new Date(order.created_at).toLocaleDateString();
            const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
            
            html += `
                <tr>
                    <td>#${order.id}</td>
                    <td>
                        <div>
                            <strong>${order.users?.full_name || 'Customer'}</strong>
                            <div class="user-email">${order.users?.email}</div>
                        </div>
                    </td>
                    <td>${orderDate}</td>
                    <td>R${order.total_amount}</td>
                    <td>
                        <select class="status-select" data-order-id="${order.id}" onchange="adminManager.updateOrderStatus(${order.id}, this.value)">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn-outline btn-sm" onclick="adminManager.viewOrder(${order.id})">
                            View
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    async loadUsers() {
        const { data, error } = await window.supabase
            .from('users')
            .select(`
                *,
                orders (id)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading users:', error);
            return;
        }

        this.users = data || [];
        this.renderUsers();
    }

    renderUsers() {
        const tbody = document.getElementById('users-table-body');
        
        if (this.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No users found</td></tr>';
            return;
        }

        let html = '';
        this.users.forEach(user => {
            const joinDate = new Date(user.created_at).toLocaleDateString();
            const orderCount = user.orders?.length || 0;
            
            html += `
                <tr>
                    <td>${user.id.substring(0, 8)}...</td>
                    <td>${user.email}</td>
                    <td>${user.full_name || 'N/A'}</td>
                    <td>${joinDate}</td>
                    <td>${orderCount}</td>
                    <td>
                        <span class="status-badge ${user.is_admin ? 'status-delivered' : 'status-pending'}">
                            ${user.is_admin ? 'Admin' : 'User'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-outline btn-sm" onclick="adminManager.toggleAdmin('${user.id}', ${!user.is_admin})">
                            ${user.is_admin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
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
                // Update existing product
                result = await window.supabase
                    .from('products')
                    .update(productData)
                    .eq('id', productId);
            } else {
                // Create new product
                result = await window.supabase
                    .from('products')
                    .insert([productData]);
            }

            if (result.error) throw result.error;

            this.closeModal();
            this.loadProducts(); // Reload products list
            alert('Product saved successfully!');

        } catch (error) {
            console.error('Error saving product:', error);
            alert('Error saving product: ' + error.message);
        }
    }

    async editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            this.openProductModal(product);
        }
    }

    async toggleProductStatus(productId, newStatus) {
        try {
            const { error } = await window.supabase
                .from('products')
                .update({ is_active: newStatus })
                .eq('id', productId);

            if (error) throw error;

            this.loadProducts(); // Reload products list
            alert(`Product ${newStatus ? 'activated' : 'deactivated'} successfully!`);

        } catch (error) {
            console.error('Error updating product status:', error);
            alert('Error updating product status');
        }
    }

    async updateOrderStatus(orderId, newStatus) {
        try {
            const { error } = await window.supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;

            alert('Order status updated successfully!');

        } catch (error) {
            console.error('Error updating order status:', error);
            alert('Error updating order status');
        }
    }

    async toggleAdmin(userId, makeAdmin) {
        try {
            const { error } = await window.supabase
                .from('users')
                .update({ is_admin: makeAdmin })
                .eq('id', userId);

            if (error) throw error;

            this.loadUsers(); // Reload users list
            alert(`User ${makeAdmin ? 'promoted to admin' : 'removed from admin'} successfully!`);

        } catch (error) {
            console.error('Error updating user role:', error);
            alert('Error updating user role');
        }
    }

    viewOrder(orderId) {
        // In a real app, you might open a detailed order view modal
        alert(`View order details for order #${orderId}`);
    }

    filterProducts(searchTerm) {
        const filtered = this.products.filter(product => 
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.renderFilteredProducts(filtered);
    }

    renderFilteredProducts(filteredProducts) {
        const tbody = document.getElementById('products-table-body');
        
        if (filteredProducts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No products found</td></tr>';
            return;
        }

        let html = '';
        filteredProducts.forEach(product => {
            html += `
                <tr>
                    <td>
                        <div class="product-cell">
                            <img src="${product.images?.[0] || 'https://via.placeholder.com/40x40?text=P'}" 
                                 alt="${product.name}" 
                                 style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                            <div>
                                <strong>${product.name}</strong>
                                <div class="product-description">${product.description?.substring(0, 50)}...</div>
                            </div>
                        </div>
                    </td>
                    <td>R${product.price}</td>
                    <td>${product.stock_quantity}</td>
                    <td>
                        <span class="status-badge ${product.is_active ? 'status-confirmed' : 'status-cancelled'}">
                            ${product.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-outline btn-sm" onclick="adminManager.editProduct(${product.id})">
                            Edit
                        </button>
                        <button class="btn-outline btn-sm btn-danger" onclick="adminManager.toggleProductStatus(${product.id}, ${!product.is_active})">
                            ${product.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    filterOrders(status) {
        const filtered = status ? 
            this.orders.filter(order => order.status === status) : 
            this.orders;
        this.renderFilteredOrders(filtered);
    }

    renderFilteredOrders(filteredOrders) {
        const tbody = document.getElementById('orders-table-body');
        
        if (filteredOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No orders found</td></tr>';
            return;
        }

        let html = '';
        filteredOrders.forEach(order => {
            const orderDate = new Date(order.created_at).toLocaleDateString();
            const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
            
            html += `
                <tr>
                    <td>#${order.id}</td>
                    <td>
                        <div>
                            <strong>${order.users?.full_name || 'Customer'}</strong>
                            <div class="user-email">${order.users?.email}</div>
                        </div>
                    </td>
                    <td>${orderDate}</td>
                    <td>R${order.total_amount}</td>
                    <td>
                        <select class="status-select" data-order-id="${order.id}" onchange="adminManager.updateOrderStatus(${order.id}, this.value)">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn-outline btn-sm" onclick="adminManager.viewOrder(${order.id})">
                            View
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    loadAnalytics() {
        // Basic analytics - in a real app, you'd use a charting library
        document.getElementById('sales-chart').innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <p>Sales analytics chart would be displayed here</p>
                <p><small>Integrate with Chart.js or similar library for visualizations</small></p>
            </div>
        `;

        this.loadTopProducts();
    }

    async loadTopProducts() {
        // This is a simplified version - in reality, you'd need a more complex query
        const { data, error } = await window.supabase
            .from('order_items')
            .select(`
                quantity,
                products (
                    name
                )
            `)
            .limit(10);

        if (error) {
            console.error('Error loading top products:', error);
            return;
        }

        const container = document.getElementById('top-products');
        if (data.length === 0) {
            container.innerHTML = '<p>No sales data yet</p>';
            return;
        }

        // Group by product and sum quantities
        const productSales = {};
        data.forEach(item => {
            const productName = item.products.name;
            productSales[productName] = (productSales[productName] || 0) + item.quantity;
        });

        let html = '';
        Object.entries(productSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([productName, quantity]) => {
                html += `
                    <div class="top-product">
                        <span class="product-name">${productName}</span>
                        <span class="sales-count">${quantity} sold</span>
                    </div>
                `;
            });

        container.innerHTML = html;
    }
}

// Initialize admin manager
let adminManager;
document.addEventListener('DOMContentLoaded', function() {
    adminManager = new AdminManager();
});