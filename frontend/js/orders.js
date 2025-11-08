class OrdersManager {
    constructor() {
        this.orders = [];
        this.init();
    }

    async init() {
        // Wait for auth to be ready
        await window.authManager.waitForAuth();
        
        if (!window.authManager.isUserLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }

        await this.loadOrders();
    }

    async loadOrders() {
        const user = window.authManager.getCurrentUser();
        
        try {
            const { data, error } = await window.supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        quantity,
                        unit_price,
                        size_variant,
                        products (
                            name,
                            images
                        )
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.orders = data || [];
            this.renderOrders();
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    }

    renderOrders() {
        const ordersList = document.getElementById('orders-list');
        const noOrders = document.getElementById('no-orders');

        if (this.orders.length === 0) {
            ordersList.style.display = 'none';
            noOrders.style.display = 'block';
            return;
        }

        ordersList.style.display = 'block';
        noOrders.style.display = 'none';

        let html = '';
        this.orders.forEach(order => {
            html += this.createOrderCard(order);
        });

        ordersList.innerHTML = html;
    }

    createOrderCard(order) {
        const orderDate = new Date(order.created_at).toLocaleDateString();
        const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
        
        return `
            <div class="order-card">
                <div class="order-header">
                    <div>
                        <h3>Order #${order.id}</h3>
                        <p>Placed on ${orderDate}</p>
                    </div>
                    <div class="order-status">
                        <span class="status-badge status-${order.status}">${order.status}</span>
                    </div>
                </div>
                
                <div class="order-items">
                    ${order.order_items.map(item => `
                        <div class="order-item">
                            <img src="${item.products.images?.[0] || 'https://via.placeholder.com/50x50?text=Perfume'}" 
                                 alt="${item.products.name}" 
                                 style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
                            <div style="flex: 1;">
                                <h4>${item.products.name}</h4>
                                <p>Size: ${item.size_variant} × ${item.quantity}</p>
                            </div>
                            <div class="item-price">$${item.unit_price}</div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="order-footer">
                    <div class="order-total">
                        Total: $${order.total_amount}
                    </div>
                    <div class="order-actions">
                        <button class="btn-outline view-order-btn" data-order-id="${order.id}">
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// Initialize orders manager
document.addEventListener('DOMContentLoaded', function() {
    new OrdersManager();
});