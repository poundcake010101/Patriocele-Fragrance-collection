class CartManager {
    constructor() {
        this.cartItems = [];
        this.init();
    }

    async init() {
        await this.loadCartItems();
        this.setupEventListeners();
    }

    async loadCartItems() {
        const user = window.authManager?.getCurrentUser();
        
        if (!user) {
            this.showLoginPrompt();
            return;
        }

        try {
            const { data, error } = await window.supabase
                .from('cart_items')
                .select(`
                    *,
                    products (
                        name,
                        price,
                        size_variants,
                        images
                    )
                `)
                .eq('user_id', user.id);

            if (error) throw error;

            this.cartItems = data || [];
            this.renderCart();
        } catch (error) {
            console.error('Error loading cart:', error);
        }
    }

    renderCart() {
        const cartItemsDiv = document.getElementById('cart-items');
        const cartEmptyDiv = document.getElementById('cart-empty');
        const cartSummaryDiv = document.getElementById('cart-summary');

        if (this.cartItems.length === 0) {
            cartEmptyDiv.style.display = 'block';
            cartItemsDiv.innerHTML = '';
            cartSummaryDiv.style.display = 'none';
            return;
        }

        cartEmptyDiv.style.display = 'none';
        cartSummaryDiv.style.display = 'block';

        let html = '';
        let subtotal = 0;

        this.cartItems.forEach(item => {
            const product = item.products;
            const price = product.size_variants?.[item.size_variant] || product.price;
            const itemTotal = price * item.quantity;
            subtotal += itemTotal;

            html += `
                <div class="cart-item" data-item-id="${item.id}">
                    <img src="${product.images?.[0] || 'https://via.placeholder.com/100x100?text=Perfume'}" 
                         alt="${product.name}" 
                         style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px;">
                    <div style="flex: 1;">
                        <h3>${product.name}</h3>
                        <p>Size: ${item.size_variant}</p>
                        <p class="price">$${price}</p>
                    </div>
                    <div class="quantity-controls">
                        <button class="btn-outline quantity-btn" data-action="decrease">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="btn-outline quantity-btn" data-action="increase">+</button>
                    </div>
                    <div class="item-total">
                        $${itemTotal.toFixed(2)}
                    </div>
                    <button class="btn-outline remove-btn" data-item-id="${item.id}">Remove</button>
                </div>
            `;
        });

        cartItemsDiv.innerHTML = html;
        this.updateTotals(subtotal);
    }

    updateTotals(subtotal) {
        const shipping = 5.99;
        const tax = subtotal * 0.08; // 8% tax
        const total = subtotal + shipping + tax;

        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('total').textContent = `$${total.toFixed(2)}`;
    }

    async updateQuantity(itemId, change) {
        const item = this.cartItems.find(i => i.id === itemId);
        if (!item) return;

        const newQuantity = item.quantity + change;
        
        if (newQuantity < 1) {
            await this.removeItem(itemId);
            return;
        }

        try {
            const { error } = await window.supabase
                .from('cart_items')
                .update({ quantity: newQuantity })
                .eq('id', itemId);

            if (error) throw error;

            item.quantity = newQuantity;
            this.renderCart();
            window.authManager.updateCartCount();
        } catch (error) {
            console.error('Error updating quantity:', error);
        }
    }

    async removeItem(itemId) {
        try {
            const { error } = await window.supabase
                .from('cart_items')
                .delete()
                .eq('id', itemId);

            if (error) throw error;

            this.cartItems = this.cartItems.filter(item => item.id !== itemId);
            this.renderCart();
            window.authManager.updateCartCount();
        } catch (error) {
            console.error('Error removing item:', error);
        }
    }

    setupEventListeners() {
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('quantity-btn')) {
                const itemId = parseInt(e.target.closest('.cart-item').dataset.itemId);
                const action = e.target.dataset.action;
                await this.updateQuantity(itemId, action === 'increase' ? 1 : -1);
            }

            if (e.target.classList.contains('remove-btn')) {
                const itemId = parseInt(e.target.dataset.itemId);
                await this.removeItem(itemId);
            }
        });

        document.getElementById('checkout-btn')?.addEventListener('click', () => {
            this.proceedToCheckout();
        });
    }

    showLoginPrompt() {
        const cartItemsDiv = document.getElementById('cart-items');
        cartItemsDiv.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <p>Please log in to view your cart</p>
                <a href="login.html" class="btn-primary">Login</a>
            </div>
        `;
    }

    proceedToCheckout() {
        if (this.cartItems.length === 0) {
            alert('Your cart is empty');
            return;
        }
        window.location.href = 'checkout.html';
    }
}

// Initialize cart manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new CartManager();
});