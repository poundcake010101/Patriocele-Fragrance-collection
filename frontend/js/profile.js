class ProfileManager {
    constructor() {
        this.userData = null;
        this.addresses = [];
        this.init();
    }

    async init() {
        await window.authManager.waitForAuth();
        
        if (!window.authManager.isUserLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }

        await this.loadUserData();
        await this.loadAddresses();
        this.setupEventListeners();
        this.setupTabNavigation();
    }

    async loadUserData() {
        const user = window.authManager.getCurrentUser();
        
        try {
            // Load user profile
            const { data, error } = await window.supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            this.userData = data;
            this.populateUserForm();
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    populateUserForm() {
        if (!this.userData) return;

        // Update profile display
        document.getElementById('profile-name').textContent = 
            this.userData.full_name || 'User';
        document.getElementById('profile-email').textContent = 
            this.userData.email;
        document.getElementById('profile-email-input').value = 
            this.userData.email;

        // Populate personal form
        if (this.userData.full_name) {
            const names = this.userData.full_name.split(' ');
            document.getElementById('first-name').value = names[0] || '';
            document.getElementById('last-name').value = names.slice(1).join(' ') || '';
        }
        
        document.getElementById('phone').value = this.userData.phone || '';

        // Populate preferences
        const prefs = this.userData.preferences || {};
        document.getElementById('email-promotions').checked = prefs.email_promotions || false;
        document.getElementById('email-order-updates').checked = prefs.email_order_updates !== false;
        document.getElementById('sms-notifications').checked = prefs.sms_notifications || false;
    }

    async loadAddresses() {
        const user = window.authManager.getCurrentUser();
        
        try {
            const { data, error } = await window.supabase
                .from('addresses')
                .select('*')
                .eq('user_id', user.id)
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.addresses = data || [];
            this.renderAddresses();
            
        } catch (error) {
            console.error('Error loading addresses:', error);
        }
    }

    renderAddresses() {
        const container = document.getElementById('addresses-list');
        
        if (this.addresses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No addresses saved yet</p>
                    <p class="empty-state-sub">Add your first address to make checkout faster</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.addresses.forEach(address => {
            html += `
                <div class="address-card ${address.is_default ? 'default-address' : ''}">
                    <div class="address-header">
                        <h4>${address.label} ${address.is_default ? '<span class="default-badge">Default</span>' : ''}</h4>
                        <div class="address-actions">
                            <button class="btn-outline btn-sm" onclick="profileManager.editAddress(${address.id})">
                                Edit
                            </button>
                            <button class="btn-outline btn-sm btn-danger" onclick="profileManager.deleteAddress(${address.id})">
                                Delete
                            </button>
                        </div>
                    </div>
                    <div class="address-details">
                        <p>${address.first_name} ${address.last_name}</p>
                        <p>${address.line1}</p>
                        ${address.line2 ? `<p>${address.line2}</p>` : ''}
                        <p>${address.city}, ${address.state} ${address.zip_code}</p>
                        <p>${address.phone}</p>
                    </div>
                    ${!address.is_default ? `
                        <div class="address-footer">
                            <button class="btn-outline btn-sm" onclick="profileManager.setDefaultAddress(${address.id})">
                                Set as Default
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    setupEventListeners() {
        // Personal form
        document.getElementById('personal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updatePersonalInfo();
        });

        // Password form
        document.getElementById('password-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updatePassword();
        });

        // Preferences form
        document.getElementById('preferences-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updatePreferences();
        });

        // Address modal
        document.getElementById('add-address-btn').addEventListener('click', () => {
            this.openAddressModal();
        });

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAddressModal();
            });
        });

        document.getElementById('address-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAddress();
        });
    }

    setupTabNavigation() {
        document.querySelectorAll('.profile-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Update active nav button
        document.querySelectorAll('.profile-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    async updatePersonalInfo() {
        const formData = new FormData(document.getElementById('personal-form'));
        const firstName = formData.get('first-name');
        const lastName = formData.get('last-name');
        const phone = formData.get('phone');

        const updateData = {
            full_name: `${firstName} ${lastName}`.trim(),
            phone: phone
        };

        try {
            const { error } = await window.supabase
                .from('users')
                .update(updateData)
                .eq('id', this.userData.id);

            if (error) throw error;

            alert('Personal information updated successfully!');
            await this.loadUserData(); // Reload data
            
        } catch (error) {
            console.error('Error updating personal info:', error);
            alert('Error updating personal information');
        }
    }

    async updatePassword() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            alert('New passwords do not match!');
            return;
        }

        if (newPassword.length < 6) {
            alert('New password must be at least 6 characters long');
            return;
        }

        try {
            // Note: Supabase doesn't have a direct method to change password with current password
            // This would typically require email verification
            const { error } = await window.supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            alert('Password updated successfully!');
            document.getElementById('password-form').reset();
            
        } catch (error) {
            console.error('Error updating password:', error);
            alert('Error updating password: ' + error.message);
        }
    }

    async updatePreferences() {
        const preferences = {
            email_promotions: document.getElementById('email-promotions').checked,
            email_order_updates: document.getElementById('email-order-updates').checked,
            sms_notifications: document.getElementById('sms-notifications').checked
        };

        try {
            const { error } = await window.supabase
                .from('users')
                .update({ preferences })
                .eq('id', this.userData.id);

            if (error) throw error;

            alert('Preferences updated successfully!');
            
        } catch (error) {
            console.error('Error updating preferences:', error);
            alert('Error updating preferences');
        }
    }

    openAddressModal(address = null) {
        const modal = document.getElementById('address-modal');
        const title = document.getElementById('address-modal-title');
        
        if (address) {
            title.textContent = 'Edit Address';
            this.fillAddressForm(address);
        } else {
            title.textContent = 'Add New Address';
            this.clearAddressForm();
        }
        
        modal.style.display = 'block';
    }

    closeAddressModal() {
        document.getElementById('address-modal').style.display = 'none';
    }

    fillAddressForm(address) {
        document.getElementById('address-id').value = address.id;
        document.getElementById('address-label').value = address.label;
        document.getElementById('address-first-name').value = address.first_name;
        document.getElementById('address-last-name').value = address.last_name;
        document.getElementById('address-line1').value = address.line1;
        document.getElementById('address-line2').value = address.line2 || '';
        document.getElementById('address-city').value = address.city;
        document.getElementById('address-state').value = address.state;
        document.getElementById('address-zip').value = address.zip_code;
        document.getElementById('address-phone').value = address.phone;
        document.getElementById('address-default').checked = address.is_default;
    }

    clearAddressForm() {
        document.getElementById('address-form').reset();
        document.getElementById('address-id').value = '';
    }

    async saveAddress() {
        const formData = new FormData(document.getElementById('address-form'));
        const addressId = formData.get('address-id');
        const user = window.authManager.getCurrentUser();
        
        const addressData = {
            user_id: user.id,
            label: formData.get('address-label'),
            first_name: formData.get('address-first-name'),
            last_name: formData.get('address-last-name'),
            line1: formData.get('address-line1'),
            line2: formData.get('address-line2'),
            city: formData.get('address-city'),
            state: formData.get('address-state'),
            zip_code: formData.get('address-zip'),
            phone: formData.get('address-phone'),
            is_default: formData.get('address-default') === 'on'
        };

        try {
            let result;
            if (addressId) {
                // Update existing address
                result = await window.supabase
                    .from('addresses')
                    .update(addressData)
                    .eq('id', addressId);
            } else {
                // Create new address
                result = await window.supabase
                    .from('addresses')
                    .insert([addressData]);
            }

            if (result.error) throw result.error;

            this.closeAddressModal();
            await this.loadAddresses(); // Reload addresses
            alert('Address saved successfully!');

        } catch (error) {
            console.error('Error saving address:', error);
            alert('Error saving address: ' + error.message);
        }
    }

    async editAddress(addressId) {
        const address = this.addresses.find(a => a.id === addressId);
        if (address) {
            this.openAddressModal(address);
        }
    }

    async deleteAddress(addressId) {
        if (!confirm('Are you sure you want to delete this address?')) {
            return;
        }

        try {
            const { error } = await window.supabase
                .from('addresses')
                .delete()
                .eq('id', addressId);

            if (error) throw error;

            await this.loadAddresses(); // Reload addresses
            alert('Address deleted successfully!');

        } catch (error) {
            console.error('Error deleting address:', error);
            alert('Error deleting address');
        }
    }

    async setDefaultAddress(addressId) {
        const user = window.authManager.getCurrentUser();
        
        try {
            // First, unset any existing default
            await window.supabase
                .from('addresses')
                .update({ is_default: false })
                .eq('user_id', user.id);

            // Then set the new default
            const { error } = await window.supabase
                .from('addresses')
                .update({ is_default: true })
                .eq('id', addressId);

            if (error) throw error;

            await this.loadAddresses(); // Reload addresses
            alert('Default address updated successfully!');

        } catch (error) {
            console.error('Error setting default address:', error);
            alert('Error setting default address');
        }
    }
}

// Initialize profile manager
let profileManager;
document.addEventListener('DOMContentLoaded', function() {
    profileManager = new ProfileManager();
});

// Helper function for avatar initials
function getInitials() {
    const user = window.authManager?.getCurrentUser();
    if (!user?.email) return 'U';
    
    const name = user.user_metadata?.full_name || user.email;
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}