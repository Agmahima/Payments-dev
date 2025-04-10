const RazorpayService = require('./razorpay');
const CashfreeService = require('./cashfree');

class PaymentService {
  
  // Process subscription payments for both gateways
  static async processSubscription(paymentData) {
    if (!paymentData.gateway) {
      throw new Error('Payment gateway is required');
    }

    switch (paymentData.gateway) {
      case 'RAZORPAY':
        return await RazorpayService.createSubscription(paymentData);

      case 'CASHFREE':
        return await CashfreeService.createSubscription(paymentData);

      default:
        throw new Error('Invalid payment gateway');
    }
  }

  // Process one-time payments for both gateways
  static async processPayment(paymentData) {
    if (!paymentData.gateway) {
      throw new Error('Payment gateway is required');
    }

    const normalizedData = PaymentService.normalizePayload(paymentData);


    switch (paymentData.gateway) {
      case 'RAZORPAY':
        return await RazorpayService.createOrder(paymentData);

      case 'CASHFREE':
        return await CashfreeService.createPayment(paymentData);

      default:
        throw new Error('Invalid payment gateway');
    }
  }

  static normalizePayload(paymentData) {
    const commonPayload = {
        amount: paymentData.payment_amount,
        currency: paymentData.payment_currency || 'INR',
        customer: {
            name: paymentData.customer_name,
            email: paymentData.customer_email,
            phone: paymentData.customer_phone
        },
        meta: {
            return_url: paymentData.return_url,
            notify_url: paymentData.notify_url
        },
        payee: {
            ref: paymentData.payee_ref,
            type: paymentData.payee_type,
            location: paymentData.payee_location || null
        },
        receiver: {
            ref: paymentData.receiver_ref,
            type: paymentData.receiver_type
        },
        description: paymentData.description || '',
        payment_method: paymentData.payment_method || null,
        payment_details: paymentData.payment_details || {},
        created_by: paymentData.created_by || "SYSTEM",
        updated_by: paymentData.updated_by || "SYSTEM"
    };

    if (paymentData.gateway === 'RAZORPAY') {
        return {
            order_id: `rzp_${commonPayload.payee.ref}_${Date.now()}`,
            amount: commonPayload.amount * 100, // Razorpay requires amount in paise
            currency: commonPayload.currency,
            receipt: `receipt_${Date.now()}`,
            notes: {
                description: commonPayload.description,
                payee: commonPayload.payee,
                receiver: commonPayload.receiver
            },
            customer: commonPayload.customer,
            created_by: commonPayload.created_by, // Moved to root level
            updated_by: commonPayload.updated_by  // Moved to root level
        };
    } 
    
    if (paymentData.gateway === 'CASHFREE') {
        return {
            order_id: `cf_${commonPayload.payee.ref}_${Date.now()}`,
            order_amount: commonPayload.amount,
            order_currency: commonPayload.currency,
            customer_details: commonPayload.customer,
            order_meta: {
                ...commonPayload.meta
            },
            order_note: commonPayload.description,
            payment_method: commonPayload.payment_method,
            payment_details: commonPayload.payment_details,
            created_by: commonPayload.created_by, // Moved to root level
            updated_by: commonPayload.updated_by  // Moved to root level
        };
    }

    return commonPayload; // Return default if no transformation is needed
}

static async handleWebhook(gateway, payload, signature, headers) {
  if (!gateway) {
    throw new Error('Payment gateway is required');
  }

  // Normalize gateway name
  gateway = gateway.toUpperCase();
  
  // Skip signature verification in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Skipping ${gateway} signature verification in development`);
  } else {
    if (!signature) {
      console.error(`${gateway} webhook signature is missing`);
      throw new Error('Webhook signature is missing');
    }

    // Verify signature based on gateway
    let isValid = false;
    
    switch (gateway) {
      case 'RAZORPAY':
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
          throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
        }
        // Use crypto to verify signature
        const crypto = require('crypto');
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(JSON.stringify(payload))
          .digest('hex');
        isValid = expectedSignature === signature;
        break;

      case 'CASHFREE':
        isValid = CashfreeService.verifyWebhookSignature(payload, signature);
        break;

      default:
        throw new Error('Invalid payment gateway');
    }
    
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }
  }
  
  // Process the webhook data
  let parsedData;
  
  switch (gateway) {
    case 'RAZORPAY':
      parsedData = RazorpayService.processWebhookData(payload);
      break;
    case 'CASHFREE':
      parsedData = CashfreeService.processWebhookData(payload);
      break;
    default:
      throw new Error('Invalid payment gateway');
  }

  // Handle the parsed webhook data
  if (parsedData.event.startsWith('subscription.')) {
    return await PaymentService.handleSubscriptionEvent(parsedData);
  } else if (parsedData.event.startsWith('payment.') || parsedData.event === 'order.paid') {
    return await PaymentService.handlePaymentEvent(parsedData);
  } else {
    console.log(`Unhandled event type: ${parsedData.event}`);
    return { success: true, event: parsedData.event, processed: false };
  }
}

// Helper methods to handle different event types
static async handleSubscriptionEvent(data) {
  const { event, subscription_id, status } = data;
  
  // Update subscription status in your database
  // This would call into your data layer or model methods
  
  return { success: true, event, subscription_id, processed: true };
}

static async handlePaymentEvent(data) {
  const { event, payment_id, order_id, status } = data;
  
  // Update payment status in your database
  // This would call into your data layer or model methods
  
  return { success: true, event, payment_id, processed: true };
}

}

module.exports = PaymentService;
