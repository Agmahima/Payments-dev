const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const cashfreeGateway = require('../gateways/cashfree');
// const emailService = require('../services/emailService');
const paymentConfig = require('../config/payment');
const razorpayGateway = require('../gateways/razorpay');
const geoip = require('../utils/geoip');

/**
 * Handle payment request events from EventBridge/SQS
 */
exports.handlePaymentRequest = async (event) => {
  try {
    console.log('Payment request received:', JSON.stringify(event));
    
    const {
      payment_id, // Optional: If payment already created by source service
      payment_purpose,
      payment_amount,
      payment_currency = 'INR',
      payee_ref,
      payee_type,
      receiver_ref,
      receiver_type,
      payee_location = 'IN',
      customer_details,
      description,
      created_by,
      source_service,
      return_url,
      notify_url,
      isSubscription,
      subscriptionType,
      region // Add region parameter for gateway selection
    } = event;

    let payment;
    
    // Check if payment record already exists or needs to be created
    if (payment_id) {
      payment = await Payment.findById(payment_id);
      if (!payment) {
        throw new Error(`Payment with ID ${payment_id} not found`);
      }
    } else {
      // Create a new payment record
      payment = new Payment({
        request_ref: `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
        payment_purpose,
        payment_amount,
        payment_currency,
        payee_ref: mongoose.Types.ObjectId(payee_ref),
        payee_type,
        receiver_ref: mongoose.Types.ObjectId(receiver_ref),
        receiver_type,
        payee_location,
        payment_gateway: 'CASHFREE',
        payment_status: 'PENDING',
        created_by: mongoose.Types.ObjectId(created_by),
        updated_by: mongoose.Types.ObjectId(created_by),
        is_subscription: !!isSubscription,
        subscription_type: subscriptionType || 'one-time'
      });
      
      await payment.save();
    }

    // Select payment gateway based on multiple factors
    const selectedGateway = await selectPaymentGateway(
      payment_purpose, 
      region || 'default',
      customer_details?.location
    );
    
    // Update payment record with selected gateway
    payment.payment_gateway = selectedGateway;
    await payment.save();
    
    // Process the payment with selected gateway
    const gatewayResult = await processPaymentWithGateway(
      selectedGateway,
      payment,
      customer_details,
      description || `Payment for ${payment_purpose}`,
      created_by,
      return_url,
      notify_url,
      isSubscription,
      subscriptionType
    );
    
    // Store transaction record
    await storeTransaction(
      payment._id,
      selectedGateway,
      gatewayResult,
      created_by
    );
    
    // Trigger email notification if needed
    if (customer_details.email) {
      await triggerEmailNotification(
        payment,
        customer_details,
        gatewayResult
      );
    }
    
    // Return response (for logging purposes, not sent back to source)
    return {
      success: gatewayResult.success,
      payment_id: payment._id.toString(),
      payment_status: payment.payment_status,
      gateway_response: {
        payment_session_id: gatewayResult.paymentSessionId,
        payment_link: gatewayResult.paymentLink
      }
    };
  } catch (error) {
    console.error('Error processing payment request:', error);
    // Log the error but don't throw - in event-driven architecture
    // we need to handle errors gracefully
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};

/**
 * Select the appropriate payment gateway
 */
function selectPaymentGateway(purpose, region, userLocation) {
  try {
    // Use region from parameter or detect from IP if provided
    let detectedRegion = region;
    
    // Get gateways for this region
    const gatewayNames = paymentConfig.regionMap[detectedRegion] || paymentConfig.regionMap.default;
    
    // Filter for enabled gateways
    const availableGateways = gatewayNames
      .filter(name => paymentConfig.gateways[name] && paymentConfig.gateways[name].enabled);
    
    if (availableGateways.length === 0) {
      console.warn(`No enabled payment gateways found for region ${detectedRegion}. Using default fallback.`);
      return 'CASHFREE'; // Default fallback
    }
    
    return availableGateways[0].toUpperCase();
  } catch (error) {
    console.error('Error selecting payment gateway:', error);
    return 'CASHFREE'; // Default fallback on error
  }
}

/**
 * Process payment with selected gateway
 */
async function processPaymentWithGateway(gateway, payment, customerDetails, description, userId, returnUrl, notifyUrl, isSubscription, subscriptionType) {
  try {
    const orderId = payment._id.toString();
    let result = { success: false };
    
    switch (gateway) {
      case 'RAZORPAY':
        // Use Razorpay gateway
        const orderData = {
          orderId: orderId,
          amount: payment.payment_amount,
          currency: payment.payment_currency,
          customerId: userId,
          customerEmail: customerDetails.email,
          customerPhone: customerDetails.phone,
          customerName: customerDetails.name,
          description,
          metadata: {
            payment_id: orderId,
            return_url: returnUrl,
            notify_url: notifyUrl
          }
        };
        
        if (isSubscription && subscriptionType !== 'one-time') {
          // Handle Razorpay subscription
          const subscriptionData = {
            planId: process.env.RAZORPAY_PLAN_ID, // You should have different plan IDs for different subscription types
            customerId: userId,
            totalCount: subscriptionType === 'yearly' ? 12 : 
                       (subscriptionType === 'monthly' ? 1 : undefined),
            customerEmail: customerDetails.email,
            customerPhone: customerDetails.phone,
            customerName: customerDetails.name,
            notes: {
              description,
              payment_id: orderId
            }
          };
          result = await razorpayGateway.createSubscription(subscriptionData);
          
          // Update payment with subscription info
          if (result.success) {
            await payment.updateOne({
              subscription_id: result.subscriptionId,
              subscription_status: result.status,
              updated_by: new mongoose.Types.ObjectId(userId)
            });
          }
        } else {
          // Handle Razorpay one-time payment
          result = await razorpayGateway.createOrder(orderData);
        }
        break;
        
      case 'CASHFREE':
      default:
        // Use Cashfree gateway
        const cashfreePayload = {
          order_id: orderId,
          order_amount: payment.payment_amount,
          order_currency: payment.payment_currency,
          customer_details: {
            customer_id: userId,
            customer_name: customerDetails.name || 'Customer',
            customer_email: customerDetails.email,
            customer_phone: customerDetails.phone
          },
          order_meta: { 
            return_url: returnUrl, 
            notify_url: notifyUrl 
          },
          order_note: description
        };
        
        if (isSubscription && subscriptionType !== 'one-time') {
          // Handle Cashfree subscription
          const subscriptionPayload = {
            ...cashfreePayload,
            plan_id: process.env.CASHFREE_SUBSCRIPTION_PLAN_ID,
            subscription_amount: payment.payment_amount,
            subscription_currency: payment.payment_currency,
            subscription_type: subscriptionType
          };
          
          result = await cashfreeGateway.createSubscription(subscriptionPayload);
          
          // Update payment with subscription info
          if (result.success) {
            await payment.updateOne({
              subscription_id: result.subscriptionId,
              subscription_status: result.status,
              updated_by: new mongoose.Types.ObjectId(userId)
            });
          }
        } else {
          // Handle Cashfree one-time payment
          result = await cashfreeGateway.initiatePayment(cashfreePayload);
        }
    }
    
    return {
      success: result.success,
      orderId: result.orderId,
      paymentSessionId: result.paymentSessionId || result.orderId,
      paymentLink: result.paymentLink || null,
      gatewayResponse: result.gatewayResponse
    };
  } catch (error) {
    console.error(`Error processing payment with ${gateway}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Store the transaction record
 */
async function storeTransaction(paymentId, gateway, gatewayResult, userId) {
  // const userId = "65f123456789abcdef123456";


  const transaction = new Transaction({
    payment_id: mongoose.Types.ObjectId(paymentId),
    transaction_mode: gatewayResult.paymentSessionId ? 'ONLINE' : 'UNKNOWN',
    gateway_used: gateway,
    gateway_response: gatewayResult.gatewayResponse || {},
    created_by: mongoose.Types.ObjectId(userId),
    updated_by: mongoose.Types.ObjectId(userId)
  });
  
  await transaction.save();
  
  // Update payment with transaction reference
  await Payment.findByIdAndUpdate(paymentId, {
    transaction: transaction._id,
    updated_by: mongoose.Types.ObjectId(userId)
  });
  
  return transaction;
}

/**
 * Trigger email notification
 */
async function triggerEmailNotification(payment, customerDetails, gatewayResult) {
  try {
    await emailService.sendPaymentInitiatedEmail({
      to: customerDetails.email,
      name: customerDetails.name,
      amount: payment.payment_amount,
      currency: payment.payment_currency,
      purpose: payment.payment_purpose,
      paymentLink: gatewayResult.paymentLink
    });
  } catch (error) {
    console.error('Error sending payment notification:', error);
    // Don't throw - email notification shouldn't block the process
  }
}

/**
 * Handle webhook events from payment gateways
 */
exports.handlePaymentWebhook = async (gateway, payload, signature) => {
  try {
    console.log(`Received ${gateway} webhook`);
    
    // Verify webhook signature
    let isValid = true;
    // if (gateway.toUpperCase() === 'CASHFREE') {
    //   isValid = cashfreeGateway.verifyWebhookSignature(payload, signature);
    // } else if (gateway.toUpperCase() === 'RAZORPAY') {
    //   isValid = razorpayGateway.verifyWebhookSignature(payload, signature);
    // } else {
    //   throw new Error(`Unsupported payment gateway: ${gateway}`);
    // }
    
    if (!isValid) {
      console.error(`Invalid ${gateway} webhook signature`);
      return {
        success: false,
        error: 'Invalid signature'
      };
    }
    
    // Process webhook data based on gateway
    let webhookData;
    if (gateway.toUpperCase() === 'CASHFREE') {
      webhookData = cashfreeGateway.processWebhookData(payload);
    } else if (gateway.toUpperCase() === 'RAZORPAY') {
      // Razorpay webhook data is already in the right format
      webhookData = {
        event: payload.event,
        orderId: payload.payload.order.entity.receipt,
        paymentId: payload.payload.payment.entity.id,
        amount: payload.payload.payment.entity.amount / 100, // Convert paise to rupees
        status: payload.payload.payment.entity.status === 'captured' ? 'SUCCESS' : 'FAILED'
      };
    }
    
    if (!webhookData) {
      return {
        success: false,
        error: 'Failed to process webhook data'
      };
    }
    
    // Handle different event types
    switch (webhookData.event) {
      case 'payment.success':
      case 'payment.paid':
      case 'payment.captured':
        await updatePaymentStatus(webhookData.orderId, 'SUCCESS');
        break;
        
      case 'payment.failed':
        await updatePaymentStatus(webhookData.orderId, 'FAILED');
        break;
        
      case 'subscription.created':
        await updateSubscriptionStatus(webhookData.subscriptionId, 'CREATED');
        break;
        
      case 'subscription.activated':
        await updateSubscriptionStatus(webhookData.subscriptionId, 'ACTIVE');
        break;
        
      case 'subscription.charged':
      case 'subscription.payment.success':
        await handleSubscriptionPayment(webhookData.subscriptionId, 'SUCCESS');
        break;
        
      case 'subscription.payment.failed':
        await handleSubscriptionPayment(webhookData.subscriptionId, 'FAILED');
        break;
        
      case 'subscription.cancelled':
        await updateSubscriptionStatus(webhookData.subscriptionId, 'CANCELLED');
        break;
    }
    
    return {
      success: true,
      message: 'Webhook processed successfully'
    };
  } catch (error) {
    console.error('Error processing payment webhook:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update payment status
 */
async function updatePaymentStatus(orderId, status) {
  try {
    const Payment = mongoose.model('Payment');
    const Transaction = mongoose.model('Transaction');
    
    const payment = await Payment.findOne({
      $or: [
        { _id: orderId },
        { request_ref: orderId },
        { 'gateway_response.order_id': orderId }
      ]
    });
    
    if (payment) {
      payment.payment_status = status;
      payment.updated_by = payment.created_by;
      await payment.save();
      
      // Update transaction
      const transaction = await Transaction.findOne({
        payment_ref: payment._id
      });
      
      if (transaction) {
        transaction.transaction_status = 
          status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
        transaction.updated_by = payment.created_by;
        await transaction.save();
      }
    }
  } catch (error) {
    console.error('Error updating payment status:', error);
  }
}

/**
 * Update subscription status
 */
async function updateSubscriptionStatus(subscriptionId, status) {
  try {
    const Payment = mongoose.model('Payment');
    
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
async function handleSubscriptionPayment(subscriptionId, status) {
  try {
    const Payment = mongoose.model('Payment');
    const Transaction = mongoose.model('Transaction');
    
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