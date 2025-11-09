class ProductManager {
    constructor() {
        this.products = [];
        this.categories = [];
        this.brands = [];
        this.eventListenersAttached = false;
        this.init();
    }

    async init() {
        console.log('🔄 Initializing ProductManager...');
        await this.loadCategories();
        await this.loadBrands();
        await this.loadProducts();
        this.setupEventListeners();
        this.handleProductParameter();
    }

    async loadCategories() {
        console.log('📂 Loading categories...');
        try {
            const { data, error } = await window.supabase
                .from('categories')
                .select('*')
                .order('name');

            if (error) throw error;

            this.categories = data || [];
            this.renderCategories();
        } catch (error) {
            console.error('❌ Error loading categories:', error);
        }
    }

    async loadBrands() {
        console.log('📂 Loading brands...');
        try {
            const { data, error } = await window.supabase
                .from('brands')
                .select('*')
                .order('name');

            if (error) throw error;

            this.brands = data || [];
            this.renderBrands();
        } catch (error) {
            console.error('❌ Error loading brands:', error);
        }
    }

    async loadProducts(filters = {}) {
        console.log('📂 Loading products...', filters);
        try {
            let query = window.supabase
                .from('products')
                .select(`
                    *,
                    brands(name),
                    categories(name)
                `)
                .eq('is_active', true);

            if (filters.category) {
                query = query.eq('category_id', filters.category);
            }

            if (filters.brand) {
                query = query.eq('brand_id', filters.brand);
            }

            if (filters.search) {
                query = query.ilike('name', `%${filters.search}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            this.products = data || [];
            this.renderProducts();
        } catch (error) {
            console.error('❌ Error loading products:', error);
        }
    }

    renderCategories() {
        const select = document.getElementById('category-filter');
        if (!select) return;
        
        // Clear existing options except the first one
        while (select.options.length > 1) {
            select.remove(1);
        }

        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            select.appendChild(option);
        });
    }

    renderBrands() {
        const select = document.getElementById('brand-filter');
        if (!select) return;
        
        // Clear existing options except the first one
        while (select.options.length > 1) {
            select.remove(1);
        }

        this.brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand.id;
            option.textContent = brand.name;
            select.appendChild(option);
        });
    }

    renderProducts() {
        const grid = document.getElementById('products-grid');
        if (!grid) return;
        
        console.log('🎨 Rendering products:', this.products.length);

        if (this.products.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <p style="font-size: 1.2rem; color: var(--text-light);">No products found</p>
                    <p style="margin-top: 0.5rem;">Try adjusting your filters</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.products.forEach(product => {
            const productCard = this.createProductCard(product);
            html += productCard.outerHTML || productCard;
        });

        grid.innerHTML = html;
    }

    createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        const mainImage = product.images?.[0] || 'https://via.placeholder.com/300x300?text=Perfume';
        const sizes = product.size_variants ? Object.keys(product.size_variants) : [];
        const firstSize = sizes.length > 0 ? sizes[0] : '50ml';
        const firstPrice = firstSize ? product.size_variants[firstSize] : product.price;

        card.innerHTML = `
            <img src="${mainImage}" alt="${product.name}" class="product-image">
            <h3>${product.name}</h3>
            <p class="brand">${product.brands?.name || 'Unknown Brand'}</p>
            <div class="fragrance-notes">
                ${this.renderFragranceNotes(product.fragrance_notes)}
            </div>
            <div class="price">R${firstPrice}</div>
            <div class="size-variants">
                ${this.renderSizeVariants(product.size_variants)}
            </div>
            <button class="btn-primary add-to-cart-btn" 
                    data-product-id="${product.id}"
                    data-size-variant="${firstSize}">
                Add to Cart
            </button>
        `;

        return card;
    }

    renderFragranceNotes(notes) {
        if (!notes) return '';
        
        let html = '<div class="notes-preview">';
        if (notes.top && notes.top.length > 0) {
            html += `<strong>Top:</strong> ${notes.top.join(', ')}<br>`;
        }
        if (notes.middle && notes.middle.length > 0) {
            html += `<strong>Middle:</strong> ${notes.middle.join(', ')}`;
        }
        html += '</div>';
        return html;
    }

    renderSizeVariants(sizeVariants) {
        if (!sizeVariants) return '';
        
        let html = '<select class="size-select">';
        Object.keys(sizeVariants).forEach(size => {
            html += `<option value="${size}">${size} - R${sizeVariants[size]}</option>`;
        });
        html += '</select>';
        return html;
    }

    async addToCart(productId, sizeVariant = '50ml') {
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
            console.error('❌ Error adding to cart:', error);
            alert('Error adding product to cart: ' + error.message);
        }
    }

    setupEventListeners() {
        // Only attach listeners once
        if (this.eventListenersAttached) {
            console.log('✅ Product manager event listeners already attached, skipping...');
            return;
        }

        console.log('🔧 Setting up product manager event listeners...');

        // Handle filter changes
        const categoryFilter = document.getElementById('category-filter');
        const brandFilter = document.getElementById('brand-filter');
        const searchInput = document.getElementById('search-input');

        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.applyFilters();
            });
        }

        if (brandFilter) {
            brandFilter.addEventListener('change', (e) => {
                this.applyFilters();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.applyFilters();
            });
        }

        // Handle add to cart clicks with event delegation
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('add-to-cart-btn')) {
                e.preventDefault();
                e.stopPropagation(); // Prevent multiple executions
                
                console.log('🛒 Add to cart clicked - product manager');
                await this.addToCart(
                    e.target.dataset.productId,
                    e.target.dataset.sizeVariant
                );
            }
        });

        // Handle size selection changes
        document.addEventListener('change', async (e) => {
            if (e.target.classList.contains('size-select')) {
                const productCard = e.target.closest('.product-card');
                const productId = productCard?.dataset?.productId;
                const addToCartBtn = productCard?.querySelector('.add-to-cart-btn');
                
                if (productId && addToCartBtn) {
                    addToCartBtn.dataset.sizeVariant = e.target.value;
                    console.log('📦 Size changed to:', e.target.value);
                }
            }
        });

        this.eventListenersAttached = true;
        console.log('✅ Product manager event listeners attached');
    }

    applyFilters() {
        const filters = {
            category: document.getElementById('category-filter')?.value || '',
            brand: document.getElementById('brand-filter')?.value || '',
            search: document.getElementById('search-input')?.value || ''
        };

        console.log('🔍 Applying filters:', filters);
        this.loadProducts(filters);
    }

    handleProductParameter() {
        // Check if a specific product was requested via URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('product');
        
        if (productId) {
            console.log('🎯 Specific product requested:', productId);
            // Scroll to and highlight the specific product
            this.highlightProduct(productId);
        }
    }

    highlightProduct(productId) {
        // This will be called after products are rendered
        setTimeout(() => {
            const productCard = document.querySelector(`[data-product-id="${productId}"]`);
            if (productCard) {
                productCard.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
                
                // Add highlight effect
                productCard.style.boxShadow = '0 0 0 3px var(--secondary-color)';
                productCard.style.transition = 'box-shadow 0.3s ease';
                
                setTimeout(() => {
                    productCard.style.boxShadow = '';
                }, 3000);
            }
        }, 1000);
    }
}

// Initialize product manager when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the products page
    if (document.getElementById('products-grid')) {
        console.log('🚀 Initializing ProductManager...');
        window.productManager = new ProductManager();
    }
});