// filepath: /Users/priyanshu/Desktop/POD/payments/gateways/stripe.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL;

/**
 * Create a payment session with Stripe
 * @param {Object} orderData - Order details
 * @returns {Promise<Object>} Stripe checkout session
 */
const createOrder = async (orderData) => {
  try {
    const {
      orderId,
      amount,
      currency = 'inr',
      customerEmail,
      description,
      successUrl = `${FRONTEND_URL}/payment-status?status=success&order_id=${orderId}`,
      cancelUrl = `${FRONTEND_URL}/payment-status?status=cancelled&order_id=${orderId}`,
      metadata = {}
    } = orderData;

    // Stripe takes amount in smallest currency unit (paise for INR)
    const amountInSmallestUnit = Math.round(amount * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: description || 'Payment',
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      client_reference_id: orderId,
      metadata: {
        order_id: orderId,
        ...metadata
      }
    });

    return {
      success: true,
      sessionId: session.id,
      paymentUrl: session.url,
      gatewayResponse: session
    };
  } catch (error) {
    console.error("Error creating order on Stripe:", error);
    return {
      success: false,
      error: error.message,
      gatewayResponse: error
    };
  }
};

/**
 * Verify Stripe webhook signature
 * @param {String} payload - Raw webhook payload (request body)
 * @param {String} signature - Webhook signature from headers
 * @returns {Object} Event object if valid, or error
 */
const verifyWebhookSignature = (payload, signature) => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
    return {
      success: true,
      event
    };
  } catch (error) {
    console.error("Error verifying Stripe webhook signature:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get payment status from Stripe
 * @param {String} sessionId - Checkout Session ID
 * @returns {Promise<Object>} Payment status
 */
const getPaymentStatus = async (sessionId) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent']
    });
    
    return {
      success: true,
      data: session,
      paymentStatus: session.payment_status,
      paymentIntent: session.payment_intent
    };
  } catch (error) {
    console.error("Error getting payment status from Stripe:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  createOrder,
  verifyWebhookSignature,
  getPaymentStatus
};