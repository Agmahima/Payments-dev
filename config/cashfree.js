const axios = require('axios');

const cashfreeConfig = {
  clientId: process.env.CASHFREE_CLIENT_ID,
  clientSecret: process.env.CASHFREE_CLIENT_SECRET,
  environment: process.env.CASHFREE_ENV || 'TEST',  // 'TEST' or 'PROD'
};

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



module.exports = cashfreeConfig;
module.exports.initiatePayment = initiatePayment;
