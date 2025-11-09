class ProductManager {
    constructor() {
        this.products = [];
        this.categories = [];
        this.brands = [];
        this.eventListenersAttached = false;
        this.init();
    }

    async init() {
        await this.loadCategories();
        await this.loadBrands();
        await this.loadProducts();
        this.setupEventListeners();
    }

    // ... (keep all your existing methods the same until setupEventListeners)

    setupEventListeners() {
        // Only attach listeners once
        if (this.eventListenersAttached) {
            console.log('Product manager event listeners already attached, skipping...');
            return;
        }

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
                
                console.log('Add to cart clicked - product manager');
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
                }
            }
        });

        this.eventListenersAttached = true;
        console.log('Product manager event listeners attached');
    }

    // ... (rest of your methods remain the same)
}

// Initialize product manager when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the products page
    if (document.getElementById('products-grid')) {
        console.log('Initializing ProductManager...');
        new ProductManager();
    }
});