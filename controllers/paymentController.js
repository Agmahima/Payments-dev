// PaymentService.js
const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const PaymentMethod=  require('../models/paymentMethodSchema');
const cashfreeGateway = require('../gateways/cashfree');
const paymentConfig = require('../config/payment');
const razorpayGateway = require('../gateways/razorpay');
const geoip = require('../utils/geoip'); // You'll need to implement this
const paymentService = require('../services/PaymentService.js');
const { $where } = require('../models/userSubscriptionSchema.js');


//investment payment through razorpay
async function createInvestmentPayment(req, res) {
  try {
    const { gateway } = req.body;
    if (!gateway) {
      return res.status(400).json({ success: false, error: 'Gateway not specified' });
    }

    const result = await paymentService.processPayment(req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating Payment', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}


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

      const isValid = cashfreeGateway.verifyWebhookSignature(req.rawBody, webhookSignature);
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
      } else if (payment.payment_method.wallet) {
        transaction.transaction_mode = 'WALLET';
      } else {
        transaction.transaction_mode = 'OTHER';
      }
      await transaction.save();
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
      const result = await cashfreeGateway.getPaymentStatus(
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

/**
 * Get available payment gateways based on region
 */
const getAvailableGateways = async (req, res) => {
  try {
    // Get client IP
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Detect region (can be overridden by query param for testing)
    const region = req.query.region || await geoip.getRegion(ip);
    
    // Get gateways for this region from config
    const gatewayNames = paymentConfig.regionMap[region] || paymentConfig.regionMap.default;
    
    // Filter enabled gateways and return their configurations
    const gateways = gatewayNames
      .filter(name => paymentConfig.gateways[name] && paymentConfig.gateways[name].enabled)
      .map(name => ({
        id: name,
        name: paymentConfig.gateways[name].name,
        supportedMethods: paymentConfig.gateways[name].supportedMethods,
        subscriptionEnabled: paymentConfig.gateways[name].subscriptionEnabled
      }));
    
    return res.status(200).json({
      success: true,
      region,
      gateways
    });
  } catch (error) {
    console.error('Error getting available gateways:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment gateways'
    });
  }
};

/**
 * Create payment
 */
exports.createPayment = async (req, res) => {
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
      gateway = 'auto', // 'auto', 'cashfree', 'razorpay', etc.
      isSubscription = false,
      subscriptionType = 'one-time'
    } = req.body;
    
    const userId = req.user ? req.user._id : null;
    
    // Validate required fields
    if (!payment_purpose || !payment_amount || !payee_ref || !payee_type ||
        !receiver_ref || !receiver_type || !customer_email || !customer_phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // Generate unique order ID
    const orderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Create payment record
    const paymentRecord = new Payment({
      request_ref: orderId,
      payment_purpose,
      payment_amount,
      payment_currency,
      payee_ref: new mongoose.Types.ObjectId(payee_ref),
      payee_type,
      receiver_ref: new mongoose.Types.ObjectId(receiver_ref),
      receiver_type,
      payment_status: 'PENDING',
      is_subscription: isSubscription,
      subscription_type: subscriptionType,
      created_by: new mongoose.Types.ObjectId(userId),
      updated_by: new mongoose.Types.ObjectId(userId)
    });
    
    await paymentRecord.save();
    
    // Determine gateway to use
    let selectedGateway = gateway;
    if (gateway === 'auto') {
      // Get client IP for region detection
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const region = await geoip.getRegion(ip);
      
      // Get gateways for this region
      const gatewayNames = paymentConfig.regionMap[region] || paymentConfig.regionMap.default;
      
      // Filter for enabled gateways and subscription support if needed
      const availableGateways = gatewayNames
        .filter(name => paymentConfig.gateways[name] && paymentConfig.gateways[name].enabled)
        .filter(name => !isSubscription || paymentConfig.gateways[name].subscriptionEnabled);
      
      if (availableGateways.length > 0) {
        selectedGateway = availableGateways[0];
      } else {
        selectedGateway = 'cashfree'; // Default fallback
      }
    }
    
    // Update payment record with selected gateway
    paymentRecord.payment_gateway = selectedGateway.toUpperCase();
    await paymentRecord.save();
    
    // Common order data for all gateways
    const orderData = {
      orderId: paymentRecord._id.toString(),
      amount: payment_amount,
      currency: payment_currency,
      customerId: userId,
      customerEmail: customer_email,
      customerPhone: customer_phone,
      customerName: customer_name,
      description,
      metadata: {
        payment_id: paymentRecord._id.toString(),
        return_url,
        notify_url
      }
    };
    
    let gatewayResponse;
    
    // Process with selected gateway
    switch (selectedGateway.toLowerCase()) {
      case 'razorpay':
        if (isSubscription && subscriptionType !== 'one-time') {
          // Handle Razorpay subscription
          const subscriptionData = {
            planId: process.env.RAZORPAY_SUBSCRIPTION_PLAN_ID,
            customerId: userId,
            totalCount: subscriptionType === 'yearly' ? 12 : 
                       (subscriptionType === 'monthly' ? 1 : undefined),
            customerEmail: customer_email,
            customerPhone: customer_phone,
            customerName: customer_name,
            notes: {
              description,
              payment_id: paymentRecord._id.toString()
            }
          };
          
          gatewayResponse = await razorpayGateway.createSubscription(subscriptionData);
          
          // Update payment with subscription info
          if (gatewayResponse.success) {
            await Payment.findByIdAndUpdate(paymentRecord._id, {
              subscription_id: gatewayResponse.subscriptionId,
              
              subscription_status: gatewayResponse.status,
              updated_by: new mongoose.Types.ObjectId(userId)
            });
          }
        } else {
          // Handle Razorpay one-time payment
          gatewayResponse = await razorpayGateway.createOrder(orderData);
        }
        break;
        
      case 'cashfree':
      default:
        // Use Cashfree gateway
        const cashfreePayload = {
          order_id: paymentRecord._id.toString(),
          order_amount: payment_amount,
          order_currency: payment_currency,
          customer_details: {
            customer_id: userId,
            customer_name: customer_name || 'Customer',
            customer_email: customer_email,
            customer_phone: customer_phone
          },
          order_meta: { 
            return_url: return_url, 
            notify_url: notify_url 
          },
          order_note: description || `Payment for ${payment_purpose}`
        };
        
        if (isSubscription && subscriptionType !== 'one-time') {
          // Handle Cashfree subscription
          const subscriptionPayload = {
            ...cashfreePayload,
            plan_id: process.env.CASHFREE_SUBSCRIPTION_PLAN_ID,
            subscription_amount: payment_amount,
            subscription_currency: payment_currency,
            subscription_type: subscriptionType
          };
          
          gatewayResponse = await cashfreeGateway.createSubscription(subscriptionPayload);
          
          // Update payment with subscription info
          if (gatewayResponse.success) {
            await Payment.findByIdAndUpdate(paymentRecord._id, {
              subscription_id: gatewayResponse.subscriptionId,
              subscription_status: gatewayResponse.status,
              updated_by: new mongoose.Types.ObjectId(userId)
            });
          }
        } else {
          // Handle Cashfree one-time payment
          gatewayResponse = await cashfreeGateway.initiatePayment(cashfreePayload);
        }
    }
    
    // If failed to create order/subscription
    if (!gatewayResponse.success) {
      return res.status(400).json({
        success: false,
        message: gatewayResponse.error || 'Failed to create payment',
        paymentId: paymentRecord._id.toString()
      });
    }
    
    // Create transaction record
    const transaction = new Transaction({
      payment_ref: paymentRecord._id,
      transaction_id: gatewayResponse.orderId || gatewayResponse.subscriptionId,
      transaction_status: 'PENDING',
      transaction_gateway: selectedGateway.toUpperCase(),
      transaction_mode: 'ONLINE',
      created_by: new mongoose.Types.ObjectId(userId),
      updated_by: new mongoose.Types.ObjectId(userId)
    });
    
    await transaction.save();
    
    // Return success with gateway-specific data
    return res.status(200).json({
      success: true,
      paymentId: paymentRecord._id.toString(),
      orderId: gatewayResponse.orderId,
      gateway: selectedGateway,
      gatewayData: {
        ...gatewayResponse,
        // For Razorpay frontend integration
        keyId: selectedGateway.toLowerCase() === 'razorpay' ? 
               process.env.RAZORPAY_KEY_ID : undefined,
        // For Cashfree frontend integration
        paymentSessionId: gatewayResponse.paymentSessionId,
        paymentLink: gatewayResponse.paymentLink
      }
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get payment status
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentId } = req.query;
    
    // Find payment record
    const payment = await Payment.findOne({
      $or: [
        { _id: orderId },
        { request_ref: orderId },
        { 'gateway_response.order_id': orderId }
      ]
    });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Find transaction
    const transaction = await Transaction.findOne({
      payment_ref: payment._id
    });
    
    // Check payment status from gateway
    let gatewayResponse;
    
    if (payment.payment_gateway === 'RAZORPAY') {
      gatewayResponse = await razorpayGateway.getPaymentStatus(
        paymentId, 
        transaction ? transaction.transaction_id : null
      );
    } else if (payment.payment_gateway === 'CASHFREE') {
      gatewayResponse = await cashfreeGateway.getPaymentStatus(
        transaction ? transaction.transaction_id : payment._id.toString()
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported payment gateway'
      });
    }
    
    // Update status if needed
    if (gatewayResponse.success) {
      // Update payment status if changed
      if (gatewayResponse.paymentStatus !== payment.payment_status) {
        payment.payment_status = gatewayResponse.paymentStatus;
        payment.updated_by = payment.created_by;
        await payment.save();
        
        // Update transaction status
        if (transaction) {
          transaction.transaction_status = 
            gatewayResponse.paymentStatus === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
          transaction.updated_by = payment.created_by;
          await transaction.save();
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      payment: {
        id: payment._id,
        status: payment.payment_status,
        amount: payment.payment_amount,
        currency: payment.payment_currency,
        purpose: payment.payment_purpose,
        created_at: payment.createdAt,
        updated_at: payment.updatedAt,
        is_subscription: payment.is_subscription,
        subscription_type: payment.subscription_type,
        subscription_id: payment.subscription_id,
        subscription_status: payment.subscription_status
      },
      transaction: transaction ? {
        id: transaction._id,
        status: transaction.transaction_status,
        transaction_id: transaction.transaction_id,
        amount: transaction.amount,
        currency: transaction.currency,
        transaction_mode: transaction.transaction_mode,
        created_at: transaction.CreatedAt,
        updated_at: transaction.updatedAt
      } : null
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Handle webhook from payment gateways
 */
const handleWebhook = async (req, res) => {
  try {
    const { gateway } = req.params;
    console.log("payload:",req.body);
    // Get signature based on gateway type
    let signature;
    if (gateway.toLowerCase() === 'razorpay') {
      signature = req.headers['x-razorpay-signature'];
      console.log("Signature",signature);
      // Log webhook details for debugging
      console.log('Razorpay webhook received:', {
        signature: signature ? 'Present' : 'Missing',
        event: req.body.event,
        payloadKeys: Object.values(req.body)
      });

      // Process webhook directly in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('Processing webhook in development mode');
        await processRazorpayWebhook(req.body);
        return res.status(200).json({ received: true, processed: true });
      }
    } else {
      signature = req.headers['x-cashfree-signature'];
    }

    // Process webhook through PaymentService
    const result = await paymentService.handleWebhook(
      gateway,
      req.body,
      signature,
      req.headers
    );
    
    return res.status(200).json({ received: true, processed: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent retries
    return res.status(200).json({ 
      received: true, 
      error: error.message 
    });
  }
};

// Helper function to process Razorpay webhooks
// const updatePaymentStatus = async (orderId, status, paymentDetails = {}) => {
//   try {
//     console.log("updatePaymentStatus called with:", paymentDetails);
//     console.log(`Updating payment status for order ${orderId} to ${status}`);
    
//     if (!orderId) {
//       throw new Error('Order ID is required to update payment status');
//     }
  
//     // Update the Payment document. (Assuming orderId here is _id; adjust if needed.)
//     const transaction = await Transaction.findOneAndUpdate(
//       // console.log(orderId),
//       { 'gateway_response.id': orderId },
//       {
//         $set: {
//           payment_status: status,
//           payment_gateway_response: paymentDetails.gateway_response,
//           updated_at: new Date(),
//           gateway_payment_id: paymentDetails.payment_id
//         }
//       },
//       {new: true}
//       // {
//       //   $set: {
//       //     payment_status: status,
//       //     payment_gateway_response: paymentDetails.gateway_response,
//       //     updated_at: new Date(),
//       //     gateway_payment_id: paymentDetails.payment_id
//       //   }
//       // },
//       // { new: true }
//     );
//     console.log(transaction);
//     const payment = await Payment.findOne(
//       transaction.payment_id
//     )
//     console.log("Payment is ",payment);
//     if (!transaction) {
//       console.error(`Payment record not found for order ID: ${orderId}`);
//       return null;
//     }
  
//     console.log(`Payment ${payment._id} updated to status: ${status}`);
  
//     // Determine payment method from the Razorpay response inside gateway_response if available
//     let paymentMethod = 'OTHER';
//     if (
//       paymentDetails.gateway_response &&
//       paymentDetails.gateway_response.data &&
//       paymentDetails.gateway_response.data.payment &&
//       paymentDetails.gateway_response.data.payment.payment_method
//     ) {
//       const methodData = paymentDetails.gateway_response.data.payment.payment_method;
//       if (methodData.card) {
//         paymentMethod = 'CARD';
//       } else if (methodData.upi) {
//         paymentMethod = 'UPI';
//       } else if (methodData.netbanking) {
//         paymentMethod = 'NET_BANKING';
//       } else if (methodData.app) {
//         paymentMethod = 'WALLET';
//       }
//     }
  
//   //   const transaction = await Transaction.findOneAndUpdate(
//   //     { payment_id: payment._id },
//   //     {
//   //       $set: {
//   //         transaction_status: status,
//   //         transaction_id: paymentDetails.payment_id,
//   //         transaction_mode: paymentMethod,
//   //         gateway_response: paymentDetails.gateway_response,
//   //         updated_at: new Date()
//   //       }
//   //     },
//   //     { new: true }
//   //   );
  
//   //   if (!transaction) {
//   //     console.error(`Transaction record not found for payment ID: ${payment._id}`);
//   //   } else {
//   //     console.log(`Transaction ${transaction._id} updated with mode: ${paymentMethod}`);
//   //   }
  
//   //   return { payment, transaction };
//   } catch (error) {
//     console.error('Error updating payment status:', error);
//     throw error;
//   }
// };
const updatePaymentStatus = async (orderId, status, paymentDetails = {}) => {
  try {
    console.log("updatePaymentStatus called with:", paymentDetails);
    console.log(`Updating payment status for order ${orderId} to ${status}`);

    if (!orderId) {
      throw new Error('Order ID is required to update payment status');
    }

    // First find the transaction by order ID
    const transaction = await Transaction.findOne({
      'gateway_response.id': orderId
    });

    if (!transaction) {
      console.error(`Transaction not found for order ID: ${orderId}`);
      return null;
    }

    // Update transaction status
    transaction.transaction_status = status;
    transaction.gateway_response = {
      ...transaction.gateway_response,
      ...paymentDetails.gateway_response
    };
    transaction.updated_at = new Date();
    await transaction.save();

    // Now update the associated payment
    const payment = await Payment.findByIdAndUpdate(
      transaction.payment_id,
      {
        $set: {
          payment_status: status,
          updated_at: new Date()
        }
      },
      { new: true }
    );

    if (!payment) {
      console.error(`Payment not found for ID: ${transaction.payment_id}`);
      return null;
    }

    console.log(`Payment ${payment._id} updated to status: ${status}`);
  } catch (error) {
    console.error('Error updating payment status:', error);
    throw error;
  }
};
const processRazorpayWebhook = async (req, res) => {
  try {
    // Get signature from headers.
    const webhookSignature = req.headers['x-razorpay-signature'];
    console.log("Signature:", webhookSignature);
    
    // Log details for debugging
    console.log('Razorpay webhook received:', {
      signature: webhookSignature ? 'Present' : 'Missing',
      event: req.body.event,
      payloadKeys: Object.keys(req.body)
    });
    
    // Use the raw body (provided by express.raw middleware)
    if (!req.rawBody) {
      console.error('Raw body not available for verification');
      return res.status(200).json({ received: true, error: 'Raw body missing' });
    }
    const rawBody = req.rawBody.toString('utf8'); // ensure proper encoding
    
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("Webhook secret not defined");
      return res.status(500).json({ received: true, error: "Webhook secret not defined" });
    }
    
    // Compute signature using the raw body
    const expectedSignature = crypto.createHmac('sha256', webhookSecret)
                                    .update(rawBody)
                                    .digest('hex');
    console.log('Signature verification:', {
      expected: expectedSignature.substring(0, 10) + '...',
      received: webhookSignature.substring(0, 10) + '...',
      matches: expectedSignature === webhookSignature
    });
    
    if (expectedSignature !== webhookSignature) {
      console.error('Signature mismatch');
      return res.status(400).json({ received: true, error: "Invalid signature" });
    }
    
    // Process the webhook event; note: payload is inside req.body.payload
    const event = req.body.event;
    const payload = req.body.payload;
    // console.log("Payload:", payload);
    console.log("Event:", event);
    console.log(`Processing webhook event: ${event}`);
    
    switch (event) {
      // case 'payment.authorized':
      //   if (payload && payload.payment && payload.payment.entity) {
      //     const payment = payload.payment.entity;
      //     await updatePaymentStatus(payment.order_id, 'SUCCESS', {
      //       payment_id: payment.id,
      //       amount: payment.amount / 100, // convert paise to rupees
      //       method: payment.method,
      //       gateway_response: req.body
      //     });
      //   }
      //   break;
  
      // case 'payment.captured':
      //   if (payload && payload.payment && payload.payment.entity) {
      //     const payment = payload.payment.entity;
      //     await updatePaymentStatus(payment.order_id, 'SUCCESS', {
      //       payment_id: payment.id,
      //       amount: payment.amount / 100,
      //       method: payment.method,
      //       gateway_response: req.body
      //     });
      //   }
      //   break;
  
      case 'order.paid':
        if (payload && payload.order && payload.order.entity) {
          const order = payload.order.entity;
          console.log("Order is : ",order);
          console.log("Payload is : ",payload);
          // Optionally, if a payment entity is also present:
          let p = null;
          if (payload.payment && payload.payment.entity) {
            p = payload.payment.entity;
          }
          await updatePaymentStatus(order.id, 'SUCCESS', {
            payment_id: p ? p.id : null,
            amount: order.amount / 100,
            gateway_response: req.body
          });
        }
        break;
  
      case 'payment.failed':
        if (payload && payload.payment && payload.payment.entity) {
          const payment = payload.payment.entity;
          await updatePaymentStatus(payment.order_id, 'FAILED', {
            payment_id: payment.id,
            amount: payment.amount / 100,
            error: payment.error_description,
            gateway_response: req.body
          });
        }
        break;
  
      default:
        console.log(`Unhandled Razorpay event: ${event}`);
    }
    
    return res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('Error processing Razorpay webhook:', error);
    // Always return 200 status so Razorpay doesn't retry endlessly.
    return res.status(200).json({ received: true, error: error.message });
  }
};

/**
 * Verify payment (for Razorpay client-side verification)
 */
const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Verify signature
    const isValid = razorpayGateway.verifyPaymentSignature(
      orderId, 
      paymentId, 
      signature
    );
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }
    
    // Find and update payment record
    const payment = await Payment.findOne({
      'gateway_response.order_id': orderId
    });
    
    if (payment) {
      console.log("payment status is ",payment.payment_status);
      payment.payment_status = 'SUCCESS';
      payment.updated_by = payment.created_by;
      await payment.save();
      
      // Update transaction
      const transaction = await Transaction.findOne({
        payment_ref: payment._id
      });
      
      if (transaction) {
        transaction.transaction_status = 'SUCCESS';
        transaction.updated_by = payment.created_by;
        await transaction.save();
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully'
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Update payment status helper function
 */

/**
 * Update subscription status helper function
 */
async function updateSubscriptionStatus(subscriptionId, status) {
  try {
    // Find payment with this subscription ID
    const payment = await Payment.findOne({
      subscription_id: subscriptionId
    });
    
    if (payment) {
      payment.subscription_status = status;
      payment.updated_by = payment.created_by;
      await payment.save();
    }
  } catch (error) {
    console.error('Error updating subscription status:', error);
  }
}

/**
 * Handle subscription payment
 */
async function handleSubscriptionPayment(subscriptionId, status, paymentDetails = {}) {
  try {
    // Find the original subscription payment
    const originalPayment = await Payment.findOne({
      subscription_id: subscriptionId
    });
    
    if (!originalPayment) return;
    
    // Create a new payment record for this subscription charge
    const newPayment = new Payment({
      payment_purpose: originalPayment.payment_purpose,
      payment_amount: originalPayment.payment_amount,
      payment_currency: originalPayment.payment_currency,
      payee_ref: originalPayment.payee_ref,
      payee_type: originalPayment.payee_type,
      receiver_ref: originalPayment.receiver_ref,
      receiver_type: originalPayment.receiver_type,
      payment_gateway: originalPayment.payment_gateway,
      payment_status: status,
      is_subscription: true,
      subscription_type: originalPayment.subscription_type,
      subscription_id: subscriptionId,
      subscription_status: 'ACTIVE',
      created_by: originalPayment.created_by,
      updated_by: originalPayment.created_by
    });
    
    await newPayment.save();
    
    // Create transaction record
    const transaction = new Transaction({
      payment_ref: newPayment._id,
      transaction_id: `${subscriptionId}_${Date.now()}`,
      transaction_status: status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      transaction_gateway: originalPayment.payment_gateway,
      transaction_mode: 'ONLINE',
      created_by: originalPayment.created_by,
      updated_by: originalPayment.created_by
    });
    
    await transaction.save();
  } catch (error) {
    console.error('Error handling subscription payment:', error);
  }
}

module.exports = {
  getAvailablePaymentMethods: async (req, res) => {
    res.json({ success: true, data: [] });
  },
  webhookHandler,
  createInvestmentPayment,
  getPaymentStatus,
  getAvailableGateways,
  processRazorpayWebhook,
  handleWebhook,
  verifyPayment
};