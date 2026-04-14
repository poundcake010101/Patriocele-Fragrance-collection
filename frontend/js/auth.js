class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        // Wait for Supabase to be available with a timeout
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!window.supabase && attempts < maxAttempts) {
            console.log('⏳ Waiting for Supabase to load... attempt', attempts + 1);
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        if (!window.supabase) {
            console.error('❌ Supabase not loaded after maximum attempts');
            return;
        }

        try {
            console.log('🔐 Checking authentication status...');
            const { data: { session }, error } = await window.supabase.auth.getSession();
            
            if (error) {
                console.error('Session error:', error);
                return;
            }

            this.currentUser = session?.user || null;
            this.isInitialized = true;
            
            console.log('✅ Auth initialized. User:', this.currentUser?.email || 'Not logged in');
            this.updateUI();
            
            // Listen for auth changes
            window.supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('🔄 Auth state changed:', event, session?.user?.email || 'No user');
                this.currentUser = session?.user || null;
                
                if (event === 'SIGNED_IN' && this.currentUser) {
                    // Ensure user exists in 'users' table (for OAuth users)
                    await this.ensureUserProfile(this.currentUser);
                }
                
                this.updateUI();
                if (window.cartManager && event === 'SIGNED_IN') {
                    window.cartManager.loadCartItems();
                }
            });
            
        } catch (error) {
            console.error('❌ Auth initialization error:', error);
        }
    }

    updateUI() {
        const authButtons = document.getElementById('auth-buttons');
        const userMenu = document.getElementById('user-menu');
        const userEmail = document.getElementById('user-email');
        const cartCount = document.getElementById('cart-count');
        const adminLink = document.getElementById('admin-link');

        if (this.currentUser) {
            console.log('Updating UI: User is logged in');
            if (authButtons) authButtons.style.display = 'none';
            if (userMenu) userMenu.style.display = 'flex';
            
            // Show user's name instead of email
            this.displayUserName();
            
            // Check if user is admin and show admin link
            this.checkAndShowAdminLink();
            
            // Update cart count
            this.updateCartCount();
        } else {
            console.log('Updating UI: User is logged out');
            if (authButtons) authButtons.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
            if (cartCount) cartCount.textContent = '0';
            if (adminLink) adminLink.style.display = 'none';
        }
    }

    async displayUserName() {
        const userEmailElement = document.getElementById('user-email');
        if (!userEmailElement || !this.currentUser) return;

        try {
            // Get user's full name from the users table
            const { data: userData, error } = await window.supabase
                .from('users')
                .select('full_name')
                .eq('id', this.currentUser.id)
                .single();

            if (!error && userData?.full_name) {
                // Show the user's name
                userEmailElement.textContent = userData.full_name;
                console.log('✅ Displaying user name:', userData.full_name);
            } else {
                // Fallback to email if no name is set
                userEmailElement.textContent = this.currentUser.email;
                console.log('⚠️ No user name found, using email');
            }
        } catch (error) {
            console.error('Error fetching user name:', error);
            // Fallback to email
            userEmailElement.textContent = this.currentUser.email;
        }
    }

    async checkAndShowAdminLink() {
        const adminLink = document.getElementById('admin-link');
        if (!adminLink || !this.currentUser) return;

        try {
            const { data: userData, error } = await window.supabase
                .from('users')
                .select('is_admin')
                .eq('id', this.currentUser.id)
                .single();

            if (!error && userData?.is_admin) {
                adminLink.style.display = 'block';
                console.log('✅ Admin user detected, showing admin link');
            } else {
                adminLink.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            adminLink.style.display = 'none';
        }
    }

    async updateCartCount() {
        if (!this.currentUser) return;
        
        try {
            const { data: cartItems, error } = await window.supabase
                .from('cart_items')
                .select('quantity')
                .eq('user_id', this.currentUser.id);

            if (error) {
                console.error('Error fetching cart count:', error);
                return;
            }
            
            const total = cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
            const cartCount = document.getElementById('cart-count');
            if (cartCount) {
                cartCount.textContent = total;
                console.log('Cart count updated:', total);
            }
        } catch (error) {
            console.error('Error updating cart count:', error);
        }
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

            // Create user profile (don't throw error if this fails)
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

    isUserLoggedIn() {
        return this.currentUser !== null;
    }

    // Wait for authentication to be initialized
    async waitForAuth() {
        if (this.isInitialized) return true;
        
        return new Promise((resolve) => {
            const checkAuth = setInterval(() => {
                if (this.isInitialized) {
                    clearInterval(checkAuth);
                    resolve(true);
                }
            }, 100);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(checkAuth);
                resolve(false);
            }, 5000);
        });
    }

    async signInWithProvider(provider) {
    // Map 'twitter' to 'x' if your Supabase provider is 'twitter'
    const supabaseProvider = provider === 'twitter' ? 'twitter' : provider;
    const { data, error } = await window.supabase.auth.signInWithOAuth({
        provider: supabaseProvider,
        options: {
            redirectTo: `${window.location.origin}/index.html`,
            queryParams: provider === 'facebook' ? { display: 'popup' } : undefined
        }
    });
    if (error) {
        console.error('OAuth error:', error);
        alert('Login failed: ' + error.message);
    }
    // The user will be redirected to the provider and then back to our site
    }
    async ensureUserProfile(user) {
    if (!user) return;
    
    // Check if user already exists
    const { data: existing, error: fetchError } = await window.supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();
    
        if (!existing && !fetchError?.message?.includes('JSON object requested')) {
            // Create profile from OAuth metadata
            const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
            const { error: insertError } = await window.supabase
                .from('users')
                .insert({
                    id: user.id,
                    email: user.email,
                    full_name: fullName,
                    is_admin: false,
                    created_at: new Date().toISOString()
                });
            if (insertError) console.warn('Profile creation warning:', insertError);
            else console.log('Created user profile for OAuth user:', user.email);
        }
    }
}

// Initialize auth manager and make it globally available
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