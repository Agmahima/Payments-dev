const axios = require('axios');
const CASHFREE_API_URL = process.env.CASHFREE_BASE_URL;  // e.g., "https://sandbox.cashfree.com/pg"
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const API_VERSION = '2022-09-01';

const initiatePayment = async (orderData) => {
  try {
    const headers = {
      'x-api-version': API_VERSION,
      'Content-Type': 'application/json',
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY,
    };
    console.log("Using API version:", API_VERSION);
    const response = await axios.post(
      `${CASHFREE_API_URL}/orders`,
      orderData,
      { headers }
    );
    console.log("Response from Cashfree:", response.data);
    return {
      success: true,
      paymentSessionId: response.data.payment_session_id,
      orderId: response.data.order_id,
      paymentLink: response.data.payments.url,
      gatewayResponse: response.data
    };
  } catch (error) {
    console.error("Error creating order on Cashfree:", error.response ? error.response.data : error.message);
    return {
      success: false,
      error: error.message,
      gatewayResponse: error.response ? error.response.data : null
    };
  }
};

const getPaymentStatus = async (orderId, paymentId) => {
  try {
    const headers = {
      'x-api-version': API_VERSION,
      'Content-Type': 'application/json',
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY,
    };
    // Similarly, use headers only here:
    const response = await axios.get(
      `${CASHFREE_API_URL}/orders/${orderId}?paymentId=${paymentId}`,
      { headers }
    );
    return {
      success: true,
      status: response.data.payment_status,
      gatewayResponse: response.data
    };
  } catch (error) {
    console.error("Error fetching payment status from Cashfree:", error.response ? error.response.data : error.message);
    return {
      success: false,
      error: error.message,
      gatewayResponse: error.response ? error.response.data : null
    };
  }
};

const verifyWebhookSignature = (rawBody, signature) => {
  const crypto = require('crypto');
  const computedSignature = crypto.createHmac("sha256", CASHFREE_SECRET_KEY)
      .update(rawBody)
      .digest("base64");
  console.log("Computed signature:", computedSignature);
  return signature === computedSignature;
};

const processWebhookData = (payload) => {
  const { order, payment } = payload.data;
  return { orderId: order.order_id, status: payment.payment_status, transactionDetails: payment };
};

module.exports = { initiatePayment, getPaymentStatus, verifyWebhookSignature, processWebhookData };
