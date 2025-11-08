class HomeManager {
    constructor() {
        this.featuredProducts = [];
        this.init();
    }

    async init() {
        await this.loadFeaturedProducts();
        this.setupEventListeners();
    }

    async loadFeaturedProducts() {
        try {
            const { data, error } = await window.supabase
                .from('products')
                .select('*')
                .eq('is_active', true)
                .limit(8);

            if (error) throw error;

            this.featuredProducts = data || [];
            this.renderFeaturedProducts();
        } catch (error) {
            console.error('Error loading featured products:', error);
        }
    }

    renderFeaturedProducts() {
        const container = document.getElementById('featured-products');
        if (!container) return;

        if (this.featuredProducts.length === 0) {
            container.innerHTML = '<p style="text-align: center;">No featured products available</p>';
            return;
        }

        let html = '';
        this.featuredProducts.forEach(product => {
            const mainImage = product.images?.[0] || 'https://via.placeholder.com/300x300?text=Perfume';
            const price = product.size_variants ? Object.values(product.size_variants)[0] : product.price;
            const firstSize = product.size_variants ? Object.keys(product.size_variants)[0] : '50ml';

            html += `
                <div class="product-card" data-product-id="${product.id}">
                    <img src="${mainImage}" alt="${product.name}" class="product-image">
                    <h3>${product.name}</h3>
                    <p class="product-description">${product.description?.substring(0, 60)}...</p>
                    <div class="price">R${price}</div>
                    <button class="btn-primary add-to-cart-btn" 
                            data-product-id="${product.id}"
                            data-size-variant="${firstSize}">
                        Add to Cart
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    setupEventListeners() {
        // Handle add to cart clicks
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('add-to-cart-btn')) {
                e.preventDefault();
                await this.handleAddToCart(
                    e.target.dataset.productId,
                    e.target.dataset.sizeVariant
                );
            }
        });
    }

    async handleAddToCart(productId, sizeVariant = '50ml') {
        const user = window.authManager?.getCurrentUser();
        
        if (!user) {
            alert('Please login to add items to cart');
            window.location.href = 'login.html';
            return;
        }

        try {
            // Check if item already in cart
            const { data: existingItem } = await window.supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('user_id', user.id)
                .eq('product_id', productId)
                .eq('size_variant', sizeVariant)
                .single();

            if (existingItem) {
                // Update quantity
                const { error } = await window.supabase
                    .from('cart_items')
                    .update({ quantity: existingItem.quantity + 1 })
                    .eq('id', existingItem.id);

                if (error) throw error;
            } else {
                // Add new item
                const { error } = await window.supabase
                    .from('cart_items')
                    .insert([
                        {
                            user_id: user.id,
                            product_id: parseInt(productId),
                            quantity: 1,
                            size_variant: sizeVariant
                        }
                    ]);

                if (error) throw error;
            }

            alert('Product added to cart!');
            
            // Update cart count in navbar
            if (window.authManager) {
                window.authManager.updateCartCount();
            }
            
        } catch (error) {
            console.error('Error adding to cart:', error);
            alert('Error adding product to cart: ' + error.message);
        }
    }
}

// Initialize home manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new HomeManager();
});