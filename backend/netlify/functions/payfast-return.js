exports.handler = async (event) => {
    // Handle PayFast return
    const { order_id, payment_status } = event.queryStringParameters;
    
    if (payment_status === 'COMPLETE') {
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: 'Payment successful!',
                order_id: order_id
            })
        };
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({ 
            success: false, 
            message: 'Payment was cancelled or failed' 
        })
    };
};