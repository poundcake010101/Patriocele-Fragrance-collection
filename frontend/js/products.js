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
        this.handleProductParameter();
    }

    async loadCategories() {
        try {
            const { data, error } = await window.supabase.from('categories').select('*').order('name');
            if (error) throw error;
            this.categories = data || [];
            this.renderCategories();
        } catch (err) { console.error('Error loading categories:', err); }
    }

    async loadBrands() {
        try {
            const { data, error } = await window.supabase.from('brands').select('*').order('name');
            if (error) throw error;
            this.brands = data || [];
            this.renderBrands();
        } catch (err) { console.error('Error loading brands:', err); }
    }

    async loadProducts(filters = {}) {
        try {
            let query = window.supabase
                .from('products')
                .select('*, brands(name), categories(name)')
                .eq('is_active', true);

            if (filters.category) query = query.eq('category_id', filters.category);
            if (filters.brand)    query = query.eq('brand_id', filters.brand);
            if (filters.search)   query = query.ilike('name', `%${filters.search}%`);

            const { data, error } = await query;
            if (error) throw error;
            this.products = data || [];
            this.renderProducts();
        } catch (err) { console.error('Error loading products:', err); }
    }

    renderCategories() {
        const select = document.getElementById('category-filter');
        if (!select) return;
        while (select.options.length > 1) select.remove(1);
        this.categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id; opt.textContent = c.name;
            select.appendChild(opt);
        });
    }

    renderBrands() {
        const select = document.getElementById('brand-filter');
        if (!select) return;
        while (select.options.length > 1) select.remove(1);
        this.brands.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id; opt.textContent = b.name;
            select.appendChild(opt);
        });
    }

    renderProducts() {
        const grid = document.getElementById('products-grid');
        if (!grid) return;

        if (!this.products.length) {
            grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:4rem 2rem;">
                    <div style="font-family:'Cormorant Garamond',serif;font-size:1.5rem;font-weight:300;color:var(--text-mid);margin-bottom:0.75rem;">No products found</div>
                    <p style="font-size:0.85rem;color:var(--text-light);">Try adjusting your filters</p>
                </div>`;
            return;
        }

        grid.innerHTML = this.products.map(p => this._cardHTML(p)).join('');
    }

    _cardHTML(p) {
        const img   = p.images?.[0] || 'https://via.placeholder.com/400x400?text=Perfume';
        const brand = p.brands?.name || '';
        const price = this._basePrice(p);
        const size  = this._baseSize(p);

        return `
            <div class="product-card home-product-card" data-product-id="${p.id}" style="cursor:pointer;">
                <div style="position:relative;overflow:hidden;border-radius:2px;margin-bottom:1rem;">
                    <img src="${img}" 
                         alt="${p.name}" 
                         class="product-image home-card-img"
                         style="width:100%;height:240px;object-fit:cover;display:block;transition:transform 0.4s ease;">
                    <div style="position:absolute;inset:0;background:rgba(44,35,24,0);transition:background 0.3s;" class="home-card-overlay"></div>
                </div>
                <div style="padding:0 0.25rem;">
                    <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;font-weight:400;color:var(--text-dark);margin-bottom:0.2rem;text-align:left;">${p.name}</h3>
                    <div style="font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-light);margin-bottom:0.75rem;">${brand}</div>
                    <div style="display:flex;align-items:baseline;justify-content:space-between;">
                        <div>
                            <span style="font-size:1.1rem;font-weight:500;color:var(--primary);">R${parseFloat(price).toFixed(2)}</span>
                            <span style="font-size:0.72rem;color:var(--text-light);margin-left:0.4rem;">${size}</span>
                        </div>
                        ${p.intensity ? `<span style="font-size:0.65rem;letter-spacing:0.15em;text-transform:uppercase;background:var(--cream);border:1px solid var(--border);color:var(--text-mid);padding:0.2rem 0.5rem;border-radius:2px;">${p.intensity}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    _basePrice(p) {
        if (p.size_variants && Object.keys(p.size_variants).length) {
            const sizes = Object.keys(p.size_variants);
            const s30 = sizes.find(s => s.includes('30'));
            return p.size_variants[s30 || sizes[0]];
        }
        return p.price || 0;
    }

    _baseSize(p) {
        if (p.size_variants && Object.keys(p.size_variants).length) {
            const sizes = Object.keys(p.size_variants);
            return sizes.find(s => s.includes('30')) || sizes[0];
        }
        return '50ml';
    }

    setupEventListeners() {
        if (this.eventListenersAttached) return;

        // Card click → detail modal
        document.addEventListener('click', e => {
            const card = e.target.closest('.home-product-card');
            if (!card) return;
            const productId = card.dataset.productId;
            const product   = this.products.find(p => String(p.id) === String(productId));
            if (product && window.ProductDetailModal) window.ProductDetailModal.open(product);
        });

        // Hover effects
        document.addEventListener('mouseover', e => {
            const card = e.target.closest('.home-product-card');
            if (!card) return;
            const img     = card.querySelector('.home-card-img');
            const overlay = card.querySelector('.home-card-overlay');
            if (img)     img.style.transform = 'scale(1.04)';
            if (overlay) overlay.style.background = 'rgba(44,35,24,0.12)';
        });

        document.addEventListener('mouseout', e => {
            const card = e.target.closest('.home-product-card');
            if (!card) return;
            const img     = card.querySelector('.home-card-img');
            const overlay = card.querySelector('.home-card-overlay');
            if (img)     img.style.transform = 'scale(1)';
            if (overlay) overlay.style.background = 'rgba(44,35,24,0)';
        });

        // Modal wiring (close, arrows, add to cart, keyboard)
        document.getElementById('pdm-close')?.addEventListener('click', () => window.ProductDetailModal.close());
        document.getElementById('product-detail-modal')?.addEventListener('click', e => {
            if (e.target === e.currentTarget) window.ProductDetailModal.close();
        });
        document.getElementById('pdm-prev')?.addEventListener('click', e => { e.stopPropagation(); window.ProductDetailModal.prev(); });
        document.getElementById('pdm-next')?.addEventListener('click', e => { e.stopPropagation(); window.ProductDetailModal.next(); });

        document.getElementById('pdm-add-to-cart')?.addEventListener('click', async () => {
            const btn = document.getElementById('pdm-add-to-cart');
            await this._addToCart(btn.dataset.productId, btn.dataset.sizeVariant, btn);
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape')      window.ProductDetailModal.close();
            if (e.key === 'ArrowLeft')   window.ProductDetailModal.prev();
            if (e.key === 'ArrowRight')  window.ProductDetailModal.next();
        });

        // Filters
        document.getElementById('category-filter')?.addEventListener('change', () => this.applyFilters());
        document.getElementById('brand-filter')?.addEventListener('change',    () => this.applyFilters());
        document.getElementById('search-input')?.addEventListener('input',     () => this.applyFilters());

        this.eventListenersAttached = true;
    }

    async _addToCart(productId, sizeVariant, btn) {
        const user = window.authManager?.getCurrentUser();
        if (!user) {
            alert('Please login to add items to cart.');
            window.location.href = 'login.html';
            return;
        }

        const original = btn.textContent;
        btn.textContent = 'Adding…';
        btn.disabled    = true;

        try {
            const { data: existing } = await window.supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('user_id', user.id)
                .eq('product_id', productId)
                .eq('size_variant', sizeVariant)
                .single();

            if (existing) {
                await window.supabase.from('cart_items')
                    .update({ quantity: existing.quantity + 1 })
                    .eq('id', existing.id);
            } else {
                await window.supabase.from('cart_items')
                    .insert([{ user_id: user.id, product_id: parseInt(productId), quantity: 1, size_variant: sizeVariant }]);
            }

            btn.textContent = 'Added!';
            btn.style.background = 'var(--accent-green)';
            window.authManager?.updateCartCount?.();

            setTimeout(() => {
                btn.textContent = original;
                btn.style.background = '';
                btn.disabled = false;
            }, 1500);
        } catch (err) {
            console.error('Cart error:', err);
            btn.textContent = original;
            btn.disabled    = false;
            alert('Error adding to cart: ' + err.message);
        }
    }

    applyFilters() {
        this.loadProducts({
            category: document.getElementById('category-filter')?.value || '',
            brand:    document.getElementById('brand-filter')?.value    || '',
            search:   document.getElementById('search-input')?.value    || '',
        });
    }

    handleProductParameter() {
        const productId = new URLSearchParams(window.location.search).get('product');
        if (!productId) return;
        setTimeout(() => {
            const product = this.products.find(p => String(p.id) === String(productId));
            if (product && window.ProductDetailModal) {
                window.ProductDetailModal.open(product);
            } else {
                // Fallback: scroll to card
                const card = document.querySelector(`[data-product-id="${productId}"]`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.style.outline = '2px solid var(--gold)';
                    setTimeout(() => card.style.outline = '', 2500);
                }
            }
        }, 800);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('products-grid')) {
        window.productManager = new ProductManager();
    }
});