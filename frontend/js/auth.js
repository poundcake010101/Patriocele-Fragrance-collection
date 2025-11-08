class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        // Wait a bit to ensure supabase is loaded
        if (!window.supabase) {
            console.error('Supabase not loaded yet');
            setTimeout(() => this.init(), 100);
            return;
        }

        // Check current auth status
        const { data: { session } } = await window.supabase.auth.getSession();
        this.currentUser = session?.user || null;
        this.updateUI();
        
        // Listen for auth changes
        window.supabase.auth.onAuthStateChange((event, session) => {
            this.currentUser = session?.user || null;
            this.updateUI();
        });
    }

    updateUI() {
        const authButtons = document.getElementById('auth-buttons');
        const userMenu = document.getElementById('user-menu');
        const userEmail = document.getElementById('user-email');
        const cartCount = document.getElementById('cart-count');

        if (this.currentUser) {
            if (authButtons) authButtons.classList.add('hidden');
            if (userMenu) userMenu.style.display = 'flex';
            if (userEmail) userEmail.textContent = this.currentUser.email;
            
            // Update cart count
            this.updateCartCount();
        } else {
            if (authButtons) authButtons.classList.remove('hidden');
            if (userMenu) userMenu.style.display = 'none';
            if (cartCount) cartCount.textContent = '0';
        }
    }

    async updateCartCount() {
        if (!this.currentUser) return;
        
        const { data: cartItems } = await window.supabase
            .from('cart_items')
            .select('quantity')
            .eq('user_id', this.currentUser.id);
            
        const total = cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        const cartCount = document.getElementById('cart-count');
        if (cartCount) cartCount.textContent = total;
    }

    async signUp(email, password, fullName) {
        try {
            const { data, error } = await window.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) throw error;

            // Create user profile
            if (data.user) {
                const { error: profileError } = await window.supabase
                    .from('users')
                    .insert([
                        { 
                            id: data.user.id, 
                            email: email,
                            full_name: fullName
                        }
                    ]);

                if (profileError) {
                    console.warn('Profile creation warning:', profileError);
                    // Don't throw here - user is created in auth, just profile failed
                }
            }

            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async signIn(email, password) {
        try {
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async signOut() {
        try {
            const { error } = await window.supabase.auth.signOut();
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.authManager = new AuthManager();

    // Logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            const result = await window.authManager.signOut();
            if (result.success) {
                window.location.href = 'index.html';
            }
        });
    }
});