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
            
            // Get the smallest size and its price (30ml as base)
            const basePrice = this.getBasePrice(product);
            const baseSize = this.getBaseSize(product);

            html += `
                <div class="product-card" data-product-id="${product.id}">
                    <img src="${mainImage}" alt="${product.name}" class="product-image">
                    <h3>${product.name}</h3>
                    <p class="product-description">${product.description?.substring(0, 80)}...</p>
                    
                    <div class="fragrance-notes-preview">
                        ${this.renderFragranceNotesPreview(product.fragrance_notes)}
                    </div>
                    
                    <div class="product-occasion">
                        ${this.renderOccasionTags(product.occasion)}
                    </div>
                    
                    <div class="home-price-section">
                        <div class="base-price">From R${basePrice}</div>
                        <div class="base-size">${baseSize}</div>
                    </div>
                    
                    <button class="btn-primary view-details-btn" 
                            data-product-id="${product.id}">
                        View Details & Sizes
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    getBasePrice(product) {
        // Get the smallest size price (30ml) or use base price
        if (product.size_variants && Object.keys(product.size_variants).length > 0) {
            const sizes = Object.keys(product.size_variants);
            const smallestSize = sizes.find(size => size.includes('30ml')) || sizes[0];
            return product.size_variants[smallestSize];
        }
        return product.price;
    }

    getBaseSize(product) {
        // Get the smallest size (30ml) or default
        if (product.size_variants && Object.keys(product.size_variants).length > 0) {
            const sizes = Object.keys(product.size_variants);
            return sizes.find(size => size.includes('30ml')) || sizes[0];
        }
        return '30ml';
    }

    renderFragranceNotesPreview(notes) {
        if (!notes) return '<div class="notes-placeholder">Fragrance notes available</div>';
        
        let html = '<div class="notes-preview">';
        if (notes.top && notes.top.length > 0) {
            html += `<span class="note-tag">${notes.top[0]}</span>`;
        }
        if (notes.middle && notes.middle.length > 0) {
            html += `<span class="note-tag">${notes.middle[0]}</span>`;
        }
        html += '</div>';
        return html;
    }

    renderOccasionTags(occasions) {
        if (!occasions || occasions.length === 0) return '';
        
        let html = '<div class="occasion-tags">';
        occasions.slice(0, 2).forEach(occasion => {
            html += `<span class="occasion-tag">${occasion}</span>`;
        });
        if (occasions.length > 2) {
            html += `<span class="occasion-tag-more">+${occasions.length - 2} more</span>`;
        }
        html += '</div>';
        return html;
    }

    setupEventListeners() {
        // Handle view details clicks
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('view-details-btn')) {
                e.preventDefault();
                const productId = e.target.dataset.productId;
                this.viewProductDetails(productId);
            }
        });
    }

    viewProductDetails(productId) {
        // Redirect to products page with the specific product highlighted
        // or create a product details modal
        window.location.href = `products.html?product=${productId}`;
    }
}

// Initialize home manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the home page
    if (document.getElementById('featured-products')) {
        console.log('Initializing HomeManager...');
        window.homeManager = new HomeManager();
    }
});