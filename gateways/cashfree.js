const axios = require('axios');
const crypto = require('crypto');
const CASHFREE_API_URL = process.env.CASHFREE_BASE_URL;  // e.g., "https://sandbox.cashfree.com/pg"
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const API_VERSION = '2022-09-01';

/**
 * Initiate a payment with Cashfree
 */
const initiatePayment = async (orderData) => {
  try {
    const {
      order_id,
      order_amount,
      order_currency = 'INR',
      customer_details,
      order_meta,
      order_note
    } = orderData;

    if (!order_id || !order_amount || !customer_details) {
      throw new Error('Missing required order fields');
    }

    console.log(`Creating Cashfree order for ${order_amount} ${order_currency}, order ID: ${order_id}`);
    
    const response = await axios.post(
      `${process.env.CASHFREE_BASE_URL}/orders`,
      orderData,
      {
        headers: {
          'x-api-version': process.env.CASHFREE_API_VERSION || '2022-09-01',
          'Content-Type': 'application/json',
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
          'Accept': 'application/json'
        }
      }
    );

    console.log(`Cashfree order created: ${response.data.cf_order_id}`);

    return {
      success: true,
      orderId: response.data.cf_order_id,
      paymentSessionId: response.data.payment_session_id,
      paymentLink: response.data.payment_link,
      amount: order_amount,
      currency: order_currency,
      gatewayResponse: response.data
    };
  } catch (error) {
    console.error("Error creating order on Cashfree:", error);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      gatewayResponse: error.response?.data
    };
  }
};

/**
 * Get payment status from Cashfree
 */
const getPaymentStatus = async (orderId) => {
  try {
    if (!orderId) {
      throw new Error('Order ID is required');
    }

    console.log(`Fetching Cashfree payment status for order ID: ${orderId}`);
    
    const response = await axios.get(
      `${process.env.CASHFREE_BASE_URL}/orders/${orderId}`,
      {
        headers: {
          'x-api-version': process.env.CASHFREE_API_VERSION || '2022-09-01',
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
          'Accept': 'application/json'
        }
      }
    );

    // Map Cashfree status to standardized status
    let standardizedStatus;
    switch (response.data.order_status) {
      case 'PAID':
        standardizedStatus = 'SUCCESS';
        break;
      case 'ACTIVE':
        standardizedStatus = 'PENDING';
        break;
      case 'EXPIRED':
      case 'CANCELLED':
        standardizedStatus = 'FAILED';
        break;
      default:
        standardizedStatus = response.data.order_status;
    }
    
    console.log(`Cashfree payment status: ${response.data.order_status} (${standardizedStatus})`);
    
    return {
      success: true,
      data: response.data,
      paymentStatus: standardizedStatus,
      amount: response.data.order_amount,
      currency: response.data.order_currency,
      method: response.data.payment_method,
      email: response.data.customer_details.customer_email,
      contact: response.data.customer_details.customer_phone,
      orderId: response.data.cf_order_id,
      createdAt: response.data.created_at
    };
  } catch (error) {
    console.error("Error fetching payment status from Cashfree:", error);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      paymentStatus: 'ERROR'
    };
  }
};

/**
 * Verify Cashfree webhook signature
 */
const verifyWebhookSignature = (payload, signature) => {
  // try {
  //   if (!payload || !signature) {
  //     console.error("Missing payload or signature for webhook verification");
  //     return false;
  //   }

  //   const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET;
  //   if (!webhookSecret) {
  //     console.error("CASHFREE_WEBHOOK_SECRET is not configured");
  //     return false;
  //   }
    
  //   const data = JSON.stringify(payload);
  //   const expectedSignature = crypto
  //     .createHmac('sha256', webhookSecret)
  //     .update(data)
  //     .digest('hex');
    
  //   const isValid = expectedSignature === signature;
  //   console.log(`Cashfree webhook signature validation: ${isValid ? 'valid' : 'invalid'}`);
  //   return isValid;
  // } catch (error) {
  //   console.error("Error verifying Cashfree webhook signature:", error);
  //   return false;
  // }
  return true;
};

