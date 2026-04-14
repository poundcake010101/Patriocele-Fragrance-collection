// ========== SHARED PRODUCT DETAIL MODAL ==========
// Used by both home.js and products.js

window.ProductDetailModal = {
    currentImages: [],
    currentImageIndex: 0,
    currentProduct: null,

    open(product) {
        this.currentProduct = product;
        this.currentImages = product.images?.length ? product.images : ['https://via.placeholder.com/600x600?text=No+Image'];
        this.currentImageIndex = 0;

        const modal = document.getElementById('product-detail-modal');
        if (!modal) { console.error('product-detail-modal not found'); return; }

        // Image
        this._setMainImage(this.currentImages[0]);
        this._renderThumbnails();

        // Text
        document.getElementById('pdm-name').textContent        = product.name || '';
        document.getElementById('pdm-brand').textContent       = product.brands?.name || product.brand || '';
        document.getElementById('pdm-description').textContent = product.description || '';
        document.getElementById('pdm-intensity').textContent   = product.intensity || '';

        // Fragrance notes
        this._renderNotes(product.fragrance_notes);

        // Occasion tags
        this._renderOccasions(product.occasion);

        // Size + price
        this._renderSizes(product);

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },

    close() {
        const modal = document.getElementById('product-detail-modal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
    },

    _setMainImage(src) {
        const el = document.getElementById('pdm-main-image');
        if (el) el.src = src;
    },

    _renderThumbnails() {
        const strip = document.getElementById('pdm-thumbnails');
        if (!strip) return;
        strip.innerHTML = this.currentImages.map((src, i) => `
            <img src="${src}" 
                 class="pdm-thumb${i === 0 ? ' active' : ''}" 
                 data-index="${i}"
                 style="width:64px;height:64px;object-fit:cover;border-radius:2px;cursor:pointer;border:2px solid ${i === 0 ? 'var(--gold)' : 'var(--border)'};transition:border-color 0.2s;"
                 alt="view ${i+1}">
        `).join('');
        strip.querySelectorAll('.pdm-thumb').forEach(img => {
            img.addEventListener('click', () => {
                this.currentImageIndex = parseInt(img.dataset.index);
                this._setMainImage(this.currentImages[this.currentImageIndex]);
                strip.querySelectorAll('.pdm-thumb').forEach(t => t.style.borderColor = 'var(--border)');
                img.style.borderColor = 'var(--gold)';
            });
        });
    },

    _renderNotes(notes) {
        const el = document.getElementById('pdm-notes');
        if (!el) return;
        if (!notes) { el.innerHTML = ''; return; }
        const sections = [];
        if (notes.top?.length)    sections.push(`<div><span style="font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-light);font-weight:500;">Top</span><div style="margin-top:0.3rem;display:flex;flex-wrap:wrap;gap:0.4rem;">${notes.top.map(n=>`<span class="note-tag">${n}</span>`).join('')}</div></div>`);
        if (notes.middle?.length) sections.push(`<div><span style="font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-light);font-weight:500;">Heart</span><div style="margin-top:0.3rem;display:flex;flex-wrap:wrap;gap:0.4rem;">${notes.middle.map(n=>`<span class="note-tag">${n}</span>`).join('')}</div></div>`);
        if (notes.base?.length)   sections.push(`<div><span style="font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-light);font-weight:500;">Base</span><div style="margin-top:0.3rem;display:flex;flex-wrap:wrap;gap:0.4rem;">${notes.base.map(n=>`<span class="note-tag">${n}</span>`).join('')}</div></div>`);
        el.innerHTML = sections.join('');
    },

    _renderOccasions(occasions) {
        const el = document.getElementById('pdm-occasions');
        if (!el) return;
        if (!occasions?.length) { el.innerHTML = ''; return; }
        el.innerHTML = occasions.map(o => `<span class="occasion-tag">${o}</span>`).join('');
    },

    _renderSizes(product) {
        const priceEl   = document.getElementById('pdm-price');
        const sizesEl   = document.getElementById('pdm-sizes');
        const addBtn    = document.getElementById('pdm-add-to-cart');

        const variants  = product.size_variants;
        const hasVariants = variants && Object.keys(variants).length > 0;

        if (hasVariants) {
            const firstSize  = Object.keys(variants)[0];
            const firstPrice = variants[firstSize];

            if (priceEl) priceEl.textContent = `R${parseFloat(firstPrice).toFixed(2)}`;

            if (sizesEl) {
                sizesEl.innerHTML = Object.entries(variants).map(([size, price], i) => `
                    <button class="pdm-size-btn${i === 0 ? ' selected' : ''}" 
                            data-size="${size}" data-price="${price}"
                            style="padding:0.5rem 1rem;border:1px solid ${i === 0 ? 'var(--gold)' : 'var(--border)'};background:${i === 0 ? 'var(--dark)' : 'var(--white)'};color:${i === 0 ? 'var(--gold)' : 'var(--text-dark)'};border-radius:2px;cursor:pointer;font-family:'Jost',sans-serif;font-size:0.8rem;transition:all 0.2s;">
                        ${size}
                    </button>
                `).join('');

                sizesEl.querySelectorAll('.pdm-size-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        sizesEl.querySelectorAll('.pdm-size-btn').forEach(b => {
                            b.style.border = '1px solid var(--border)';
                            b.style.background = 'var(--white)';
                            b.style.color = 'var(--text-dark)';
                        });
                        btn.style.border = '1px solid var(--gold)';
                        btn.style.background = 'var(--dark)';
                        btn.style.color = 'var(--gold)';
                        if (priceEl) priceEl.textContent = `R${parseFloat(btn.dataset.price).toFixed(2)}`;
                        if (addBtn)  addBtn.dataset.sizeVariant = btn.dataset.size;
                    });
                });
            }

            if (addBtn) {
                addBtn.dataset.productId   = product.id;
                addBtn.dataset.sizeVariant = firstSize;
            }
        } else {
            // No variants — just a flat price
            if (priceEl) priceEl.textContent = `R${parseFloat(product.price || 0).toFixed(2)}`;
            if (sizesEl) sizesEl.innerHTML   = '';
            if (addBtn) {
                addBtn.dataset.productId   = product.id;
                addBtn.dataset.sizeVariant = '50ml';
            }
        }
    },

    prev() {
        if (this.currentImages.length <= 1) return;
        this.currentImageIndex = (this.currentImageIndex - 1 + this.currentImages.length) % this.currentImages.length;
        this._setMainImage(this.currentImages[this.currentImageIndex]);
        this._syncThumb();
    },

    next() {
        if (this.currentImages.length <= 1) return;
        this.currentImageIndex = (this.currentImageIndex + 1) % this.currentImages.length;
        this._setMainImage(this.currentImages[this.currentImageIndex]);
        this._syncThumb();
    },

    _syncThumb() {
        const strip = document.getElementById('pdm-thumbnails');
        if (!strip) return;
        strip.querySelectorAll('.pdm-thumb').forEach((t, i) => {
            t.style.borderColor = i === this.currentImageIndex ? 'var(--gold)' : 'var(--border)';
        });
    }
};

