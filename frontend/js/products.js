class ProductManager {
    constructor() {
        this.products = [];
        this.categories = [];
        this.brands = [];
        this.init();
    }

    async init() {
        await this.loadCategories();
        await this.loadBrands();
        await this.loadProducts();
        this.setupEventListeners();
    }

    async loadCategories() {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name');

        if (!error) {
            this.categories = data;
            this.renderCategories();
        }
    }

    async loadBrands() {
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .order('name');

        if (!error) {
            this.brands = data;
            this.renderBrands();
        }
    }

    async loadProducts(filters = {}) {
        let query = supabase
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

        if (!error) {
            this.products = data;
            this.renderProducts();
        }
    }
    async loadFeaturedProducts() {
        const { data, error } = await window.supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .limit(8);

        if (!error && data) {
            this.renderFeaturedProducts(data);
        }
    }

    renderCategories() {
        const select = document.getElementById('category-filter');
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            select.appendChild(option);
        });
    }

    renderBrands() {
        const select = document.getElementById('brand-filter');
        this.brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand.id;
            option.textContent = brand.name;
            select.appendChild(option);
        });
    }

    renderProducts() {
        const grid = document.getElementById('products-grid');
        grid.innerHTML = '';

        this.products.forEach(product => {
            const productCard = this.createProductCard(product);
            grid.appendChild(productCard);
        });
    }
    
     renderFeaturedProducts(products) {
        const featuredSection = document.getElementById('featured-products');
        if (!featuredSection) return;

        let html = '<h2>Featured Fragrances</h2><div class="products-grid">';
        
        products.forEach(product => {
            const mainImage = product.images?.[0] || 'https://via.placeholder.com/300x300?text=Perfume';
            const price = product.size_variants ? Object.values(product.size_variants)[0] : product.price;

            html += `
                <div class="product-card">
                    <img src="${mainImage}" alt="${product.name}" class="product-image">
                    <h3>${product.name}</h3>
                    <div class="price">$${price}</div>
                    <button class="btn-primary add-to-cart" data-product-id="${product.id}">
                        Add to Cart
                    </button>
                </div>
            `;
        });

        html += '</div>';
        featuredSection.innerHTML = html;
    }

    createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        const mainImage = product.images && product.images.length > 0 
            ? product.images[0] 
            : 'https://via.placeholder.com/300x300?text=Perfume';

        const sizes = product.size_variants ? Object.keys(product.size_variants) : [];
        const firstSize = sizes.length > 0 ? sizes[0] : null;
        const firstPrice = firstSize ? product.size_variants[firstSize] : product.price;

        card.innerHTML = `
            <img src="${mainImage}" alt="${product.name}" class="product-image">
            <h3>${product.name}</h3>
            <p class="brand">${product.brands?.name || 'Unknown Brand'}</p>
            <div class="fragrance-notes">
                ${this.renderFragranceNotes(product.fragrance_notes)}
            </div>
            <div class="price">$${firstPrice}</div>
            <div class="size-variants">
                ${this.renderSizeVariants(product.size_variants)}
            </div>
            <button class="btn-primary add-to-cart" data-product-id="${product.id}">
                Add to Cart
            </button>
        `;

        // Add event listener to add-to-cart button
        card.querySelector('.add-to-cart').addEventListener('click', () => {
            this.addToCart(product.id, firstSize);
        });

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
            html += `<option value="${size}">${size} - $${sizeVariants[size]}</option>`;
        });
        html += '</select>';
        return html;
    }

    async addToCart(productId, sizeVariant = '50ml') {
        const user = authManager.getCurrentUser();
        
        if (!user) {
            alert('Please login to add items to cart');
            window.location.href = 'login.html';
            return;
        }

        try {
            // Check if item already in cart
            const { data: existingItem } = await supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('user_id', user.id)
                .eq('product_id', productId)
                .eq('size_variant', sizeVariant)
                .single();

            if (existingItem) {
                // Update quantity
                const { error } = await supabase
                    .from('cart_items')
                    .update({ quantity: existingItem.quantity + 1 })
                    .eq('id', existingItem.id);

                if (error) throw error;
            } else {
                // Add new item
                const { error } = await supabase
                    .from('cart_items')
                    .insert([
                        {
                            user_id: user.id,
                            product_id: productId,
                            quantity: 1,
                            size_variant: sizeVariant
                        }
                    ]);

                if (error) throw error;
            }

            alert('Product added to cart!');
            authManager.updateCartCount();
        } catch (error) {
            console.error('Error adding to cart:', error);
            alert('Error adding product to cart');
        }
    }

    setupEventListeners() {
        document.getElementById('category-filter').addEventListener('change', (e) => {
            this.applyFilters();
        });

        document.getElementById('brand-filter').addEventListener('change', (e) => {
            this.applyFilters();
        });

        document.getElementById('search-input').addEventListener('input', (e) => {
            this.applyFilters();
        });
    }

    applyFilters() {
        const filters = {
            category: document.getElementById('category-filter').value,
            brand: document.getElementById('brand-filter').value,
            search: document.getElementById('search-input').value
        };

        this.loadProducts(filters);
    }
}

// Initialize product manager when page loads
document.addEventListener('DOMContentLoaded', function() {
    new ProductManager();
});