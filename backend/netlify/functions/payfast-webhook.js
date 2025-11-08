const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const formData = new URLSearchParams(event.body);
        const paymentData = Object.fromEntries(formData);
        
        // Verify PayFast signature (simplified for example)
        // In production, verify the signature properly
        
        const orderId = paymentData.m_payment_id;
        const paymentStatus = paymentData.payment_status;
        
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

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
        }

        // Update order in database
        const { error } = await supabase
            .from('orders')
            .update({
                status: orderStatus,
                payment_status: paymentStatusDb,
                payfast_payment_id: paymentData.pf_payment_id
            })
            .eq('id', orderId);

        if (error) {
            console.error('Error updating order:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Database update failed' })
            };
        }

        return {
            statusCode: 200,
            body: 'OK'
        };

    } catch (error) {
        console.error('Webhook error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};