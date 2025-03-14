const Razorpay = require('razorpay');
const crypto = require('crypto');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

/**
 * Create a payment order with Razorpay
 * @param {Object} orderData - Order details
 * @returns {Promise<Object>} Razorpay order response
 */
const createOrder = async (orderData) => {
  try {
    const {
      orderId,
      amount,
      currency = 'INR',
      customerId,
      customerEmail,
      customerPhone,
      customerName,
      description,
      metadata = {}
    } = orderData;

    // Razorpay takes amount in paise (smallest currency unit)
    const amountInPaise = amount * 100;

    const options = {
      amount: amountInPaise,
      currency,
      receipt: orderId,
      notes: {
        customer_id: customerId,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_name: customerName,
        description,
        ...metadata
      }
    };

    const order = await razorpay.orders.create(options);

    return {
      success: true,
      orderId: order.id,
      keyId: RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      gatewayResponse: order
    };
  } catch (error) {
    console.error("Error creating order on Razorpay:", error);
    return {
      success: false,
      error: error.message,
      gatewayResponse: error
    };
  }
};

/**
 * Verify Razorpay webhook signature
 * @param {Object} payload - Webhook payload
 * @param {String} signature - Webhook signature from headers
 * @returns {Boolean} Whether signature is valid
 */
const verifyWebhookSignature = (payload, signature) => {
  try {
    // For Razorpay webhooks
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    const shasum = crypto.createHmac('sha256', webhookSecret);
    shasum.update(JSON.stringify(payload));
    const digest = shasum.digest('hex');
    
    return digest === signature;
  } catch (error) {
    console.error("Error verifying Razorpay webhook signature:", error);
    return false;
  }
};

/**
 * Verify payment signature (for client-side verification)
 * @param {String} orderId - Razorpay order ID
 * @param {String} paymentId - Razorpay payment ID
 * @param {String} signature - Razorpay signature
 * @returns {Boolean} Whether signature is valid
 */
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    
    return expectedSignature === signature;
  } catch (error) {
    console.error("Error verifying Razorpay payment signature:", error);
    return false;
  }
};

/**
 * Get payment status from Razorpay
 * @param {String} paymentId - Payment ID
 * @returns {Promise<Object>} Payment status
 */
const getPaymentStatus = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    
    return {
      success: true,
      data: payment,
      paymentStatus: payment.status
    };
  } catch (error) {
    console.error("Error getting payment status from Razorpay:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  createOrder,
  verifyWebhookSignature,
  verifyPaymentSignature,
  getPaymentStatus
};