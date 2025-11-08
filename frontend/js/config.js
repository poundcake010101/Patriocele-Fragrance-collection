// Supabase configuration
const getSupabaseUrl = () => {
    // Use environment variable in production, fallback to your URL
    return process.env.SUPABASE_URL || 'https://zcjizkxzolldbuhjneev.supabase.co';
};

const getSupabaseKey = () => {
    // Use environment variable in production
    return process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjaml6a3h6b2xsZGJ1aGpuZWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1OTM5MTUsImV4cCI6MjA3ODE2OTkxNX0.EtlwGEI4x_afasYvH5sfQgri6q1aqEThJSMeVFL6AMI';
};

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseKey();

// Create Supabase client
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test connection on load
async function testConnection() {
    try {
        const { data, error } = await window.supabase.from('products').select('count');
        if (error) {
            console.warn('Supabase connection test failed:', error.message);
        } else {
            console.log('✅ Supabase connected successfully');
        }
    } catch (error) {
        console.error('Supabase connection error:', error);
    }
}

// Test connection when script loads
testConnection();