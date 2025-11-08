class CheckoutManager {
    constructor() {
        this.cartItems = [];
        this.stripe = null;
        this.elements = null;
        this.init();
    }

    async init() {
        // Wait for auth to be ready
        await window.authManager.waitForAuth();
        
        if (!window.authManager.isUserLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }

        await this.loadCartItems();
        this.setupStripe();
        this.setupEventListeners();
        this.prefillUserInfo();
    }

    async loadCartItems() {
        const user = window.authManager.getCurrentUser();
        
        try {
            const { data, error } = await window.supabase
                .from('cart_items')
                .select(`
                    *,
                    products (
                        name,
                        price,
                        size_variants,
                        images,
                        stock_quantity
                    )
                `)
                .eq('user_id', user.id);

            if (error) throw error;

            this.cartItems = data || [];
            
            // Check stock availability
            const outOfStockItems = this.cartItems.filter(item => 
                item.products.stock_quantity < item.quantity
            );
            
            if (outOfStockItems.length > 0) {
                alert('Some items in your cart are out of stock. Please update your cart.');
                window.location.href = 'cart.html';
                return;
            }

            this.renderOrderSummary();
        } catch (error) {
            console.error('Error loading cart:', error);
        }
    }

    renderOrderSummary() {
        const orderItemsDiv = document.getElementById('order-items');
        let subtotal = 0;

        let html = '';
        this.cartItems.forEach(item => {
            const product = item.products;
            const price = product.size_variants?.[item.size_variant] || product.price;
            const itemTotal = price * item.quantity;
            subtotal += itemTotal;

            html += `
                <div class="checkout-item">
                    <img src="${product.images?.[0] || 'https://via.placeholder.com/60x60?text=Perfume'}" 
                         alt="${product.name}" 
                         style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
                    <div style="flex: 1;">
                        <h4>${product.name}</h4>
                        <p>Size: ${item.size_variant} × ${item.quantity}</p>
                    </div>
                    <div class="item-price">$${itemTotal.toFixed(2)}</div>
                </div>
            `;
        });

        orderItemsDiv.innerHTML = html;
        this.updateOrderTotals(subtotal);
    }

    updateOrderTotals(subtotal) {
        const shipping = 5.99;
        const tax = subtotal * 0.08;
        const total = subtotal + shipping + tax;

        document.getElementById('order-subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('order-tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('order-total').textContent = `$${total.toFixed(2)}`;
        
        return total;
    }

    setupStripe() {
        // For now, we'll use test mode. Replace with your actual Stripe publishable key
        this.stripe = Stripe('pk_test_51Q...'); // You'll get this from Stripe dashboard
        this.elements = this.stripe.elements();
        
        // Create payment element
        const appearance = {
            theme: 'stripe',
        };
        
        const options = {
            layout: {
                type: 'tabs',
                defaultCollapsed: false,
            }
        };

        const paymentElement = this.elements.create('payment', {
            appearance,
            options
        });
        
        paymentElement.mount('#payment-element');
    }

    setupEventListeners() {
        document.getElementById('submit-payment').addEventListener('click', (e) => {
            e.preventDefault();
            this.handlePayment();
        });
    }

    prefillUserInfo() {
        const user = window.authManager.getCurrentUser();
        if (user && user.email) {
            document.getElementById('email').value = user.email;
        }
    }

    async handlePayment() {
        const submitButton = document.getElementById('submit-payment');
        const messageDiv = document.getElementById('payment-message');
        
        submitButton.disabled = true;
        messageDiv.textContent = 'Processing payment...';

        // Validate shipping form
        const shippingForm = document.getElementById('shipping-form');
        if (!shippingForm.checkValidity()) {
            shippingForm.reportValidity();
            submitButton.disabled = false;
            messageDiv.textContent = '';
            return;
        }

        const shippingData = new FormData(shippingForm);
        const total = this.calculateTotal();

        try {
            // In a real app, you'd call your backend to create a payment intent
            // For now, we'll simulate the process
            const { error } = await this.stripe.confirmPayment({
                elements: this.elements,
                confirmParams: {
                    return_url: `${window.location.origin}/order-success.html`,
                },
                redirect: 'if_required'
            });

            if (error) {
                messageDiv.textContent = error.message;
                submitButton.disabled = false;
                return;
            }

            // If we get here, payment was successful
            await this.createOrder(shippingData, total);
            
        } catch (error) {
            console.error('Payment error:', error);
            messageDiv.textContent = 'An unexpected error occurred.';
            submitButton.disabled = false;
        }
    }

    calculateTotal() {
        const subtotal = this.cartItems.reduce((sum, item) => {
            const price = item.products.size_variants?.[item.size_variant] || item.products.price;
            return sum + (price * item.quantity);
        }, 0);
        
        return subtotal + 5.99 + (subtotal * 0.08); // subtotal + shipping + tax
    }

    async createOrder(shippingData, total) {
        const user = window.authManager.getCurrentUser();
        
        try {
            // Create order
            const { data: order, error: orderError } = await window.supabase
                .from('orders')
                .insert([
                    {
                        user_id: user.id,
                        total_amount: total,
                        shipping_address: {
                            firstName: shippingData.get('firstName'),
                            lastName: shippingData.get('lastName'),
                            email: shippingData.get('email'),
                            address: shippingData.get('address'),
                            city: shippingData.get('city'),
                            state: shippingData.get('state'),
                            zipCode: shippingData.get('zipCode'),
                            phone: shippingData.get('phone')
                        },
                        status: 'confirmed',
                        payment_status: 'paid'
                    }
                ])
                .select()
                .single();

            if (orderError) throw orderError;

            // Create order items
            const orderItems = this.cartItems.map(item => {
                const price = item.products.size_variants?.[item.size_variant] || item.products.price;
                return {
                    order_id: order.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    unit_price: price,
                    size_variant: item.size_variant
                };
            });

            const { error: itemsError } = await window.supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // Update product stock
            for (const item of this.cartItems) {
                const { error: stockError } = await window.supabase
                    .from('products')
                    .update({ 
                        stock_quantity: item.products.stock_quantity - item.quantity 
                    })
                    .eq('id', item.product_id);

                if (stockError) throw stockError;
            }

            // Clear cart
            const { error: cartError } = await window.supabase
                .from('cart_items')
                .delete()
                .eq('user_id', user.id);

            if (cartError) throw cartError;

            // Redirect to success page
            window.location.href = `order-success.html?order_id=${order.id}`;

        } catch (error) {
            console.error('Order creation error:', error);
            document.getElementById('payment-message').textContent = 
                'Error creating order. Please try again.';
            document.getElementById('submit-payment').disabled = false;
        }
    }
}

// Initialize checkout manager
document.addEventListener('DOMContentLoaded', function() {
    new CheckoutManager();
});