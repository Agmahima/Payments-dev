const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
  headers: {
    "Content-Type": "application/json"
  },
  timeout: 30000 // 30 seconds timeout
});

/**
 * Create a payment order with Razorpay
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

    // Validate required fields
    if (!orderId || !amount) {
      throw new Error('Order ID and amount are required');
    }

    // Razorpay requires amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(amount * 100);

    const options = {
      amount: amountInPaise,
      currency,
      receipt: orderId,
      notes: {
        customer_id: customerId,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        description,
        ...metadata
      }
    };

    console.log(`Creating Razorpay order for ${amount} ${currency}, receipt: ${orderId}`);
    const order = await razorpay.orders.create(options);
    console.log(`Razorpay order created: ${order.id}`);

    return {
      success: true,
      orderId: order.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: order.amount / 100, // Convert back to rupees for frontend
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
 */
const verifyWebhookSignature = (req) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (!webhookSignature || !webhookSecret) return false;
    
    // Use req.rawBody if available, otherwise stringify the body
    const webhookBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
    
    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookBody)
      .digest('hex');
    
    return generatedSignature === webhookSignature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};
/**
 * Verify payment signature (for frontend verification)
 */
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    if (!orderId || !paymentId || !signature) {
      console.error("Missing parameters for payment signature verification");
      return false;
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      console.error("RAZORPAY_KEY_SECRET is not configured");
      return false;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(orderId + "|" + paymentId)
      .digest('hex');
    
    const isValid = expectedSignature === signature;
    console.log(`Razorpay payment signature validation: ${isValid ? 'valid' : 'invalid'}`);
    return isValid;
  } catch (error) {
    console.error("Error verifying Razorpay payment signature:", error);
    return false;
  }
};

/**
 * Get payment status from Razorpay
 * @param {String} paymentId - Razorpay payment ID
 * @param {String} orderId - Razorpay order ID (optional)
 * @returns {Promise<Object>} Payment status details
 */
const getPaymentStatus = async (paymentId, orderId) => {
  try {
    if (!paymentId && !orderId) {
      throw new Error('Either paymentId or orderId must be provided');
    }

    let paymentDetails;
    
    if (paymentId) {
      console.log(`Fetching Razorpay payment details for payment ID: ${paymentId}`);
      paymentDetails = await razorpay.payments.fetch(paymentId);
    } else if (orderId) {
      console.log(`Fetching Razorpay payments for order ID: ${orderId}`);
      const payments = await razorpay.orders.fetchPayments(orderId);
      paymentDetails = payments.items && payments.items.length > 0 
        ? payments.items[0] 
        : null;
    }
    
    if (!paymentDetails) {
      return {
        success: false,
        error: 'Payment not found',
        paymentStatus: 'UNKNOWN'
      };
    }
    
    // Map Razorpay status to standardized status
    let standardizedStatus;
    switch (paymentDetails.status) {
      case 'captured':
        standardizedStatus = 'SUCCESS';
        break;
      case 'authorized':
        standardizedStatus = 'PENDING';
        break;
      case 'failed':
        standardizedStatus = 'FAILED';
        break;
      case 'refunded':
        standardizedStatus = 'REFUNDED';
        break;
      default:
        standardizedStatus = paymentDetails.status.toUpperCase();
    }
    
    console.log(`Razorpay payment status: ${paymentDetails.status} (${standardizedStatus})`);
    
    return {
      success: true,
      data: paymentDetails,
      paymentStatus: standardizedStatus,
      amount: paymentDetails.amount / 100, // Convert paise to rupees
      currency: paymentDetails.currency,
      method: paymentDetails.method,
      email: paymentDetails.email,
      contact: paymentDetails.contact,
      orderId: paymentDetails.order_id,
      createdAt: new Date(paymentDetails.created_at * 1000).toISOString()
    };
  } catch (error) {
    console.error("Error fetching payment status from Razorpay:", error);
    return {
      success: false,
      error: error.message,
      paymentStatus: 'ERROR'
    };
  }
};

/**
 * Create a subscription with Razorpay
 * @param {Object} subscriptionData - Subscription details
 * @returns {Promise<Object>} Subscription creation result
 */
const createSubscription = async (subscriptionData) => {
  try {
    const {
      planId,
      customerId,
      totalCount,
      startAt,
      customerEmail,
      customerPhone,
      customerName,
      notes = {}
    } = subscriptionData;

    if (!planId || !customerId) {
      throw new Error('Plan ID and customer ID are required for subscription');
    }
    
    console.log(`Creating Razorpay subscription for plan: ${planId}, customer: ${customerId}`);
    
    // First check if we need to create a customer
    let customer;
    try {
      // Try to fetch the customer first
      customer = await razorpay.customers.fetch(customerId);
    } catch (error) {
      // Customer doesn't exist, create one
      if (customerEmail) {
        customer = await razorpay.customers.create({
          name: customerName || 'Customer',
          email: customerEmail,
          contact: customerPhone,
          notes: notes.customer || {}
        });
      } else {
        throw new Error('Customer email is required for creating a subscription');
      }
    }
    
    const options = {
      plan_id: planId,
      customer_notify: 1, // Notify customer about subscription creation
      total_count: totalCount,
      start_at: startAt || Math.floor(Date.now() / 1000) + 60, // Default to 1 minute from now
      notes: notes
    };

    const subscription = await razorpay.subscriptions.create(options);
    console.log(`Razorpay subscription created: ${subscription.id}`);

    return {
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      gatewayResponse: subscription
    };
  } catch (error) {
    console.error("Error creating subscription on Razorpay:", error);
    return {
      success: false,
      error: error.message,
      gatewayResponse: error
    };
  }
};

module.exports = {
  createOrder,
  verifyWebhookSignature,
  verifyPaymentSignature,
  getPaymentStatus,
   createSubscription
};