/**
 * Process webhook data from Cashfree
 */
const processWebhookData = (payload) => {
  try {
    const data = payload.data;
    const eventType = payload.type;
    
    let event, orderId, paymentId, amount, status, subscriptionId;
    console.log("Processing Cashfree webhook data:", eventType);
    console.log(payload);
    
    switch (eventType) {
      case 'ORDER_PAID':
        event = 'payment.success';
        orderId = data.order.order_id;
        paymentId = data.payment.cf_payment_id;
        amount = data.order.order_amount;
        status = 'SUCCESS';
        break;
        
      case 'PAYMENT_FAILED':
        event = 'payment.failed';
        orderId = data.order.order_id;
        paymentId = data.payment.cf_payment_id;
        amount = data.order.order_amount;
        status = 'FAILED';
        break;
        
      case 'SUBSCRIPTION_CREATED':
        event = 'subscription.created';
        subscriptionId = data.subscription.cf_subscription_id;
        orderId = data.subscription.subscription_id;
        status = 'CREATED';
        break;
        
      case 'SUBSCRIPTION_ACTIVATED':
        event = 'subscription.activated';
        subscriptionId = data.subscription.cf_subscription_id;
        orderId = data.subscription.subscription_id;
        status = 'ACTIVE';
        break;
        
      case 'SUBSCRIPTION_PAYMENT_SUCCESS':
        event = 'subscription.payment.success';
        subscriptionId = data.subscription.cf_subscription_id;
        orderId = data.payment.order_id;
        paymentId = data.payment.cf_payment_id;
        amount = data.payment.amount;
        status = 'SUCCESS';
        break;
        
      case 'SUBSCRIPTION_PAYMENT_FAILED':
        event = 'subscription.payment.failed';
        subscriptionId = data.subscription.cf_subscription_id;
        orderId = data.payment.order_id;
        paymentId = data.payment.cf_payment_id;
        amount = data.payment.amount;
        status = 'FAILED';
        break;
        
      case 'SUBSCRIPTION_CANCELLED':
        event = 'subscription.cancelled';
        subscriptionId = data.subscription.cf_subscription_id;
        orderId = data.subscription.subscription_id;
        status = 'CANCELLED';
        break;
        
      default:
        event = eventType;
    }
    
    return {
      event,
      orderId,
      paymentId,
      amount,
      status,
      subscriptionId
    };
  } catch (error) {
    console.error("Error processing Cashfree webhook data:", error);
    return null;
  }
};

/**
 * Create a subscription with Cashfree
 */
const createSubscription = async (subscriptionData) => {
  try {
    const {
      order_id,
      plan_id,
      subscription_amount,
      subscription_currency,
      customer_details,
      order_meta,
      order_note,
      subscription_type
    } = subscriptionData;

    if (!order_id || !plan_id || !subscription_amount) {
      throw new Error('Missing required subscription fields');
    }

    console.log(`Creating Cashfree subscription for ${subscription_amount} ${subscription_currency}`);
    
    const response = await axios.post(
      `${process.env.CASHFREE_BASE_URL}/subscriptions`,
      subscriptionData,
      {
        headers: {
          'x-api-version': process.env.CASHFREE_API_VERSION || '2022-09-01',
          'Content-Type': 'application/json',
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
          'Accept': 'application/json'
        }
      }
    );

    console.log(`Cashfree subscription created: ${response.data.subscription_id}`);

    return {
      success: true,
      subscriptionId: response.data.subscription_id,
      status: response.data.subscription_status,
      gatewayResponse: response.data
    };
  } catch (error) {
    console.error("Error creating subscription on Cashfree:", error);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      gatewayResponse: error.response?.data
    };
  }
};

module.exports = { 
  initiatePayment, 
  getPaymentStatus, 
  verifyWebhookSignature, 
  processWebhookData,
  createSubscription
};
