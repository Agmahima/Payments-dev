const Razorpay=require('razorpay');
const crypto=require('crypto');
const mongoose=require('mongoose');
// const UserSubscription=require('../models/UserSubscription');
// const Subscription=require('../models/SubscriptionPlan');
const UserSubscription=require('../models/UserSubscription');
const SubscriptionPlan=require('../models/subscriptionPlanSchema');
const Payment=require('../models/Payment.js');
const Transaction=require('../models/Transaction');

const PaymentMethod=  require('../models/paymentMethodSchema');
const razorpay=new Razorpay({
  key_id:process.env.RAZORPAY_KEY_ID,
  key_secret:process.env.RAZORPAY_KEY_SECRET
});

/**
 * Verify Razorpay webhook signature
 */
const verifyWebhookSignature = (req) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (!webhookSignature || !webhookSecret) return false;
    
    // Use req.rawBody if available, otherwise stringify the body
    const webhookBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
    
    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookBody)
      .digest('hex');
    
    console.log('Signature verification:', {
      received: webhookSignature.substring(0, 10) + '...',
      computed: generatedSignature.substring(0, 10) + '...',
      matches: generatedSignature === webhookSignature
    });
    
    return generatedSignature === webhookSignature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};

exports.createPlan=async(req,res)=>{
  try{
    const{ name,period,interval,item}=req.body;
    
    // Validate period value
    const validPeriods = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        error: `Invalid period value. Must be one of: ${validPeriods.join(', ')}`
      });
    }
    
    const plan=await razorpay.plans.create({
      period,
      interval,
      item:{
        name,
        amount:item.amount*100,
        currency:item.currency||'INR',
        description:item.description||''
      },
      notes:req.body.notes||{}
    });

    // Map period to duration properly
    let duration;
    if (period === 'monthly' && interval === 1) {
      duration = 'monthly';
    } else if (period === 'monthly' && interval === 3) {
      duration = 'quarterly';
    } else if (period === 'yearly') {
      duration = 'yearly';
    } else {
      duration = `${period}-${interval}`;
    }

    // Handle categories based on input format
    let formattedCategories = [];
    
    // Check if we received categories in the request
    if (req.body.categories) {
      // If categories is an array of strings, convert to proper format
      if (Array.isArray(req.body.categories) && typeof req.body.categories[0] === 'string') {
        formattedCategories = req.body.categories.map(cat => ({
          name: cat,
          features: []
        }));
      } 
      // If it's already in the correct format, use as is
      else if (Array.isArray(req.body.categories) && typeof req.body.categories[0] === 'object') {
        formattedCategories = req.body.categories;
      }
    }

    const subscriptionPlan=new SubscriptionPlan({
      name:name,
      workspace_type:req.body.workspace_type,
      description:item.description||'',
      price:item.amount,
      duration:duration,
      categories:formattedCategories,
      plan_id:plan.id
    });

    await subscriptionPlan.save();
    res.status(201).json({
      success:true,
      plan,
      subscriptionPlan
    })
    console.log('Plan created:',plan);
    console.log('Subscription plan created:',subscriptionPlan);
  }
  catch(error){
    console.error('Error creating plan:',error);
    res.status(500).json({
      success:false,
      error:error.message
    })
  }
};

