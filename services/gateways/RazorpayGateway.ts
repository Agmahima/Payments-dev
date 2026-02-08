const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayGateway {
  constructor() {
    this.instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  async createOrder({ amount, currency, receipt, notes }) {
    try {
      const order = await this.instance.orders.create({
        amount: amount * 100, // Razorpay expects amount in paise
        currency,
        receipt,
        notes
      });

      return {
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        status: order.status
      };
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createSubscription({ planId, customerId, totalCount, notes }) {
    try {
      const subscription = await this.instance.subscriptions.create({
        plan_id: planId,
        customer_id: customerId,
        total_count: totalCount,
        notes
      });

      return {
        success: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        currentStart: subscription.current_start,
        currentEnd: subscription.current_end
      };
    } catch (error) {
      console.error('Error creating Razorpay subscription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPaymentStatus(paymentId) {
    try {
      const payment = await this.instance.payments.fetch(paymentId);
      return {
        success: true,
        status: payment.status,
        amount: payment.amount / 100, // Convert from paise to rupees
        currency: payment.currency,
        method: payment.method,
        orderId: payment.order_id
      };
    } catch (error) {
      console.error('Error fetching Razorpay payment status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  verifyPaymentSignature(orderId, paymentId, signature) {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  }

  verifyWebhookSignature(payload, signature) {
    const body = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  }

  processWebhookData(payload) {
    try {
      const { event, payload: eventPayload } = payload;
      
      switch (event) {
        case 'payment.captured':
          return {
            event: 'payment.success',
            paymentId: eventPayload.payment.entity.id,
            orderId: eventPayload.payment.entity.order_id,
            amount: eventPayload.payment.entity.amount / 100,
            status: 'success',
            paymentMethod: eventPayload.payment.entity.method
          };
        case 'payment.failed':
          return {
            event: 'payment.failed',
            paymentId: eventPayload.payment.entity.id,
            orderId: eventPayload.payment.entity.order_id,
            amount: eventPayload.payment.entity.amount / 100,
            status: 'failed',
            paymentMethod: eventPayload.payment.entity.method
          };
        case 'subscription.charged':
          return {
            event: 'subscription.payment.success',
            subscriptionId: eventPayload.subscription.entity.id,
            paymentId: eventPayload.payment.entity.id,
            amount: eventPayload.payment.entity.amount / 100,
            status: 'success'
          };
        default:
          return null;
      }
    } catch (error) {
      console.error('Error processing Razorpay webhook data:', error);
      return null;
    }
  }
}

module.exports = new RazorpayGateway(); 