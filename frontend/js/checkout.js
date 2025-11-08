class CheckoutManager {
    constructor() {
        this.cartItems = [];
        this.currency = 'ZAR';
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
                    <div class="item-price">R${itemTotal.toFixed(2)}</div>
                </div>
            `;
        });

        orderItemsDiv.innerHTML = html;
        this.updateOrderTotals(subtotal);
    }

    updateOrderTotals(subtotal) {
        const shipping = 49.99; // ZAR shipping
        const tax = subtotal * 0.15; // 15% VAT
        const total = subtotal + shipping + tax;

        document.getElementById('order-subtotal').textContent = `R${subtotal.toFixed(2)}`;
        document.getElementById('order-shipping').textContent = `R${shipping.toFixed(2)}`;
        document.getElementById('order-tax').textContent = `R${tax.toFixed(2)}`;
        document.getElementById('order-total').textContent = `R${total.toFixed(2)}`;
        
        return total;
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
        messageDiv.textContent = 'Processing your order...';

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
            // First create the order in our database
            const order = await this.createOrderRecord(shippingData, total);
            
            // Redirect to PayFast
            await this.redirectToPayFast(order, total, shippingData);
            
        } catch (error) {
            console.error('Payment error:', error);
            messageDiv.textContent = 'An unexpected error occurred: ' + error.message;
            submitButton.disabled = false;
        }
    }

    calculateTotal() {
        const subtotal = this.cartItems.reduce((sum, item) => {
            const price = item.products.size_variants?.[item.size_variant] || item.products.price;
            return sum + (price * item.quantity);
        }, 0);
        
        // South African pricing
        const shipping = 49.99; // ZAR - typical SA shipping
        const tax = subtotal * 0.15; // 15% VAT in South Africa
        const total = subtotal + shipping + tax;
        
        return parseFloat(total.toFixed(2));
    }

    async createOrderRecord(shippingData, total) {
        const user = window.authManager.getCurrentUser();
        
        try {
            const { data: order, error } = await window.supabase
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
                            phone: shippingData.get('phone'),
                            country: 'South Africa'
                        },
                        status: 'pending_payment',
                        payment_status: 'pending',
                        payment_method: 'payfast'
                    }
                ])
                .select()
                .single();

            if (error) throw error;

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

            return order;

        } catch (error) {
            console.error('Error creating order record:', error);
            throw new Error('Could not create order');
        }
    }

    async redirectToPayFast(order, amount, shippingData) {
        const user = window.authManager.getCurrentUser();
        
        // Create return URLs
        const returnUrl = `${window.location.origin}/order-success.html?order_id=${order.id}`;
        const cancelUrl = `${window.location.origin}/checkout.html?cancelled=true&order_id=${order.id}`;
        
        // PayFast payment data - SIMPLIFIED VERSION
        const paymentData = {
            // 🔑 PAYFAST TEST CREDENTIALS
            merchant_id: '10043505',        // PayFast test merchant ID
            merchant_key: 'mezhxf8ti9t1l',  // PayFast test merchant key
            
            return_url: returnUrl,
            cancel_url: cancelUrl,
            // notify_url: `${window.location.origin}/.netlify/functions/payfast-notify`, // Remove for now
            
            // Buyer details
            name_first: (shippingData.get('firstName') || 'Test').substring(0, 100),
            name_last: (shippingData.get('lastName') || 'Customer').substring(0, 100),
            email_address: (shippingData.get('email') || user?.email || 'test@example.com').substring(0, 100),
            cell_number: (shippingData.get('phone') || '+27123456789').substring(0, 20),
            
            // Order details
            m_payment_id: order.id.toString(),
            amount: amount.toFixed(2),
            item_name: `Patriocele Fragrance Order #${order.id}`.substring(0, 100),
            item_description: `${this.cartItems.length} perfume item(s)`.substring(0, 255),
            
            // Custom data for tracking
            custom_int1: order.id,
            custom_str1: user.id
        };

        // Generate and redirect to PayFast
        const payfastUrl = this.generatePayFastUrl(paymentData);
        console.log('Redirecting to PayFast:', payfastUrl);
        window.location.href = payfastUrl;
    }

    generatePayFastUrl(paymentData) {
        // PayFast Sandbox URL for testing
        const baseUrl = 'https://sandbox.payfast.co.za/eng/process?';
        const params = new URLSearchParams();
        
        // Add all payment data as parameters
        Object.keys(paymentData).forEach(key => {
            if (paymentData[key] && paymentData[key] !== '') {
                params.append(key, paymentData[key].toString());
            }
        });
        
        const url = baseUrl + params.toString();
        console.log('Generated PayFast URL:', url);
        return url;
    }
}

// Initialize checkout manager
document.addEventListener('DOMContentLoaded', function() {
    new CheckoutManager();
});