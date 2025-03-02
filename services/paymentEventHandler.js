const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const cashfreeGateway = require('../gateways/cashfree');
const emailService = require('../services/emailService');

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
      source_service
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
        updated_by: mongoose.Types.ObjectId(created_by)
      });
      
      await payment.save();
    }

    // Select payment gateway based on purpose, location, and availability
    // For now, we're always using Cashfree, but this could be expanded
    const selectedGateway = selectPaymentGateway(
      payment_purpose, 
      payee_location,
      'CASHFREE'
    );
    
    // Process the payment with selected gateway
    const gatewayResult = await processPaymentWithGateway(
      selectedGateway,
      payment,
      customer_details,
      description || `Payment for ${payment_purpose}`,
      created_by
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
function selectPaymentGateway(purpose, location, defaultGateway = 'CASHFREE') {
  // Check payment purpose
  // if (purpose === 'SUBSCRIPTION') return 'RAZORPAY';
  
  // Check payer location
  // if (location !== 'IN') return 'STRIPE';
  
  // Check gateway status/availability
  // const gatewayStatus = checkGatewayStatus('CASHFREE');
  // if (!gatewayStatus.available) return 'RAZORPAY';
  
  // For now, just return default
  return defaultGateway;
}

/**
 * Process payment with selected gateway
 */
async function processPaymentWithGateway(gateway, payment, customerDetails, description, userId) {
  // Currently only implementing Cashfree
  if (gateway === 'CASHFREE') {
    return await cashfreeGateway.initiatePayment({
      amount: payment.payment_amount,
      orderId: payment._id.toString(),
      currency: payment.payment_currency,
      customerDetails: {
        id: customerDetails.id || userId,
        name: customerDetails.name,
        email: customerDetails.email,
        phone: customerDetails.phone
      },
      purpose: description
    });
  }
  
  throw new Error(`Unsupported gateway: ${gateway}`);
}

/**
 * Store the transaction record
 */
async function storeTransaction(paymentId, gateway, gatewayResult, userId) {
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
exports.handleWebhookEvent = async (gatewayType, payload, signature) => {
  try {
    console.log(`Webhook received from ${gatewayType}:`, JSON.stringify(payload));
    
    // Verify webhook signature
    let isValid = false;
    if (gatewayType === 'CASHFREE') {
      isValid = cashfreeGateway.verifyWebhookSignature(payload, signature);
    }
    
    if (!isValid) {
      console.error('Invalid webhook signature');
      return { success: false, error: 'Invalid signature' };
    }
    
    // Process webhook data
    let webhookData;
    if (gatewayType === 'CASHFREE') {
      webhookData = cashfreeGateway.processWebhookData(payload);
    }
    
    if (!webhookData) {
      return { success: false, error: 'Could not process webhook data' };
    }
    
    // Find the payment record
    const payment = await Payment.findById(webhookData.orderId);
    if (!payment) {
      console.error(`Payment not found: ${webhookData.orderId}`);
      return { success: false, error: 'Payment not found' };
    }
    
    // Update payment status
    payment.payment_status = webhookData.status;
    payment.updated_by = payment.created_by; // Use same user who created the payment
    await payment.save();
    
    // Find and update transaction
    const transaction = await Transaction.findOne({ payment_id: payment._id });
    if (transaction) {
      transaction.gateway_response = {
        ...transaction.gateway_response,
        webhookData: payload
      };
      transaction.updated_by = payment.created_by;
      await transaction.save();
    }
    
    // Trigger success or failure email notification
    const user = await mongoose.model('User').findById(payment.created_by);
    if (user && user.email) {
      if (webhookData.status === 'SUCCESS') {
        await emailService.sendPaymentSuccessEmail({
          to: user.email,
          name: user.name,
          amount: payment.payment_amount,
          currency: payment.payment_currency,
          purpose: payment.payment_purpose,
          transactionId: transaction ? transaction._id : null
        });
      } else if (webhookData.status === 'FAILED') {
        await emailService.sendPaymentFailureEmail({
          to: user.email,
          name: user.name,
          amount: payment.payment_amount,
          currency: payment.payment_currency,
          purpose: payment.payment_purpose,
          reason: webhookData.transactionDetails.errorMessage || 'Unknown error'
        });
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error processing webhook event:', error);
    return { success: false, error: error.message };
  }
}; 