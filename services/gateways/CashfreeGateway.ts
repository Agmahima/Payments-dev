const axios = require('axios');
const crypto = require('crypto');

class CashfreeGateway {
  constructor() {
    this.baseUrl = process.env.CASHFREE_BASE_URL;
    this.apiVersion = process.env.CASHFREE_API_VERSION;
    this.headers = {
      'x-api-version': this.apiVersion,
      'Content-Type': 'application/json',
      'x-client-id': process.env.CASHFREE_APP_ID,
      'x-client-secret': process.env.CASHFREE_SECRET_KEY,
      'Accept': 'application/json'
    };
  }

  async createOrder({ orderId, amount, currency, customerDetails, orderMeta, orderNote }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/orders`,
        {
          order_id: orderId,
          order_amount: amount,
          order_currency: currency,
          customer_details: customerDetails,
          order_meta: orderMeta,
          order_note: orderNote
        },
        { headers: this.headers }
      );

      return {
        success: true,
        orderId: response.data.order_id,
        paymentSessionId: response.data.payment_session_id,
        paymentLink: response.data.payment_link
      };
    } catch (error) {
      console.error('Error creating Cashfree order:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async createSubscription({ orderId, planId, subscriptionAmount, subscriptionCurrency, customerDetails, orderMeta, orderNote }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/subscriptions`,
        {
          subscription_id: orderId,
          plan_id: planId,
          subscription_amount: subscriptionAmount,
          subscription_currency: subscriptionCurrency,
          customer_details: customerDetails,
          order_meta: orderMeta,
          order_note: orderNote
        },
        { headers: this.headers }
      );

      return {
        success: true,
        subscriptionId: response.data.subscription_id,
        status: response.data.status,
        authLink: response.data.auth_link
      };
    } catch (error) {
      console.error('Error creating Cashfree subscription:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async getPaymentStatus(orderId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/orders/${orderId}`,
        { headers: this.headers }
      );

      return {
        success: true,
        status: response.data.order_status,
        amount: response.data.order_amount,
        currency: response.data.order_currency,
        paymentMethod: response.data.payment_method
      };
    } catch (error) {
      console.error('Error fetching Cashfree payment status:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  verifyWebhookSignature(payload, signature) {
    const body = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.CASHFREE_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  }

  processWebhookData(payload) {
    try {
      const { event, data } = payload;
      
      switch (event) {
        case 'PAYMENT_SUCCESS_WEBHOOK':
          return {
            event: 'payment.success',
            paymentId: data.payment.cf_payment_id,
            orderId: data.order.order_id,
            amount: data.order.order_amount,
            status: 'success',
            paymentMethod: data.payment.payment_method
          };
        case 'PAYMENT_FAILED_WEBHOOK':
          return {
            event: 'payment.failed',
            paymentId: data.payment.cf_payment_id,
            orderId: data.order.order_id,
            amount: data.order.order_amount,
            status: 'failed',
            paymentMethod: data.payment.payment_method
          };
        case 'SUBSCRIPTION_ACTIVATED':
          return {
            event: 'subscription.activated',
            subscriptionId: data.subscription.subscription_id,
            status: 'active'
          };
        case 'SUBSCRIPTION_CANCELLED':
          return {
            event: 'subscription.cancelled',
            subscriptionId: data.subscription.subscription_id,
            status: 'cancelled'
          };
        default:
          return null;
      }
    } catch (error) {
      console.error('Error processing Cashfree webhook data:', error);
      return null;
    }
  }
}

module.exports = new CashfreeGateway(); 