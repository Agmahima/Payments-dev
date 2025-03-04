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
    const gateways = await PaymentGateway.find({
      isActive: true,
      'supportedRegions': { $elemMatch: { country, currency, isActive: true } }
    }).sort({ priority: -1 });
    const gatewaysWithMethods = gateways.map(gateway => ({
      id: gateway._id,
      name: gateway.gateway_name,
      description: gateway.description,
      logo: gateway.logoUrl,
      paymentMethods: gateway.getActivePaymentMethods(parseFloat(amount))
    }));
    res.json({ success: true, data: gatewaysWithMethods });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const initiatePayment = async (req, res) => {
  try {
    const { amount, paymentMethod, customer_name, customer_email, customer_phone, return_url, notify_url } = req.body;
    const userId = req.user?._id || "65f123456789abcdef123456";
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
      order_note: req.body.description || `Payment for ${paymentMethod}`
    };
    const result = await cashfreeHandler.initiatePayment(payload);
    res.json(result);
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
      notify_url
    } = req.body;
    const userId = req.user?._id || "65f123456789abcdef123456";
    if (!payment_purpose || !payment_amount || !payee_ref || !payee_type || !receiver_ref || !receiver_type || !customer_email || !customer_phone) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const orderId = generateOrderId();
    const payment = new Payment({
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
    await payment.save();
    const payload = {
      order_id: payment._id.toString(),
      order_amount: payment_amount,
      order_currency: payment_currency,
      customer_details: {
        customer_id: userId,
        customer_name: customer_name || 'Customer',
        customer_email,
        customer_phone
      },
      order_meta: { return_url, notify_url },
      order_note: description || `Payment for ${payment_purpose}`
    };
    const result = await cashfreeHandler.initiatePayment(payload);
    if (!result.success) {
      await Payment.findByIdAndUpdate(payment._id, {
        payment_status: 'FAILED',
        updated_by: new mongoose.Types.ObjectId(userId)
      });
      return res.status(400).json({ success: false, message: result.error, error: result.gatewayResponse });
    }
    const transaction = new Transaction({
      transaction_mode: 'OTHER',
      payment_id: payment._id,
      gateway_used: 'CASHFREE',
      gateway_response: result.gatewayResponse,
      created_by: new mongoose.Types.ObjectId(userId),
      updated_by: new mongoose.Types.ObjectId(userId)
    });
    await transaction.save();
    await Payment.findByIdAndUpdate(payment._id, {
      transaction: transaction._id,
      updated_by: new mongoose.Types.ObjectId(userId)
    });
    return res.status(200).json({
      success: true,
      payment_id: payment._id,
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
    const userId = req.user?._id || "65f123456789abcdef123456";
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
    if (payment.transaction?.gateway_response?.paymentId) {
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
