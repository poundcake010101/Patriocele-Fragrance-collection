const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse the form data from PayFast ITN (Instant Transaction Notification)
        const formData = new URLSearchParams(event.body);
        const paymentData = Object.fromEntries(formData);
        
        console.log('PayFast ITN received:', paymentData);

        // Initialize Supabase
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        const orderId = paymentData.m_payment_id;
        const paymentStatus = paymentData.payment_status;

        let orderStatus = 'pending';
        let paymentStatusDb = 'pending';

        switch (paymentStatus) {
            case 'COMPLETE':
                orderStatus = 'confirmed';
                paymentStatusDb = 'paid';
                break;
            case 'CANCELLED':
                orderStatus = 'cancelled';
                paymentStatusDb = 'cancelled';
                break;
            case 'FAILED':
                orderStatus = 'failed';
                paymentStatusDb = 'failed';
                break;
            default:
                orderStatus = 'pending';
                paymentStatusDb = 'pending';
        }

        // Update order in database
        const { error } = await supabase
            .from('orders')
            .update({
                status: orderStatus,
                payment_status: paymentStatusDb,
                payfast_payment_id: paymentData.pf_payment_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) {
            console.error('Error updating order:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Database update failed' })
            };
        }

        console.log(`Order ${orderId} updated to status: ${orderStatus}`);

        // Return success response to PayFast
        return {
            statusCode: 200,
            body: 'OK'
        };

    } catch (error) {
        console.error('PayFast webhook error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};