exports.createSubscription = async (req, res) => {
  try {
    const {
      plan_id,
      total_count,
      quantity,
      person_id,
      workspace_id,
      customer_notify,
      notes
    } = req.body;

    // First verify if plan exists before creating subscription
    // Try to find by Razorpay plan_id
    const plan = await SubscriptionPlan.findOne({ plan_id: plan_id });
    
    if (!plan) {
      console.error('Plan not found:', plan_id);
      return res.status(404).json({
        success: false,
        error: 'Subscription plan not found'
      });
    }

    console.log('Creating subscription for plan:', {
      plan_id,
      plan_name: plan.name,
      workspace_type: plan.workspace_type
    });

    // Create a Razorpay subscription
    const subscriptionOptions = {
      plan_id,
      total_count: total_count || 12,
      quantity: quantity || 1,
      expire_by: Math.round(Date.now() / 1000) + 31536000, // Default 1 year
      customer_notify: customer_notify || 1,
      notes: notes || {}
    };

    // Add customer_id if provided
    if (req.body.customer_id) {
      subscriptionOptions.customer_id = req.body.customer_id;
    }

    const subscription = await razorpay.subscriptions.create(subscriptionOptions);
    
    // Calculate valid until date based on plan duration
    let validUntil = new Date();
    if (plan.duration === 'monthly') {
      validUntil.setMonth(validUntil.getMonth() + (total_count || 12));
    } else if (plan.duration === 'yearly') {
      validUntil.setFullYear(validUntil.getFullYear() + (total_count || 1));
    } else if (plan.duration === 'quarterly') {
      validUntil.setMonth(validUntil.getMonth() + (total_count || 4) * 3);
    }

    // Convert string IDs to ObjectIds if they're not already
    let personObjectId, workspaceObjectId;
    
    try {
      // Check if person_id is already an ObjectId
      personObjectId = mongoose.Types.ObjectId.isValid(person_id) ? 
        new mongoose.Types.ObjectId(person_id) : person_id;
        
      // Check if workspace_id is already an ObjectId
      workspaceObjectId = mongoose.Types.ObjectId.isValid(workspace_id) ? 
        new mongoose.Types.ObjectId(workspace_id) : workspace_id;
    } catch (error) {
      console.error('Error converting IDs to ObjectId:', error);
      // Continue with original values if conversion fails
      personObjectId = person_id;
      workspaceObjectId = workspace_id;
    }

    // Create user subscription record
    const userSubscription = new UserSubscription({
      person_id: personObjectId,
      workspace_id: workspaceObjectId,
      current_tier: plan.name,
      valid_until: validUntil,
      payment_transaction_id: subscription.id,
      used_benefits: [],
      status: 'created'
    });

    await userSubscription.save();

    // Create payment record for this subscription
    const payment = new Payment({
      payment_purpose: 'Subscription',
      payment_amount: plan.price,
      payment_currency: 'INR',
      payee_ref: personObjectId,
      payee_type: 'Person',
      receiver_ref: workspaceObjectId,
      receiver_type: 'Entity',
      request_ref: userSubscription._id,
      payment_gateway: 'RAZORPAY',
      payment_status: 'PENDING',
      is_subscription: true,
      subscription_type: plan.duration,
      subscription_id: subscription.id,
      subscription_status: 'CREATED',
      created_by: personObjectId,
      updated_by: personObjectId
    }); 

    await payment.save();

    // Create transaction record
    const transaction = new Transaction({
      payment_id: payment._id,
      transaction_id: subscription.id,
      transaction_status: 'PENDING',
      transaction_mode: 'OTHER',
      payment_mode: 'ONLINE',
      gateway_used: 'RAZORPAY',
      created_by: personObjectId,
      updated_by: personObjectId
    });

    await transaction.save();

    // Update payment with transaction reference
    await Payment.findByIdAndUpdate(payment._id, {
      transaction: transaction._id
    });

    return res.status(201).json({
      success: true,
      subscription,
      userSubscription,
      payment_id: payment._id,
      razorpay_key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.verifySubscription = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

    // Verify signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_subscription_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Find the subscription
      const userSubscription = await UserSubscription.findOne({
        payment_transaction_id: razorpay_subscription_id
      });

      if (!userSubscription) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found'
        });
      }

      // Update subscription status
      userSubscription.status = 'active';
      await userSubscription.save();

      // Find and update payment status
      const payment = await Payment.findOne({
        subscription_id: razorpay_subscription_id
      });

      if (payment) {
        payment.payment_status = 'SUCCESS';
        payment.subscription_status = 'ACTIVE';
        payment.gateway_payment_id = razorpay_payment_id;
        await payment.save();

        // Update transaction
        const transaction = await Transaction.findOne({
          payment_id: payment._id
        });

        if (transaction) {
          transaction.transaction_status = 'SUCCESS';
          transaction.transaction_id = razorpay_payment_id;
          // Determine payment method when available from Razorpay callback
          
          await transaction.save();
        }
      }

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getAllPlans=async(req,res)=>{
  try{
    const plans=await SubscriptionPlan.find();
    console.log('Plans:',plans);
    res.status(200).json({
      success:true,
      plans
    });
  }
  catch(error){
    console.error('Error fetching plans:',error);
    res.status(500).json({
      success:false,
      error:error.message
    });
  }
}

exports.getPlan=async(req,res)=>{
  try{
    const planId = req.params.id || req.params.planId;

    //console.log(req);
    console.log(planId);
    const plan=await SubscriptionPlan.findById(planId);
    if(!plan){
      return res.status(404).json({
        success:false,
        error:'Plan not found'
      });
    }
    res.status(200).json({
      success:true,
      plan
    });
  }
  catch(error){
    console.error('Error fetching plan:',error);
    res.status(500).json({
      success:false,
      error:error.message
    });
  }
}

exports.getSubscription=async(req,res)=>{
  try{
    const subscription_id=req.params.id || req.params.subscriptionId;
    const subscription=await UserSubscription.findById(subscription_id);
    if(!subscription){
      return res.status(404).json({
        success:false,
        error:'Subscription not found'
      });
    }
    res.status(200).json({
      success:true,
      subscription
    });
  }
  catch(error){
    console.error('Error fetching subscription:',error);
    res.status(500).json({
      success:false,
      error:error.message
    });
  }
}

exports.getAllSubscriptions=async(req,res)=>{
  try{
    const subscriptions=await UserSubscription.find();
    res.status(200).json({
      success:true,
      subscriptions
    });
  }
  catch(error){
    console.error('Error fetching subscriptions:',error);
    res.status(500).json({
      success:false,
      error:error.message
    });
  }
}

exports.cancelSubscription = async (req, res) => {
  try {
    const subscription_id = req.params.id || req.params.subscriptionId;
    const subscription = await UserSubscription.findById(subscription_id);
   
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }
    
    // Cancel the subscription in Razorpay
    await razorpay.subscriptions.cancel(subscription.payment_transaction_id, {
      cancel_at_cycle_end: req.body.cancel_at_cycle_end || false
    });
    //delete the subscription from the database
   // await UserSubscription.deleteOne({ _id: subscription_id });
    
    // just update the status instead of deleting
    await UserSubscription.findByIdAndUpdate(subscription_id, { 
      status: 'cancelled',
      updated_at: new Date()
    });
    
    // Update related payment records
    await Payment.updateMany(
      { subscription_id: subscription.payment_transaction_id },
      { 
        subscription_status: 'CANCELLED',
        updated_at: new Date()
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  }
  catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

exports.updateSubscription = async (req, res) => {
  try {
    const subscriptionId = req.params.id || req.params.subscriptionId;
    const subscription = await UserSubscription.findById(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }
    
    // Fields that can be updated
    const updatableFields = [
      'current_tier', 'valid_until', 'status', 'used_benefits'
    ];
    
    // Build update object
    const updateData = {};
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // Always update timestamp
    updateData.updated_at = new Date();
    
    // Apply updates
    const updatedSubscription = await UserSubscription.findByIdAndUpdate(
      subscriptionId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    // For Razorpay updates, we need the Razorpay subscription ID
    if (subscription.payment_transaction_id) {
      try {
        // Handle different status updates
        if (req.body.status === 'cancelled') {
          // Cancel subscription in Razorpay
          await razorpay.subscriptions.cancel(subscription.payment_transaction_id, {
            cancel_at_cycle_end: req.body.cancel_at_cycle_end || false
          });
          console.log(`Cancelled Razorpay subscription: ${subscription.payment_transaction_id}`);
        } 
        else if (req.body.status === 'paused' || req.body.status === 'halted') {
          // Pause subscription in Razorpay
          // Check if pause method exists
          if (typeof razorpay.subscriptions.pause === 'function') {
            await razorpay.subscriptions.pause(subscription.payment_transaction_id);
            console.log(`Paused Razorpay subscription: ${subscription.payment_transaction_id}`);
          } else {
            console.error('Warning: razorpay.subscriptions.pause method not available in SDK');
          }
        }
        else if (req.body.status === 'active' && 
                (subscription.status === 'paused' || subscription.status === 'halted')) {
          // Resume subscription in Razorpay
          // Check if resume method exists
          if (typeof razorpay.subscriptions.resume === 'function') {
            await razorpay.subscriptions.resume(subscription.payment_transaction_id);
            console.log(`Resumed Razorpay subscription: ${subscription.payment_transaction_id}`);
          } else {
            console.error('Warning: razorpay.subscriptions.resume method not available in SDK');
          }
        }
      } catch (razorpayError) {
        console.error('Warning: Could not update Razorpay subscription:', razorpayError);
        // Continue anyway as we've updated our database
      }
    }
    
    // Update payment status if we're changing subscription status
    if (req.body.status) {
      try {
        await Payment.updateMany(
          { subscription_id: subscription.payment_transaction_id },
          { 
            subscription_status: req.body.status.toUpperCase(),
            updated_at: new Date()
          }
        );
      } catch (dbError) {
        console.error('Error updating payment records:', dbError);
      }
    }
    
    res.status(200).json({
      success: true,
      subscription: updatedSubscription
    });
    
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.handleRazorpayWebhook = async (req, res) => {
  try {
    // Get webhook signature from headers
    const webhookSignature = req.headers['x-razorpay-signature'];
    
    if (!webhookSignature) {
      console.error('Webhook signature missing');
      // Still return 200 to prevent retries, but log the issue
      return res.status(200).json({ received: true, error: 'Signature missing' });
    }
    
    // Log incoming webhook details (helpful for debugging)
    console.log('Received Razorpay webhook:', { 
      event: req.body.event,
      signature: webhookSignature ? 'Present' : 'Missing',
      body_size: JSON.stringify(req.body).length
    });
    
    // Use the verification function
    const isValid = verifyWebhookSignature(req);
    
    // Skip signature check in development if needed
    const skipVerification = process.env.SKIP_WEBHOOK_VERIFICATION === 'true';
    if (!skipVerification && !isValid) {
      console.error('Invalid webhook signature');
      // Still return 200 but log the error
      return res.status(200).json({ received: true, error: 'Invalid signature' });
    }
    
    // Process webhook based on event type
    const event = req.body.event;
    console.log(`Processing webhook event: ${event}`);
    
    // Extract data from webhook payload
    const payload = req.body.payload;
    let subscriptionId, paymentId, status;
    
    if (event.startsWith('subscription.')) {
      // Handle subscription events
      if (payload && payload.subscription && payload.subscription.entity) {
        subscriptionId = payload.subscription.entity.id;
        status = payload.subscription.entity.status;
        
        console.log(`Subscription ${subscriptionId} status: ${status}`);
        
        // Handle different subscription events
        switch (event) {
          case 'subscription.created':
            await updateSubscriptionStatus(subscriptionId, 'CREATED');
            break;
          case 'subscription.authenticated':
            await updateSubscriptionStatus(subscriptionId, 'AUTHENTICATED');
            break;
          case 'subscription.activated':
            await updateSubscriptionStatus(subscriptionId, 'ACTIVE');
            break;
          case 'subscription.charged':
            // Handle subscription payment success
            if (payload.payment && payload.payment.entity) {
              paymentId = payload.payment.entity.id;
              await handleSubscriptionPayment(subscriptionId, 'SUCCESS', {
                payment_id: paymentId,
                payment_method: mapPaymentMethod(payload.payment.entity),
                amount: payload.payment.entity.amount / 100,
                gateway_response: payload
              });
            }
            break;
          case 'subscription.halted':
            await updateSubscriptionStatus(subscriptionId, 'HALTED');
            break;
          case 'subscription.cancelled':
            await updateSubscriptionStatus(subscriptionId, 'CANCELLED');
            break;
          default:
            console.log(`Unhandled subscription event: ${event}`);
        }
      }
    } else if (event.startsWith('payment.')) {
      // Handle payment events
      if (payload && payload.payment && payload.payment.entity) {
        paymentId = payload.payment.entity.id;
        status = payload.payment.entity.status;
        
        console.log(`Payment ${paymentId} status: ${status}`);
        
        // Check if this is a subscription payment
        if (payload.payment.entity.order_id) {
          // This might be a regular payment, not a subscription
          
        } else if (payload.payment.entity.invoice_id || payload.subscription) {
          // This is likely a subscription payment
          subscriptionId = payload.subscription?.entity?.id;
          
          if (subscriptionId) {
            if (event === 'payment.captured' || status === 'captured') {
              await handleSubscriptionPayment(subscriptionId, 'SUCCESS', {
                payment_id: paymentId,
                payment_method: mapPaymentMethod(payload.payment.entity),
                amount: payload.payment.entity.amount / 100,
                gateway_response: payload
              });
            } else if (event === 'payment.failed' || status === 'failed') {
              await handleSubscriptionPayment(subscriptionId, 'FAILED', {
                payment_id: paymentId,
                payment_method: mapPaymentMethod(payload.payment.entity),
                amount: payload.payment.entity.amount / 100,
                gateway_response: payload
              });
            }
          }
        }
      }
    }
    
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Always return 200 to acknowledge receipt
    return res.status(200).json({ received: true, error: error.message });
  }
};

const mapPaymentMethod = (paymentEntity) => {
  if (!paymentEntity || !paymentEntity.method) return 'OTHER';
  
  switch (paymentEntity.method) {
    case 'card':
      return 'CARD';
    case 'upi':
      return 'UPI';
    case 'netbanking':
      return 'NET_BANKING';
    case 'wallet':
      return 'WALLET';
    default:
      return 'OTHER';
  }
};

// Helper functions for webhook handlers

/**
 * Handle subscription charged event
 */
async function handleSubscriptionCharged(subscription, paymentData) {
  try {
    console.log(`Processing subscription charged: ${subscription.id}`);
    
    // Find user subscription
    const userSubscription = await UserSubscription.findOne({
      payment_transaction_id: subscription.id
    });
    
    if (!userSubscription) {
      console.error(`User subscription not found for ID: ${subscription.id}`);
      return;
    }
    
    // Update user subscription status
    userSubscription.status = 'active';
    await userSubscription.save();
    
    // Create a new payment record for this charge
    const originalPayment = await Payment.findOne({
      subscription_id: subscription.id
    });
    
    if (!originalPayment) {
      console.error(`Original payment not found for subscription: ${subscription.id}`);
      return;
    }
    
    // Create payment for this cycle
    const paymentAmount = subscription.plan_id ? 
      (await SubscriptionPlan.findOne({ plan_id: subscription.plan_id }))?.price || 
      originalPayment.payment_amount : originalPayment.payment_amount;
    
    const newPayment = new Payment({
      payment_purpose: 'Subscription Renewal',
      payment_amount: paymentAmount,
      payment_currency: originalPayment.payment_currency,
      payee_ref: originalPayment.payee_ref,
      payee_type: originalPayment.payee_type,
      receiver_ref: originalPayment.receiver_ref,
      receiver_type: originalPayment.receiver_type,
      payment_gateway: 'RAZORPAY',
      payment_status: 'SUCCESS',
      is_subscription: true,
      subscription_type: originalPayment.subscription_type,
      subscription_id: subscription.id,
      subscription_status: 'ACTIVE',
      gateway_payment_id: paymentData?.entity?.id,
      created_by: originalPayment.created_by,
      updated_by: originalPayment.created_by
    });
    
    await newPayment.save();
    
    // Determine payment method
    let paymentMethod = 'OTHER';
    if (paymentData?.entity?.method) {
      switch (paymentData.entity.method) {
        case 'card': paymentMethod = 'CARD'; break;
        case 'upi': paymentMethod = 'UPI'; break;
        case 'netbanking': paymentMethod = 'NET_BANKING'; break;
        case 'wallet': paymentMethod = 'WALLET'; break;
        default: paymentMethod = 'OTHER';
      }
    }
    
    // Create transaction record
    const transaction = new Transaction({
      payment_id: newPayment._id,
      transaction_id: paymentData?.entity?.id || `sub_${subscription.id}_${Date.now()}`,
      transaction_status: 'SUCCESS',
      transaction_mode: paymentMethod,
      payment_mode: 'ONLINE',
      gateway_response: { subscription, payment: paymentData },
      created_by: originalPayment.created_by,
      updated_by: originalPayment.created_by
    });
    
    await transaction.save();
    
    // Update payment with transaction reference
    await Payment.findByIdAndUpdate(newPayment._id, {
      transaction: transaction._id
    });
    
    console.log(`Created new payment record for subscription charge: ${newPayment._id}`);
    
    // Save payment method if it's a card payment
    if (paymentMethod === 'CARD' && paymentData?.entity?.card) {
      await savePaymentMethod(
        originalPayment.created_by.toString(),
        paymentData.entity,
        'RAZORPAY'
      );
    }
  } catch (error) {
    console.error('Error handling subscription charged event:', error);
  }
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(subscription) {
  try {
    const userSubscription = await UserSubscription.findOne({
      payment_transaction_id: subscription.id
    });
    
    if (userSubscription) {
      userSubscription.status = 'created';
      await userSubscription.save();
    }
    
    // Update payment record
    const payment = await Payment.findOne({
      subscription_id: subscription.id
    });
    
    if (payment) {
      payment.subscription_status = 'CREATED';
      await payment.save();
    }
  } catch (error) {
    console.error('Error handling subscription created event:', error);
  }
}

/**
 * Handle subscription authenticated event
 */
async function handleSubscriptionAuthenticated(subscription) {
  try {
    // Update payment record
    const payment = await Payment.findOne({
      subscription_id: subscription.id
    });
    
    if (payment) {
      payment.subscription_status = 'AUTHENTICATED';
      await payment.save();
    }
  } catch (error) {
    console.error('Error handling subscription authenticated event:', error);
  }
}

/**
 * Handle subscription cancelled event
 */
async function handleSubscriptionCancelled(subscription) {
  try {
    const userSubscription = await UserSubscription.findOne({
      payment_transaction_id: subscription.id
    });
    
    if (userSubscription) {
      userSubscription.status = 'cancelled';
      await userSubscription.save();
    }
    
    // Update payment record
    const payment = await Payment.findOne({
      subscription_id: subscription.id
    });
    
    if (payment) {
      payment.subscription_status = 'CANCELLED';
      await payment.save();
    }
  } catch (error) {
    console.error('Error handling subscription cancelled event:', error);
  }
}

/**
 * Handle subscription pending event
 */
async function handleSubscriptionPending(subscription) {
  try {
    const userSubscription = await UserSubscription.findOne({
      payment_transaction_id: subscription.id
    });
    
    if (userSubscription) {
      userSubscription.status = 'pending';
      await userSubscription.save();
    }
    
    // Update payment record
    const payment = await Payment.findOne({
      subscription_id: subscription.id
    });
    
    if (payment) {
      payment.subscription_status = 'PENDING';
      await payment.save();
    }
  } catch (error) {
    console.error('Error handling subscription pending event:', error);
  }
}

/**
 * Handle subscription halted event
 */
async function handleSubscriptionHalted(subscription) {
  try {
    const userSubscription = await UserSubscription.findOne({
      payment_transaction_id: subscription.id
    });
    
    if (userSubscription) {
      userSubscription.status = 'halted';
      await userSubscription.save();
    }
    
    // Update payment record
    const payment = await Payment.findOne({
      subscription_id: subscription.id
    });
    
    if (payment) {
      payment.subscription_status = 'HALTED';
      await payment.save();
    }
  } catch (error) {
    console.error('Error handling subscription halted event:', error);
  }
}

/**
 * Handle subscription payment captured event
 */
async function handleSubscriptionPaymentCaptured(subscriptionId, paymentEntity) {
  try {
    const payment = await Payment.findOne({
      subscription_id: subscriptionId
    });
    
    if (payment) {
      payment.payment_status = 'SUCCESS';
      payment.gateway_payment_id = paymentEntity.id;
      await payment.save();
      
      // Update transaction
      const transaction = await Transaction.findOne({
        payment_id: payment._id
      });
      
      if (transaction) {
        transaction.transaction_status = 'SUCCESS';
        transaction.transaction_id = paymentEntity.id;
        
        // Map payment method
        let paymentMethod = 'OTHER';
        if (paymentEntity.method) {
          switch (paymentEntity.method) {
            case 'card': paymentMethod = 'CARD'; break;
            case 'upi': paymentMethod = 'UPI'; break;
            case 'netbanking': paymentMethod = 'NET_BANKING'; break;
            case 'wallet': paymentMethod = 'WALLET'; break;
            default: paymentMethod = 'OTHER';
          }
        }
        
        transaction.transaction_mode = paymentMethod;
        transaction.gateway_response = paymentEntity;
        await transaction.save();
      }
      
      // Save payment method for future use if it's a card
      if (paymentEntity.method === 'card') {
        await savePaymentMethod(
          payment.created_by.toString(),
          paymentEntity,
          'RAZORPAY'
        );
      }
    }
  } catch (error) {
    console.error('Error handling subscription payment captured event:', error);
  }
}

/**
 * Handle subscription payment failed event
 */
async function handleSubscriptionPaymentFailed(subscriptionId, paymentEntity) {
  try {
    const payment = await Payment.findOne({
      subscription_id: subscriptionId
    });
    
    if (payment) {
      payment.payment_status = 'FAILED';
      payment.gateway_payment_id = paymentEntity.id;
      await payment.save();
      
      // Update transaction
      const transaction = await Transaction.findOne({
        payment_id: payment._id
      });
      
      if (transaction) {
        transaction.transaction_status = 'FAILED';
        transaction.transaction_id = paymentEntity.id;
        transaction.gateway_response = paymentEntity;
        await transaction.save();
      }
    }
  } catch (error) {
    console.error('Error handling subscription payment failed event:', error);
  }
}

/**
 * Save payment method for future use
 */
async function savePaymentMethod(userId, paymentEntity, gateway) {
  try {
    if (!paymentEntity || !userId) return;
    
    // Determine method type and extract details
    let methodType = 'OTHER';
    let tokenData = {
      user_id: userId,
      gateway: gateway || 'RAZORPAY',
      last_used: new Date(),
      is_default: false
    };
    
    if (paymentEntity.method === 'card' && paymentEntity.card) {
      methodType = 'CARD';
      tokenData.method_type = 'CARD';
      tokenData.card_last4 = paymentEntity.card.last4;
      tokenData.card_network = paymentEntity.card.network;
      tokenData.card_type = paymentEntity.card.type;
      tokenData.card_bank_name = paymentEntity.card.issuer;
      
      // For card token
      if (paymentEntity.token) {
        tokenData.token_id = paymentEntity.token.id;
      } else {
        // Generate a reference if no token
        tokenData.token_id = `rp_${paymentEntity.id}_${Date.now()}`;
      }
    } else if (paymentEntity.method === 'upi') {
      methodType = 'UPI';
      tokenData.method_type = 'UPI';
      // For UPI, we might store the VPA if available
      if (paymentEntity.vpa) {
        tokenData.upi_id = paymentEntity.vpa;
      }
      tokenData.token_id = `rp_${paymentEntity.id}_${Date.now()}`;
    } else {
      // For other methods, just create a reference
      methodType = paymentEntity.method?.toUpperCase() || 'OTHER';
      tokenData.method_type = methodType;
      tokenData.token_id = `rp_${paymentEntity.id}_${Date.now()}`;
    }
    
    // Check if this is the first payment method for the user
    const existingMethods = await PaymentMethod.countDocuments({
      user_id: userId,
      method_type: methodType
    });
    
    if (existingMethods === 0) {
      tokenData.is_default = true;
    }
    
    // Save the payment method if it's tokenizable
    if (['CARD', 'UPI'].includes(methodType)) {
      await PaymentMethod.findOneAndUpdate(
        { token_id: tokenData.token_id, gateway: tokenData.gateway },
        tokenData,
        { upsert: true, new: true }
      );
      
      console.log(`Saved payment method for user ${userId}, type: ${methodType}`);
    }
  } catch (error) {
    console.error('Error saving payment method:', error);
  }
}

exports.updatePlan = async (req, res) => {
  try {
    const planId = req.params.id || req.params.planId;
    
    let existingPlan;
    if (mongoose.Types.ObjectId.isValid(planId)) {
      existingPlan = await SubscriptionPlan.findById(planId);
    } else {
      existingPlan = await SubscriptionPlan.findOne({ plan_id: planId });
    }
    
    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }
    
    // For Razorpay, we can only update notes on existing plans
    if (existingPlan.plan_id && req.body.notes) {
      try {
        // Update notes in Razorpay
        await razorpay.plans.edit(existingPlan.plan_id, {
          notes: req.body.notes
        });
        console.log(`Updated Razorpay plan notes: ${existingPlan.plan_id}`);
      } catch (razorpayError) {
        console.error('Warning: Could not update Razorpay plan:', razorpayError);
        // Continue anyway as we can still update our database
      }
    }
    
    // Update fields in our database
    const updatableFields = [
      'name', 'workspace_type', 'description', 'price', 
      'free_trial_days', 'discount', 'categories'
    ];
    
    // Handle categories specially to maintain proper structure
    if (req.body.categories) {
      let formattedCategories = [];
      
      // If categories is an array of strings, convert to proper format
      if (Array.isArray(req.body.categories) && typeof req.body.categories[0] === 'string') {
        formattedCategories = req.body.categories.map(cat => ({
          name: cat,
          features: []
        }));
        req.body.categories = formattedCategories;
      }
    }
    
    // Build update object with only provided fields
    const updateData = {};
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // Add updated timestamp
    updateData.updated_at = new Date();
    
    // Apply the update
    const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(
      existingPlan._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      plan: updatedPlan
    });
    
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const planId = req.params.id || req.params.planId;
    
    // Find the plan
    let plan;
    if (mongoose.Types.ObjectId.isValid(planId)) {
      plan = await SubscriptionPlan.findById(planId);
    } else {
      plan = await SubscriptionPlan.findOne({ plan_id: planId });
    }
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }
    
    // Check if plan has active subscriptions
    const activeSubscriptions = await UserSubscription.countDocuments({
      current_tier: plan.name,
      status: 'active'
    });
    
    if (activeSubscriptions > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete plan with ${activeSubscriptions} active subscriptions`
      });
    }
    
    // Delete from Razorpay if possible (note: Razorpay might not allow this)
    if (plan.plan_id) {
      try {
        // Note: As of my knowledge, Razorpay doesn't allow deleting plans
        // This is just a placeholder in case they add this functionality
        // await razorpay.plans.delete(plan.plan_id);
        console.log('Note: Razorpay does not support deleting plans');
      } catch (razorpayError) {
        console.error('Warning: Could not delete from Razorpay:', razorpayError);
        // Continue anyway as we can still delete from our database
      }
    }
    
    // Delete from our database
    await SubscriptionPlan.findByIdAndDelete(plan._id);
    
    res.status(200).json({
      success: true,
      message: 'Plan deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

