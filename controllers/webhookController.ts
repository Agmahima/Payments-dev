// controllers/webhookController.js
const PaymentService = require('../services/PaymentService');

exports.handleWebhook = async (req, res) => {
  try {
    const { gateway } = req.params;
    
    // Get the appropriate signature header based on gateway
    const signature = gateway.toLowerCase() === 'razorpay' 
      ? req.headers['x-razorpay-signature'] 
      : req.headers['x-cashfree-signature'];
    
    // Process the webhook through PaymentService
    const result = await PaymentService.handleWebhook(
      gateway,
      req.body,
      signature,
      req.headers
    );
    
    // Always return 200 for webhooks
    return res.status(200).json({ received: true, processed: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent retries
    return res.status(200).json({ received: true, error: error.message });
  }
};