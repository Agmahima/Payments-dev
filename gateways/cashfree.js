const crypto = require('crypto');
const axios = require('axios');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');

class CashfreeGateway {
  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
    this.apiId = process.env.CASHFREE_APP_ID;
    this.secretKey = process.env.CASHFREE_SECRET_KEY;
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
  }

  
   //Initiate a payment with Cashfree
   
  async initiatePayment(paymentDetails) {
    try {
      const { 
        amount, 
        orderId, 
        currency,
        customerDetails,
        purpose,
        returnUrl,
        notifyUrl
      } = paymentDetails;

      const orderPayload = {
        order_id: orderId,
        order_amount: amount,
        order_currency: currency || 'INR',
        customer_details: {
          customer_id: customerDetails.id,
          customer_email: customerDetails.email,
          customer_phone: customerDetails.phone,
          customer_name: customerDetails.name
        },
        order_meta: {
          return_url: returnUrl || `${this.frontendUrl}/payment-status?order_id={order_id}`,
          notify_url: notifyUrl || `${this.backendUrl}/api/payments/webhook/cashfree`,
          payment_methods: 'nb,upi'
        },
        order_note: purpose || 'Payment'
      };

      const response = await axios.post(
        `${this.baseUrl}/orders`,
        orderPayload,
        {
          headers: {
            'x-api-version': '2022-09-01',
            'x-client-id': this.apiId,
            'x-client-secret': this.secretKey,
            'Accept': 'application/json'
          }
        }
      );

      return {
        success: true,
        paymentSessionId: response.data.payment_session_id,
        paymentLink: response.data.payment_link,
        gatewayResponse: response.data
      };
    } catch (error) {
      console.error('Cashfree payment initiation error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        gatewayResponse: error.response?.data || {}
      };
    }
  }

  
  // * Verify the signature of a webhook payload
   
  verifyWebhookSignature(payload, signature) {
    try {
      const computedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(JSON.stringify(payload))
        .digest('base64');
      
      return computedSignature === signature;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  
  //  Process webhook data
   
  processWebhookData(webhookData) {
    const { data, type } = webhookData;
    
    let status = 'PENDING';
    let errorMessage = null;
    
    if (type === 'PAYMENT_SUCCESS_WEBHOOK') {
      status = 'SUCCESS';
    } else if (type === 'PAYMENT_FAILED_WEBHOOK') {
      status = 'FAILED';
      errorMessage = data.error_details?.error_description || 'Payment failed';
    } else if (type === 'PAYMENT_USER_DROPPED_WEBHOOK') {
      status = 'CANCELLED';
      errorMessage = 'Payment cancelled by user';
    }

    const transactionDetails = {
      transaction_mode: data.payment?.payment_group || 'UPI',
      paymentId: data.payment?.cf_payment_id?.toString(),
      amount: data.payment?.payment_amount,
      currency: data.payment?.payment_currency,
      status: data.payment?.payment_status,
      statusMessage: data.payment?.payment_message,
      paymentTime: data.payment?.payment_time,
      paymentMethod: data.payment?.payment_method?.payment_method_type,
      errorCode: data.error_details?.error_code,
      errorMessage: errorMessage
    };

    return {
      orderId: data.order.order_id,
      status,
      transactionDetails
    };
  }

  
  // * Get status of a payment
   
  async getPaymentStatus(orderId, paymentId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/orders/${orderId}/payments/${paymentId}`,
        {
          headers: {
            'x-api-version': '2022-09-01',
            'x-client-id': this.apiId,
            'x-client-secret': this.secretKey,
            'Accept': 'application/json'
          }
        }
      );

      return {
        success: true,
        status: response.data.payment_status,
        gatewayResponse: response.data
      };
    } catch (error) {
      console.error('Payment status check error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        gatewayResponse: error.response?.data || {}
      };
    }
  }
}

module.exports = new CashfreeGateway();