// ========== HOME MANAGER ==========
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
                .select('*, brands(name), categories(name)')
                .eq('is_active', true)
                .limit(8);

            if (error) throw error;
            this.featuredProducts = data || [];
            this.renderFeaturedProducts();
        } catch (err) {
            console.error('Error loading featured products:', err);
        }
    }

    renderFeaturedProducts() {
        const container = document.getElementById('featured-products');
        if (!container) return;

        if (!this.featuredProducts.length) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-light);">No products available yet.</p>';
            return;
        }

        container.innerHTML = this.featuredProducts.map(p => this._cardHTML(p)).join('');
    }

    _cardHTML(p) {
        const img     = p.images?.[0] || 'https://via.placeholder.com/400x400?text=Perfume';
        const brand   = p.brands?.name || p.brand || '';
        const price   = this._basePrice(p);
        const size    = this._baseSize(p);

        return `
            <div class="product-card home-product-card" data-product-id="${p.id}" style="cursor:pointer;">
                <div class="home-card-img-wrap" style="position:relative;overflow:hidden;border-radius:2px;margin-bottom:1rem;">
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
            const s30   = sizes.find(s => s.includes('30'));
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
        // Card click → open detail modal
        document.addEventListener('click', e => {
            const card = e.target.closest('.home-product-card');
            if (!card) return;
            const productId = card.dataset.productId;
            const product   = this.featuredProducts.find(p => String(p.id) === String(productId));
            if (product) window.ProductDetailModal.open(product);
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

        // Modal close
        document.getElementById('pdm-close')?.addEventListener('click', () => window.ProductDetailModal.close());
        document.getElementById('product-detail-modal')?.addEventListener('click', e => {
            if (e.target === e.currentTarget) window.ProductDetailModal.close();
        });

        // Gallery arrows
        document.getElementById('pdm-prev')?.addEventListener('click', e => { e.stopPropagation(); window.ProductDetailModal.prev(); });
        document.getElementById('pdm-next')?.addEventListener('click', e => { e.stopPropagation(); window.ProductDetailModal.next(); });

        // Add to cart from modal
        document.getElementById('pdm-add-to-cart')?.addEventListener('click', async () => {
            const btn     = document.getElementById('pdm-add-to-cart');
            const prodId  = btn.dataset.productId;
            const size    = btn.dataset.sizeVariant;
            await this._addToCart(prodId, size, btn);
        });

        // Keyboard close
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') window.ProductDetailModal.close();
            if (e.key === 'ArrowLeft')  window.ProductDetailModal.prev();
            if (e.key === 'ArrowRight') window.ProductDetailModal.next();
        });
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
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('featured-products')) {
        window.homeManager = new HomeManager();
    }
});