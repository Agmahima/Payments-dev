

// PaymentService.js
const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const PaymentMethod=  require('../models/paymentMethodSchema');
const cashfreeHandler = require('../gateways/cashfree');

// Utility: Generate a unique order id
const generateOrderId = () => {
  return `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

/**
 * getPGRequestUrl
 * 
 */
async function getPGRequestUrl(req, res) {
  try {
    const { amount, startupId } = req.query;
    const user = req.user;
    if (!user || !user.kycComplete) {
      return res.status(400).json({ error: 'User KYC not complete' });
    }

    // Retrieve startup details (for excro integration)
    const startup = await require('../models/Startup').findOne({
      _id: startupId,
      status: 'ongoing'
    }, { excroApiKey: 1, excroSalt: 1, product_name: 1, status: 1 });
    if (!startup) {
      return res.status(400).json({ error: 'Invalid startup' });
    }
    if (startup.min_investment_value > amount) {
      return res.status(400).json({ error: 'Amount should be more than min investment amount' });
    }
    if (startup.status !== 'ongoing') {
      return res.status(400).json({ error: 'Startup not ongoing campaign' });
    }

    const investmentDoc = new (require('../models/Investment'))({
      investor_id: user._id,
      startup_id: startup._id,
      amount,
      status: 'ongoing',
      paymentMethod: 'pg',
      pg: 'excro',
    });

    const savedInvestment = await investmentDoc.save();

    // Build payload for Cashfree order creation using excro integration
    const rawBodyData = {
      amount,
      api_key: startup.excroApiKey,
      city: user.panKyc.city,
      currency: 'INR',
      mode: process.env.NODE_ENV === 'production' ? 'LIVE' : 'TEST',
      country: 'India',
      description: `Investment for ${startup.product_name}`,
      email: user.email,
      name: user.panKyc.name,
      phone: user.phone_no,
      zip_code: user.panKyc.pinCode,
      order_id: savedInvestment.order_id,
      payment_options: 'nb,upi',
      return_url: process.env.BACKEND_URL + '/api/v1/payment/pg-callback-success',
      return_url_cancel: process.env.BACKEND_URL + '/api/v1/payment/pg-callback-cancel',
      return_url_failure: process.env.BACKEND_URL + '/api/v1/payment/pg-callback-fail',
    };

    let tempString = '';
    const sortedBody = Object.keys(rawBodyData)
      .sort()
      .reduce((acc, key) => {
        acc[key] = rawBodyData[key];
        return acc;
      }, {});
    for (const key in sortedBody) {
      tempString += '|' + sortedBody[key];
    }
    tempString = startup.excroSalt + tempString;
    const hash = crypto.createHash('sha512').update(tempString).digest('hex').toUpperCase();

    const payload = { ...sortedBody, hash };

    const data = await axios.post(process.env.CASHFREE_BASE_URL + '/orders?api_version=' + API_VERSION, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return res.json(data.data);
  } catch (error) {
    console.error('Error in getPGRequestUrl:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * createPayment
 * Handles both one-time (Investment) and subscription payments.
 */
async function createPayment(req, res) {
  try {
    console.log("Request body:", req.body);
    const {
      payment_purpose,      // "Investment" or "Subscription"
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
      return_url,           // e.g., https://investment.nucleohq.com/payment-status?order_id={order_id}
      notify_url,           // e.g., https://api.nucleohq.com/api/v1/payment/webhook
      paymentMethod,        // "Debit Card", "upi", "net_banking", etc.
      payment_details,      // Object with method-specific details
      isSubscription,       // boolean flag
      subscriptionType      // e.g., "monthly", "yearly", "auto-debit", "one-time"
    } = req.body;
    const userId = req.user ? req.user._id : "65f123456789abcdef123456";

    // Validate required fields
    if (!payment_purpose || !payment_amount || !payee_ref || !payee_type ||
        !receiver_ref || !receiver_type || !customer_email || !customer_phone ) {
      console.log("Missing required fields:", req.body);
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Payment method–specific validations
    if (paymentMethod === "Debit Card") {
      if (!payment_details?.card_number || !payment_details?.expiry || !payment_details?.cvv) {
        return res.status(400).json({ success: false, message: "Debit Card details are required" });
      }
    } else if (paymentMethod === "upi") {
      if (!payment_details?.upi_id) {
        return res.status(400).json({ success: false, message: "UPI ID is required" });
      }
    } else if (paymentMethod === "net_banking") {
      if (!payment_details?.bank_code) {
        return res.status(400).json({ success: false, message: "Bank code is required" });
      }
    }

    // Create a Payment record (using MongoDB _id as  order id for Cashfree)
    const orderId = generateOrderId();
    const PaymentModel = Payment;
    const paymentRecord = new PaymentModel({
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

    // Build payload for Cashfree order creation
    const payload = {
      order_id: paymentRecord._id.toString(), // Use DB _id as order id in gateway payload
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

    // Call Cashfree API through your handler
    const result = await cashfreeHandler.initiatePayment(payload);
    if (!result.success) {
      await PaymentModel.findByIdAndUpdate(paymentRecord._id, {
        payment_status: 'FAILED',
        updated_by: new mongoose.Types.ObjectId(userId)
      });
      return res.status(400).json({ success: false, message: result.error, error: result.gatewayResponse });
    }

    // Create a Transaction record
    const TransactionModel = Transaction;
    const transactionRecord = new TransactionModel({
      transaction_mode: paymentMethod,
      payment_id: paymentRecord._id,
      gateway_used: 'CASHFREE',
      gateway_response: result.gatewayResponse,
      created_by: new mongoose.Types.ObjectId(userId),
      updated_by: new mongoose.Types.ObjectId(userId)
    });
    await transactionRecord.save();

    // Link the Transaction record to Payment record
    await PaymentModel.findByIdAndUpdate(paymentRecord._id, {
      transaction: transactionRecord._id,
      updated_by: new mongoose.Types.ObjectId(userId)
    });

    // Save tokenized payment method details (if Debit Card and token exists)
    if (paymentMethod === "Debit Card" && result.gatewayResponse && result.gatewayResponse.token_id) {
      const PaymentMethod = require('../models/PaymentMethod');
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

    // If subscription, and subscriptionType is not "one-time", then call Cashfree Subscription API
    if (isSubscription && subscriptionType && subscriptionType !== "one-time") {
      try {
        const subscriptionPayload = {
          order_id: paymentRecord._id.toString(),
          plan_id: process.env.CASHFREE_SUBSCRIPTION_PLAN_ID, // Pre-configured plan in Cashfree dashboard
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
          subscription_type: subscriptionType // e.g., "monthly", "yearly", "auto-debit"
        };

        const subResult = await axios.post(
          process.env.CASHFREE_BASE_URL + '/subscriptions?api_version=' + API_VERSION,
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
        await PaymentModel.findByIdAndUpdate(paymentRecord._id, {
          subscription_id: subResult.data.subscription_id,
          subscription_status: subResult.data.status,
          updated_by: new mongoose.Types.ObjectId(userId)
        });
      } catch (subError) {
        console.error("Recurring mandate setup error:", subError.response ? subError.response.data : subError.message);
        // Optionally update paymentRecord to flag subscription mandate setup failure.
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
}

/**
 * webhookHandler: Processes Cashfree webhook callbacks.
 * Expects req.rawBody to be set via middleware.
 */

async function webhookHandler(req, res) {
  try {
    const webhookSignature = req.headers["x-webhook-signature"] || 
                            req.headers["x-webhook-signature-256"];

    console.log("Webhook received:", {
      signature: webhookSignature,
      rawBody: req.rawBody
    });

    // Verify signature unless explicitly skipped
    if (process.env.SKIP_WEBHOOK_VERIFICATION !== 'true') {
      if (!webhookSignature) {
        console.error("Missing webhook signature");
        return res.status(400).json({ error: "Missing webhook signature" });
      }

      const isValid = cashfreeHandler.verifyWebhookSignature(req.rawBody, webhookSignature);
      if (!isValid) {
        console.error("Invalid webhook signature");
        return res.status(400).json({ error: "Invalid signature" });
      }
    }

    // Destructure the webhook data
    const { data: { order, payment, customer_details }, type } = req.body;

    // Find the transaction
    const transaction = await Transaction.findOne({ payment_id: order.order_id });
    if (!transaction) {
      console.error("Transaction not found:", order.order_id);
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Initialize payment method details
    let paymentMethodDetails = {};

    // Update payment method details and save tokenized card if available
    if (payment.payment_method) {
      if (payment.payment_method.card) {
        const cardDetails = payment.payment_method.card;
        
        // Update transaction payment method details
        transaction.transaction_mode = 'CARD';
        paymentMethodDetails = {
          card: {
            channel: cardDetails.channel,
            card_number: cardDetails.card_number,
            card_network: cardDetails.card_network,
            card_type: cardDetails.card_type,
            card_bank_name: cardDetails.card_bank_name
          }
        };

        // Save tokenized card if customer details are available
        if (customer_details?.customer_id) {
          const tokenData = {
            user_id: customer_details.customer_id,
            method_type: 'CARD',
            card_token: payment.cf_token_id || `cf_${payment.cf_payment_id}`,
            card_network: cardDetails.card_network,
            card_type: cardDetails.card_type,
            card_last4: cardDetails.card_number.slice(-4),
            card_bank_name: cardDetails.card_bank_name,
            gateway: 'CASHFREE',
            last_used: new Date(),
            is_default: false
          };

          // Check if this is the first card for the user
          const existingCards = await PaymentMethod.countDocuments({
            user_id: customer_details.customer_id,
            method_type: 'CARD'
          });
          
          if (existingCards === 0) {
            tokenData.is_default = true;
          }

          // Save or update the payment method
          await PaymentMethod.findOneAndUpdate(
            { 
              card_token: tokenData.card_token,
              gateway: 'CASHFREE'
            },
            tokenData,
            { upsert: true, new: true }
          );

          console.log('Saved tokenized card:', tokenData.card_last4);
        }
      } else if (payment.payment_method.upi) {
        transaction.transaction_mode = 'UPI';
        paymentMethodDetails = {
          upi: {
            channel: payment.payment_method.upi.channel,
            upi_id: payment.payment_method.upi.upi_id
          }
        };
      } else if (payment.payment_method.netbanking) {
        transaction.transaction_mode = 'NET_BANKING';
        paymentMethodDetails = {
          netbanking: {
            bank_name: payment.payment_method.netbanking.bank_name
          }
        };
      }
    }

    // Update transaction details
    transaction.payment_method_details = paymentMethodDetails;
    transaction.transaction_id = payment.cf_payment_id;
    transaction.transaction_status = payment.payment_status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
    transaction.gateway_response = req.body;
    transaction.amount = payment.payment_amount;
    transaction.currency = payment.payment_currency;

    await transaction.save();

    // Update payment status
    await Payment.findByIdAndUpdate(order.order_id, {
      payment_status: payment.payment_status,
      updated_by: transaction.created_by
    });

    console.log("Webhook processed successfully:", {
      orderId: order.order_id,
      status: payment.payment_status,
      amount: payment.payment_amount,
      paymentMethod: transaction.transaction_mode
    });
  
    return res.status(200).json({ success: true });
  
  } catch (error) {
    console.error("Webhook processing error:", error, error.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}
/**
 * getPaymentStatus: Checks and updates the payment status.
 */
async function getPaymentStatus(req, res) {
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
          {
            gateway_response: { ...payment.transaction.gateway_response, statusCheck: result.gatewayResponse },
            updated_by: new mongoose.Types.ObjectId(userId)
          }
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
}

module.exports = {
  getAvailablePaymentMethods: async (req, res) => {
    res.json({ success: true, data: [] });
  },
  webhookHandler,
  createPayment,
  getPaymentStatus
};
