const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const cashfreeHandler = require('../gateways/cashfree');
const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
// const PaymentGateway = require('../models/PaymentGateway');

const generateOrderId = () => {
  return `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

const getAvailablePaymentMethods = async (req, res) => {
  try {
    const { amount, currency = 'INR', country = 'IN' } = req.query;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });
    // const gateways = await PaymentGateway.find({
    //   isActive: true,
    //   'supportedRegions': { $elemMatch: { country, currency, isActive: true } }
    // }).sort({ priority: -1 });
    // const gatewaysWithMethods = gateways.map(gateway => ({
    //   id: gateway._id,
    //   name: gateway.gateway_name,
    //   description: gateway.description,
    //   logo: gateway.logoUrl,
    //   paymentMethods: gateway.getActivePaymentMethods(parseFloat(amount))
    // }));
    return res.json({ success: true, data: [{ name: "Cashfree", paymentMethods: ["Debit Card", "upi", "net_banking"] }] });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const initiatePayment = async (req, res) => {
  try {
    const { 
      amount, 
      paymentMethod, 
      customer_name, 
      customer_email, 
      customer_phone, 
      return_url, 
      notify_url, 
      payment_details // Contains dynamic payment method data (card details, UPI id, etc.)
    } = req.body;

    if (!amount || !paymentMethod) {
      return res.status(400).json({ error: 'Amount and payment method are required' });
    }
    
    const userId = req.user ? req.user._id : "65f123456789abcdef123456";
    
    const payload = {
      order_id: generateOrderId(),
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: userId,
        customer_name: customer_name || 'Customer',
        customer_email,
        customer_phone
      },
      order_meta: { return_url, notify_url },
      order_note: `Payment for ${paymentMethod}`
    };
    
    // Dynamically attach payment details if provided
    if (payment_details) {
      payload.paymentMethod = paymentMethod;
      payload[paymentMethod] = payment_details;
    }
    
    const result = await cashfreeHandler.initiatePayment(payload);
    return res.json(result);
  } catch (error) {
    console.error('Payment initiation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const createPayment = async (req, res) => {
    try {
      const {
        payment_purpose,
        payment_amount,
        payment_currency = 'INR',
        payee_ref,
        payee_type,
        receiver_ref,
        receiver_type,
        customer_name,
        customer_email,
        customer_phone,
        description,
        return_url,
        notify_url,
        paymentMethod,
        payment_details,
        isSubscription,    // true if this is a subscription payment
        subscriptionType   // e.g., "one-time", "monthly", "yearly", "auto-debit"
      } = req.body;
      const userId = req.user ? req.user._id : "65f123456789abcdef123456";
      
      // Validate required fields...
      
      // Create Payment record
      const orderId = generateOrderId();
      const paymentRecord = new Payment({
        request_ref: orderId,
        payment_purpose,
        payment_amount,
        payment_currency,
        payee_ref: new mongoose.Types.ObjectId(payee_ref),
        payee_type,
        receiver_ref: new mongoose.Types.ObjectId(receiver_ref),
        receiver_type,
        payment_gateway: 'CASHFREE',
        payment_status: 'PENDING',
        created_by: new mongoose.Types.ObjectId(userId),
        updated_by: new mongoose.Types.ObjectId(userId)
      });
      await paymentRecord.save();
  
      // Build payload for Cashfree
      const payload = {
        order_id: paymentRecord._id.toString(),
        order_amount: payment_amount,
        order_currency: payment_currency,
        customer_details: {
          customer_id: userId,
          customer_name: customer_name || 'Customer',
          customer_email,
          customer_phone
        },
        order_meta: { return_url, notify_url },
        order_note: description || `Payment for ${payment_purpose}`,
        payment_method: paymentMethod,
        payment_details: payment_details || {}
      };
  
      const result = await cashfreeHandler.initiatePayment(payload);
      if (!result.success) {
        await Payment.findByIdAndUpdate(paymentRecord._id, {
          payment_status: 'FAILED',
          updated_by: new mongoose.Types.ObjectId(userId)
        });
        return res.status(400).json({ success: false, message: result.error, error: result.gatewayResponse });
      }
  
      // Create Transaction record
      const transactionRecord = new Transaction({
        transaction_mode: paymentMethod,
        payment_id: paymentRecord._id,
        gateway_used: 'CASHFREE',
        gateway_response: result.gatewayResponse,
        created_by: new mongoose.Types.ObjectId(userId),
        updated_by: new mongoose.Types.ObjectId(userId)
      });
      await transactionRecord.save();
  
      await Payment.findByIdAndUpdate(paymentRecord._id, {
        transaction: transactionRecord._id,
        updated_by: new mongoose.Types.ObjectId(userId)
      });
  
      // If it's a recurring subscription, trigger recurring mandate registration.
      if (isSubscription && subscriptionType !== "one-time") {
        try {
          const subscriptionPayload = {
            order_id: paymentRecord._id.toString(),
            plan_id: process.env.CASHFREE_SUBSCRIPTION_PLAN_ID,  // Must be set in your .env
            subscription_amount: payment_amount,
            subscription_currency: payment_currency,
            customer_details: {
              customer_id: userId,
              customer_name: customer_name || 'Customer',
              customer_email,
              customer_phone
            },
            order_meta: { return_url, notify_url },
            order_note: description || `Subscription Payment for ${payment_purpose}`,
            subscription_type: subscriptionType  // e.g., "monthly", "yearly", "auto-debit"
          };
  
          const subResult = await axios.post(
            `${process.env.CASHFREE_PG_BASE_URL}/subscriptions`,
            subscriptionPayload,
            {
              headers: {
                'x-api-version': API_VERSION,
                'Content-Type': 'application/json',
                'x-client-id': process.env.CASHFREE_APP_ID,
                'x-client-secret': process.env.CASHFREE_SECRET_KEY,
                Accept: 'application/json'
              }
            }
          );
          console.log("Subscription API response:", subResult.data);
          await Payment.findByIdAndUpdate(paymentRecord._id, {
            subscription_id: subResult.data.subscription_id,
            subscription_status: subResult.data.status,
            updated_by: new mongoose.Types.ObjectId(userId)
          });
        } catch (subError) {
          console.error("Recurring mandate setup error:", subError.response ? subError.response.data : subError.message);
          // Optionally update payment as needing manual intervention or mark as failed.
        }
      }
  
      // Save tokenized details if using Debit Card and token is returned.
      if (paymentMethod === "CARD" && result.gatewayResponse && result.gatewayResponse.token_id) {
        const existingToken = await PaymentMethod.findOne({ user_id: userId, card_token: result.gatewayResponse.token_id });
        if (!existingToken) {
          const paymentMethodRecord = new PaymentMethod({
            user_id: new mongoose.Types.ObjectId(userId),
            method_type: "CARD",
            card_token: result.gatewayResponse.token_id,
            card_network: result.gatewayResponse.card_network || "UNKNOWN",
            card_type: result.gatewayResponse.card_type || "DEBIT",
            card_last4: result.gatewayResponse.card_last4 || "0000",
            card_expiry: result.gatewayResponse.card_expiry || "00/00",
            is_default: false
          });
          await paymentMethodRecord.save();
        }
      }
  
      return res.status(200).json({
        success: true,
        payment_id: paymentRecord._id,
        order_id: orderId,
        payment_session_id: result.paymentSessionId,
        payment_link: result.paymentLink
      });
    } catch (error) {
      console.error('Payment creation error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  };
  
  const webhookHandler = async (req, res) => {
    try {
      const webhookSignature = req.headers["x-webhook-signature"];
      console.log("Received webhook signature:", webhookSignature);
      console.log("Raw body received:", req.rawBody);
  
      const computedSignature = crypto.createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
        .update(req.rawBody)
        .digest("base64");
      console.log("Computed signature:", computedSignature);
  
      if (webhookSignature !== computedSignature) {
        console.error("Signature mismatch!");
        return res.status(400).json({ error: "Invalid signature" });
      }
  
      const { order, payment } = req.body.data;
      const paymentDoc = await Payment.findOne({ request_ref: order.order_id });
      if (!paymentDoc) return res.status(404).json({ error: "Payment not found" });
      const transaction = await Transaction.findOne({ payment_id: paymentDoc._id });
      if (!transaction) return res.status(404).json({ error: "Transaction not found" });
  
      if (payment.payment_status === "SUCCESS") {
        paymentDoc.payment_status = 'SUCCESS';
        transaction.gateway_response.status = 'SUCCESS';
      } else {
        paymentDoc.payment_status = 'FAILED';
        transaction.gateway_response.status = 'FAILED';
      }
      await transaction.save();
      await paymentDoc.save();
  
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(500).json({ error: error.message });
    }
  };
  
  const getPaymentStatus = async (req, res) => {
    try {
      const { paymentId } = req.params;
      const userId = req.user ? req.user._id : "65f123456789abcdef123456";
      const payment = await Payment.findById(paymentId).populate('transaction');
      if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
      if (['SUCCESS', 'FAILED', 'CANCELLED'].includes(payment.payment_status)) {
        return res.status(200).json({
          success: true,
          payment_id: payment._id,
          status: payment.payment_status,
          amount: payment.payment_amount,
          currency: payment.payment_currency,
          purpose: payment.payment_purpose,
          created_at: payment.createdAt
        });
      }
      if (payment.transaction && payment.transaction.gateway_response && payment.transaction.gateway_response.paymentId) {
        const result = await cashfreeHandler.getPaymentStatus(
          payment._id.toString(),
          payment.transaction.gateway_response.paymentId
        );
        if (result.success) {
          await Transaction.findByIdAndUpdate(
            payment.transaction._id,
            { gateway_response: { ...payment.transaction.gateway_response, statusCheck: result.gatewayResponse }, updated_by: new mongoose.Types.ObjectId(userId) }
          );
          const newStatus = result.status === 'SUCCESS' ? 'SUCCESS' : result.status === 'FAILED' ? 'FAILED' : 'PENDING';
          if (newStatus !== payment.payment_status) {
            payment.payment_status = newStatus;
            payment.updated_by = new mongoose.Types.ObjectId(userId);
            await payment.save();
          }
          return res.status(200).json({
            success: true,
            payment_id: payment._id,
            status: newStatus,
            gateway_status: result.status,
            amount: payment.payment_amount,
            currency: payment.payment_currency,
            details: result.gatewayResponse
          });
        }
      }
      return res.status(200).json({
        success: true,
        payment_id: payment._id,
        status: payment.payment_status,
        amount: payment.payment_amount,
        currency: payment.payment_currency,
        purpose: payment.payment_purpose,
        message: 'Payment is being processed'
      });
    } catch (error) {
      console.error('Payment status check error:', error);
      return res.status(500).json({ success: false, message: 'Failed to check payment status', error: error.message });
    }
  };
  
  module.exports = {
    getAvailablePaymentMethods,
    initiatePayment,
    webhookHandler,
    createPayment,
    getPaymentStatus
  };
  