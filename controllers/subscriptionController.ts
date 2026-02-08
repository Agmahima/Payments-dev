// const Razorpay=require('razorpay');
// // const crypto=require('crypto');
// // const mongoose=require('mongoose');
// // const UserSubscription=require('../models/UserSubscription');
// // const Subscription=require('../models/SubscriptionPlan');
// const UserSubscription=require('../models/userSubscriptionSchema');
// const SubscriptionPlan=require('../models/subscriptionPlanSchema');
// const Payment=require('../models/Payment.js');
// const Transaction=require('../models/Transaction');

// const PaymentMethod=  require('../models/paymentMethodSchema');
// const RazorpaySubscriptionService = require('../services/razorpay.js');
// const paymentService = require('../services/PaymentService.js');
// const razorpay=new Razorpay({
//   key_id:process.env.RAZORPAY_KEY_ID,
//   key_secret:process.env.RAZORPAY_KEY_SECRET
// });
// RAZORPAY_WEBHOOK_SECRET=process.env.RAZORPAY_WEBHOOK_SECRET;


// const verifyWebhookSignature = (rawBody, receivedSignature, webhookSecret) => {
//   try {
//     // Ensure rawBody is a Buffer
//     if (typeof rawBody === 'string') {
//       rawBody = Buffer.from(rawBody, 'utf-8');
//     }

//     // Generate HMAC-SHA256 hash using the webhook secret and raw body
//     const hmac = crypto.createHmac('sha256', webhookSecret);
//     hmac.update(rawBody); // Update HMAC with raw body
//     const expectedSignature = hmac.digest('hex'); // Generate expected signature
//     console.log('Expected signature:', expectedSignature);
//     console.log('Received signature:', receivedSignature);

//     // Compare the received signature with the expected signature
//     return receivedSignature === expectedSignature;
//   } catch (error) {
//     console.error('Error verifying webhook signature:', error);
//     return false;
//   }
// };


// exports.createPlan=async(req,res)=>{
//   try{
//     const{ name,period,interval,item}=req.body;
    
//     // Validate period value
//     const validPeriods = ['daily', 'weekly', 'monthly', 'yearly'];
//     if (!validPeriods.includes(period)) {
//       return res.status(400).json({
//         success: false,
//         error: `Invalid period value. Must be one of: ${validPeriods.join(', ')}`
//       });
//     }
    
//     const plan=await razorpay.plans.create({
//       period,
//       interval,
//       item:{
//         name,
//         amount:item.amount*100,
//         currency:item.currency||'INR',
//         description:item.description||''
//       },
//       notes:req.body.notes||{}
//     });

//     // Map period to duration properly
//     let duration;
//     if (period === 'monthly' && interval === 1) {
//       duration = 'monthly';
//     } else if (period === 'monthly' && interval === 3) {
//       duration = 'quarterly';
//     } else if (period === 'yearly') {
//       duration = 'yearly';
//     } else {
//       duration = `${period}-${interval}`;
//     }

//     // Handle categories based on input format
//     let formattedCategories = [];
    
//     // Check if we received categories in the request
//     if (req.body.categories) {
//       // If categories is an array of strings, convert to proper format
//       if (Array.isArray(req.body.categories) && typeof req.body.categories[0] === 'string') {
//         formattedCategories = req.body.categories.map(cat => ({
//           name: cat,
//           features: []
//         }));
//       } 
//       // If it's already in the correct format, use as is
//       else if (Array.isArray(req.body.categories) && typeof req.body.categories[0] === 'object') {
//         formattedCategories = req.body.categories;
//       }
//     }

//     const subscriptionPlan=new SubscriptionPlan({
//       name:name,
//       workspace_type:req.body.workspace_type,
//       description:item.description||'',
//       price:item.amount,
//       duration:duration,
//       categories:formattedCategories,
//       plan_id:plan.id
//     });

//     await subscriptionPlan.save();
//     res.status(201).json({
//       success:true,
//       plan,
//       subscriptionPlan
//     })
//     console.log('Plan created:',plan);
//     console.log('Subscription plan created:',subscriptionPlan);
//   }
//   catch(error){
//     console.error('Error creating plan:',error);
//     res.status(500).json({
//       success:false,
//       error:error.message
//     })
//   }
// };

// // exports.createSubscription = async (req, res) => {
// //   try {
// //     const {
// //       plan_id, // This should be the MongoDB plan _id
// //       total_count,
// //       quantity,
// //       person_id,
// //       workspace_id,
// //       customer_notify,
// //       notes
// //     } = req.body;

// //     // Fetch the plan details from MongoDB using its _id
// //     // let plan = await SubscriptionPlan.findById(plan_id);
// //     let plan = await SubscriptionPlan.findOne({ plan_id: plan_id });
// //     console.log("Plan:", plan);
// //     if (!plan) {
// //       return res.status(404).json({
// //         success: false,
// //         message: 'Plan not found in database'
// //       });
// //     }

// //     // If the plan does not exist in Razorpay, create it dynamically.
// //     // We check if plan.plan_id is missing (or null/empty).
// //     if (!plan.plan_id) {
// //       console.log(`Plan not found in Razorpay. Creating dynamically: ${plan_id}`);
      
// //       // Choose period and interval based on plan.duration
// //       // Assuming your duration is set to one of: "monthly", "quarterly", or "yearly"
// //       let period, interval;
// //       if (plan.duration === 'monthly') {
// //         period = 'monthly';
// //         interval = 1;
// //       } else if (plan.duration === 'quarterly') {
// //         period = 'monthly';
// //         interval = 3;
// //       } else if (plan.duration === 'yearly') {
// //         period = 'yearly';
// //         interval = 1;
// //       } else {
// //         // Fallback if duration is not standard
// //         period = 'monthly';
// //         interval = 1;
// //       }

// //       const razorpayPlan = await razorpay.plans.create({
// //         period,
// //         interval,
// //         item: {
// //           name: plan.name,
// //           amount: plan.price * 100, // Convert rupees to paise
// //           currency: 'INR',
// //           description: plan.description || ''
// //         },
// //         notes: notes || {}
// //       });

// //       // Update the database with the new Razorpay plan_id
// //       plan.plan_id = razorpayPlan.id;
// //       await plan.save();
// //     }

// //     console.log('Creating subscription for plan:', {
// //       plan_id: plan.plan_id,
// //       plan_name: plan.name,
// //       workspace_type: plan.workspace_type
// //     });

// //     // Create a Razorpay subscription using the Razorpay plan_id
// //     const subscriptionOptions = {
// //       plan_id: plan.plan_id,
// //       total_count: total_count || 12,
// //       quantity: quantity || 1,
// //       expire_by: Math.round(Date.now() / 1000) + 31536000, // Default to 1 year (in seconds)
// //       customer_notify: customer_notify || 1,
// //       notes: notes || {}
// //     };

// //     if (req.body.customer_id) {
// //       subscriptionOptions.customer_id = req.body.customer_id;
// //     }

// //     const subscription = await razorpay.subscriptions.create(subscriptionOptions);

// //     // Calculate the validUntil date based on the plan's duration and total_count
// //     let validUntil = new Date();
// //     if (plan.duration === 'monthly') {
// //       validUntil.setMonth(validUntil.getMonth() + (total_count || 12));
// //     } else if (plan.duration === 'quarterly') {
// //       validUntil.setMonth(validUntil.getMonth() + ((total_count || 4) * 3));
// //     } else if (plan.duration === 'yearly') {
// //       validUntil.setFullYear(validUntil.getFullYear() + (total_count || 1));
// //     } else {
// //       // Fallback, assume monthly if unknown
// //       validUntil.setMonth(validUntil.getMonth() + (total_count || 12));
// //     }

// //     // Convert person_id and workspace_id to ObjectId if needed
// //     let personObjectId = mongoose.Types.ObjectId.isValid(person_id)
// //       ? new mongoose.Types.ObjectId(person_id)
// //       : person_id;
// //     let workspaceObjectId = mongoose.Types.ObjectId.isValid(workspace_id)
// //       ? new mongoose.Types.ObjectId(workspace_id)
// //       : workspace_id;

// //     // Create user subscription record in your database
// //     const userSubscription = new UserSubscription({
// //       person_id: personObjectId,
// //       workspace_id: workspaceObjectId,
// //       current_tier: plan.name,
// //       valid_until: validUntil,
// //       subscription_id: subscription.id,
// //       used_benefits: [],
// //       status: 'created'
// //     });
// //     console.log("Saving userSubscription:", userSubscription);
// //     console.log("Person ID:", personObjectId, "Workspace ID:", workspaceObjectId);
// // console.log("Valid ObjectId for Person:", mongoose.Types.ObjectId.isValid(person_id));
// // console.log("Valid ObjectId for Workspace:", mongoose.Types.ObjectId.isValid(workspace_id));


// //     await userSubscription.save();
// //     console.log("UserSubscription saved successfully");


// //     // Create payment record for this subscription
// //     const payment = new Payment({
// //       payment_purpose: 'Subscription',
// //       payment_amount: plan.price,
// //       payment_currency: 'INR',
// //       payee_ref: personObjectId,
// //       payee_type: 'Person',
// //       receiver_ref: workspaceObjectId,
// //       receiver_type: 'Entity',
// //       request_ref: userSubscription._id,
// //       payment_gateway: 'RAZORPAY',
// //       payment_status: 'PENDING',
// //       is_subscription: true,
// //       subscription_type: plan.duration,
// //       subscription_id: subscription.id,
// //       subscription_status: 'CREATED',
// //       created_by: personObjectId,
// //       updated_by: personObjectId
// //     });
// //     await payment.save();

// //     // Create transaction record
// //     const transaction = new Transaction({
// //       payment_id: payment._id,
// //       transaction_id: subscription.id,
// //       transaction_status: 'PENDING',
// //       transaction_mode: 'OTHER',
// //       payment_mode: 'ONLINE',
// //       gateway_used: 'RAZORPAY',
// //       created_by: personObjectId,
// //       updated_by: personObjectId
// //     });
// //     await transaction.save();

// //     // Update payment with transaction reference
// //     await Payment.findByIdAndUpdate(payment._id, { transaction: transaction._id });

// //     return res.status(201).json({
// //       success: true,
// //       subscription,
// //       userSubscription,
// //       payment_id: payment._id,
// //       razorpay_key: process.env.RAZORPAY_KEY_ID
// //     });

// //   } catch (error) {
// //     console.error('Error creating subscription:', error);
// //     return res.status(500).json({
// //       success: false,
// //       error: error.message
// //     });
// //   }
// // };
// exports.createSubscription = async (req,res)=>{
//   try {
//     const {gateway}=req.body;
//     if(!gateway){
//       return res.status(400).json({success:false,error:'Gateway not specified'});
//     }
    
//     // const result=await RazorpaySubscriptionService.createSubscription(req.body);
//     const result=await paymentService.processSubscription(req.body);
//     return res.status(201).json(result);
//   }catch(error){
//     console.error('Error creating subscription:', error);
//     return res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// }

// exports.verifySubscription = async (req, res) => {
//   try {
//     const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

//     // Verify signature
//     const generated_signature = crypto
//       .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
//       .update(razorpay_subscription_id + '|' + razorpay_payment_id)
//       .digest('hex');

//     if (generated_signature === razorpay_signature) {
//       // Find the subscription
//       const userSubscription = await UserSubscription.findOne({
//         payment_transaction_id: razorpay_subscription_id
//       });

//       if (!userSubscription) {
//         return res.status(404).json({
//           success: false,
//           error: 'Subscription not found'
//         });
//       }

//       // Update subscription status
//       userSubscription.status = 'active';
//       await userSubscription.save();

//       // Find and update payment status
//       const payment = await Payment.findOne({
//         subscription_id: razorpay_subscription_id
//       });

//       if (payment) {
//         payment.payment_status = 'SUCCESS';
//         payment.subscription_status = 'ACTIVE';
//         payment.gateway_payment_id = razorpay_payment_id;
//         await payment.save();

//         // Update transaction
//         const transaction = await Transaction.findOne({
//           payment_id: payment._id
//         });

//         if (transaction) {
//           transaction.transaction_status = 'SUCCESS';
//           transaction.transaction_id = razorpay_payment_id;
//           // Determine payment method when available from Razorpay callback
          
//           await transaction.save();
//         }
//       }

//       res.status(200).json({
//         success: true,
//         message: 'Payment verified successfully'
//       });
//     } else {
//       res.status(400).json({
//         success: false,
//         error: 'Payment verification failed'
//       });
//     }
//   } catch (error) {
//     console.error("Error verifying payment:", error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// };

// exports.getAllPlans=async(req,res)=>{
//   try{
//     const plans=await SubscriptionPlan.find();
//     console.log('Plans:',plans);
//     res.status(200).json({
//       success:true,
//       plans
//     });
//   }
//   catch(error){
//     console.error('Error fetching plans:',error);
//     res.status(500).json({
//       success:false,
//       error:error.message
//     });
//   }
// }

// exports.getPlan=async(req,res)=>{
//   try{
//     const planId = req.params.id || req.params.planId;

//     //console.log(req);
//     console.log(planId);
//     const plan=await SubscriptionPlan.findById(planId);
//     if(!plan){
//       return res.status(404).json({
//         success:false,
//         error:'Plan not found'
//       });
//     }
//     res.status(200).json({
//       success:true,
//       plan
//     });
//   }
//   catch(error){
//     console.error('Error fetching plan:',error);
//     res.status(500).json({
//       success:false,
//       error:error.message
//     });
//   }
// }

// exports.getSubscription=async(req,res)=>{
//   try{
//     const subscription_id=req.params.id || req.params.subscriptionId;
//     const subscription=await UserSubscription.findById(subscription_id);
//     if(!subscription){
//       return res.status(404).json({
//         success:false,
//         error:'Subscription not found'
//       });
//     }
//     res.status(200).json({
//       success:true,
//       subscription
//     });
//   }
//   catch(error){
//     console.error('Error fetching subscription:',error);
//     res.status(500).json({
//       success:false,
//       error:error.message
//     });
//   }
// }

// exports.getAllSubscriptions=async(req,res)=>{
//   try{
//     const subscriptions=await UserSubscription.find();
//     res.status(200).json({
//       success:true,
//       subscriptions
//     });
//   }
//   catch(error){
//     console.error('Error fetching subscriptions:',error);
//     res.status(500).json({
//       success:false,
//       error:error.message
//     });
//   }
// }

// exports.cancelSubscription = async (req, res) => {
//   try {
//     const subscription_id = req.params.id || req.params.subscriptionId;
//     const subscription = await UserSubscription.findById(subscription_id);
   
//     if (!subscription) {
//       return res.status(404).json({
//         success: false,
//         error: 'Subscription not found'
//       });
//     }
    
//     // Cancel the subscription in Razorpay
//     await razorpay.subscriptions.cancel(subscription.payment_transaction_id, {
//       cancel_at_cycle_end: req.body.cancel_at_cycle_end || false
//     });
//     //delete the subscription from the database
//    // await UserSubscription.deleteOne({ _id: subscription_id });
    
//     // just update the status instead of deleting
//     await UserSubscription.findByIdAndUpdate(subscription_id, { 
//       status: 'cancelled',
//       updated_at: new Date()
//     });
    
//     // Update related payment records
//     await Payment.updateMany(
//       { subscription_id: subscription.payment_transaction_id },
//       { 
//         subscription_status: 'CANCELLED',
//         updated_at: new Date()
//       }
//     );
    
//     res.status(200).json({
//       success: true,
//       message: 'Subscription cancelled successfully'
//     });
//   }
//   catch (error) {
//     console.error('Error cancelling subscription:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// }

// exports.updateSubscription = async (req, res) => {
//   try {
//     console.log(req.body);
//     console.log(req.params);
//     const subscriptionId = req.params.id || req.params.subscriptionId;
//     const subscription = await UserSubscription.findOne({ subscription_id: subscriptionId });
//     console.log(subscription);
    
//     if (!subscription) {
//       return res.status(404).json({
//         success: false,
//         error: 'Subscription not found'
//       });
//     }
    
//     // Store previous tier/plan for comparison
//     const previousTier = subscription.current_tier;
    
//     // Get Razorpay plan IDs for both tiers
//     const oldPlan = await SubscriptionPlan.findOne({ name: previousTier });
//     console.log("old plan :",oldPlan);
//     const newPlan = req.body.current_tier ? 
//       await SubscriptionPlan.findOne({ name: req.body.current_tier }) : 
//       oldPlan;
//       console.log("new plan :",newPlan);
    
//     if (newPlan && previousTier === newPlan.name) {
//       return res.status(400).json({
//         success: false,
//         error: 'Already subscribed to this plan'
//       });
//     }
    
//     // Build update object for database
//     const updateData = {};
    
//     // Fields that can be updated
//     const updatableFields = [
//       'current_tier', 'valid_until', 'status', 'used_benefits'
//     ];
//     console.log("updatableFields:",updatableFields);
    
//     updatableFields.forEach(field => {
//       if (req.body[field] !== undefined) {
//         updateData[field] = req.body[field];
//       }
//     });
    
//     updateData.updated_at = new Date();
    
//     let razorpayResponse = null;
//     // Check if user wants immediate upgrade or cycle-end change
//     const scheduleChangeAt = req.body.immediate ? "now" : "cycle_end";
//     console.log("scheduleChangeAt:",scheduleChangeAt);
    
//     // Update plan in Razorpay if tier is being changed
//     if (req.body.current_tier && req.body.current_tier !== previousTier && 
//           newPlan && newPlan.plan_id) {
      
//       // Determine if this is an upgrade or downgrade
//       const isUpgrade = newPlan.price > (oldPlan?.price || 0);
//       const isDowngrade = newPlan.price < (oldPlan?.price);
//       console.log(isDowngrade);
//       console.log("Start 1");
      
//       try {
//         // For downgrades, always use cycle_end regardless of immediate flag
//         // This matches your previous logic of setting scheduled_downgrade
//         const effectiveSchedule = isDowngrade ? "cycle_end" : scheduleChangeAt;
        
//         // PATCH the subscription with the new plan_id
//         razorpayResponse = await razorpay.subscriptions.update(subscription.subscription_id, {
//           plan_id: newPlan.plan_id,
//           schedule_change_at: effectiveSchedule,
//           customer_notify: 1
//         });
//         console.log("Start 2");
        
//         console.log('Razorpay update response:', razorpayResponse);
        
//         // If this is a downgrade, reflect that in our database
//         if (isDowngrade) {
//           updateData.scheduled_downgrade = req.body.current_tier;
//           // Don't change current_tier yet for downgrades
//           delete updateData.current_tier; 
//         }
        
//       } catch (razorpayError) {
//         console.error('Error updating plan with Razorpay:', razorpayError);
//         return res.status(400).json({
//           success: false,
//           error: razorpayError.error ? razorpayError.error.description : razorpayError.message
//         });
//       }
//     }
 
//     const updatedSubscription = await UserSubscription.findOneAndUpdate(
//       { subscription_id: subscriptionId },
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );
    
//     // Build response
//     const isUpgrade = newPlan && oldPlan && newPlan.price > oldPlan.price;
//     const isDowngrade = newPlan && oldPlan && newPlan.price < oldPlan.price;
//     console.log("Updated data :",updateData);
    
//     const response = {
//       success: true,
//       message: isDowngrade 
//         ? "Subscription downgrade scheduled for next billing cycle"
//         : (scheduleChangeAt === "now" 
//           ? "Subscription upgrade initiated. Additional payment may be required."
//           : "Subscription update scheduled for next billing cycle."),
//       previousPlan: previousTier,
//       newPlan: isDowngrade ? previousTier : updatedSubscription.current_tier, // For downgrades, show current plan still
//       scheduled_downgrade: updatedSubscription.scheduled_downgrade, // Add this for downgrades
//       subscription: updatedSubscription,
//       effective_at: isDowngrade || scheduleChangeAt === "cycle_end" ? "next billing cycle" : "immediately"
//     };
    
//     // Add payment link if provided by Razorpay (for immediate upgrades)
//     if (razorpayResponse && razorpayResponse.short_url) {
//       response.payment_link = razorpayResponse.short_url;
//       response.razorpay_key = process.env.RAZORPAY_KEY_ID;
//       response.requires_payment = true;
//       response.message = "Plan upgrade requires additional payment. Please use the payment link.";
      
//       // Calculate prorated amount if upgrade
//       if (isUpgrade && oldPlan && newPlan) {
//         const now = new Date();
//         const validUntil = new Date(subscription.valid_until);
//         const remainingDays = Math.ceil((validUntil - now) / (1000 * 60 * 60 * 24));
//         const daysInPlan = oldPlan.duration === "monthly" ? 30 : 
//                           oldPlan.duration === "yearly" ? 365 : 90;
        
//         const proRatedPrice = Math.max(0, 
//           newPlan.price - ((oldPlan.price / daysInPlan) * remainingDays)
//         ).toFixed(2);
//         console.log("proRatedPrice:",proRatedPrice);
        
//         response.proration = {
//           remaining_days: remainingDays,
//           days_in_plan: daysInPlan,
//           old_plan_price: oldPlan.price,
//           new_plan_price: newPlan.price,
//           prorated_amount: proRatedPrice
//         };
//       }
//     }
    
//     res.status(200).json(response);
    
//   } catch (error) {
//     console.error('Error updating subscription:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// };


// exports.handleRazorpayWebhook = async (req, res) => {
  
//   try {
//     // Get the signature sent by Razorpay in the headers
//     const signature = req.headers['x-razorpay-signature'];
//     const rawBody = req.rawBody;

//     if (!signature) {
//       console.error("Webhook signature missing");
//       return res.status(400).json({ error: "Signature missing" });
//     }

//     const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; // Your Razorpay webhook secret

//     if (!webhookSecret) {
//       console.error("Webhook secret missing");
//       return res.status(400).json({ error: "Webhook secret missing" });
//     }

//     // Verify webhook signature
//     const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);

//     if (!isValid) {
//       console.error("Invalid webhook signature");
//       return res.status(400).json({ error: "Invalid signature" });
//     }

//     // Process the webhook event
//     const { event, payload } = req.body;
//     console.log(`Received Razorpay webhook:`, { event, payload });

//     // Handle the event (e.g., subscription activated)
//     switch (event) {
//       case 'subscription.activated':
//         console.log("Subscription activated:", payload);
//         break;
//       case 'subscription.ended':
//         console.log("Subscription ended:", payload);
//         break;
//       // Add other cases as needed
//       default:
//         console.log("Unhandled event:", event);
//     }

//     // Respond to Razorpay to acknowledge receipt
//     res.status(200).json({ received: true });

//   } catch (error) {
//     console.error("Error processing webhook:", error);
//     res.status(400).json({ error: "Webhook processing failed" });
//   }
// };

// exports.updatePlan = async (req, res) => {
//   try {
//     const planId = req.params.id || req.params.planId;
    
//     let existingPlan;
//     if (mongoose.Types.ObjectId.isValid(planId)) {
//       existingPlan = await SubscriptionPlan.findById(planId);
//     } else {
//       existingPlan = await SubscriptionPlan.findOne({ plan_id: planId });
//     }
    
//     if (!existingPlan) {
//       return res.status(404).json({
//         success: false,
//         error: 'Plan not found'
//       });
//     }
    
//     // For Razorpay, we can only update notes on existing plans
//     if (existingPlan.plan_id && req.body.notes) {
//       try {
//         // Update notes in Razorpay
//         await razorpay.plans.edit(existingPlan.plan_id, {
//           notes: req.body.notes
//         });
//         console.log(`Updated Razorpay plan notes: ${existingPlan.plan_id}`);
//       } catch (razorpayError) {
//         console.error('Warning: Could not update Razorpay plan:', razorpayError);
//         // Continue anyway as we can still update our database
//       }
//     }
    
//     // Update fields in our database
//     const updatableFields = [
//       'name', 'workspace_type', 'description', 'price', 
//       'free_trial_days', 'discount', 'categories'
//     ];
    
//     // Handle categories specially to maintain proper structure
//     if (req.body.categories) {
//       let formattedCategories = [];
      
//       // If categories is an array of strings, convert to proper format
//       if (Array.isArray(req.body.categories) && typeof req.body.categories[0] === 'string') {
//         formattedCategories = req.body.categories.map(cat => ({
//           name: cat,
//           features: []
//         }));
//         req.body.categories = formattedCategories;
//       }
//     }
    
//     // Build update object with only provided fields
//     const updateData = {};
//     updatableFields.forEach(field => {
//       if (req.body[field] !== undefined) {
//         updateData[field] = req.body[field];
//       }
//     });
    
//     // Add updated timestamp
//     updateData.updated_at = new Date();
    
//     // Apply the update
//     const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(
//       existingPlan._id,
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );
    
//     res.status(200).json({
//       success: true,
//       plan: updatedPlan
//     });
    
//   } catch (error) {
//     console.error('Error updating plan:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// };

// exports.deletePlan = async (req, res) => {
//   try {
//     const planId = req.params.id || req.params.planId;
    
//     // Find the plan
//     let plan;
//     if (mongoose.Types.ObjectId.isValid(planId)) {
//       plan = await SubscriptionPlan.findById(planId);
//     } else {
//       plan = await SubscriptionPlan.findOne({ plan_id: planId });
//     }
    
//     if (!plan) {
//       return res.status(404).json({
//         success: false,
//         error: 'Plan not found'
//       });
//     }
    
//     // Check if plan has active subscriptions
//     const activeSubscriptions = await UserSubscription.countDocuments({
//       current_tier: plan.name,
//       status: 'active'
//     });
    
//     if (activeSubscriptions > 0) {
//       return res.status(400).json({
//         success: false,
//         error: `Cannot delete plan with ${activeSubscriptions} active subscriptions`
//       });
//     }
    
//     // Delete from Razorpay if possible (note: Razorpay might not allow this)
//     if (plan.plan_id) {
//       try {
//         // Note: As of my knowledge, Razorpay doesn't allow deleting plans
//         // This is just a placeholder in case they add this functionality
//         // await razorpay.plans.delete(plan.plan_id);
//         console.log('Note: Razorpay does not support deleting plans');
//       } catch (razorpayError) {
//         console.error('Warning: Could not delete from Razorpay:', razorpayError);
//         // Continue anyway as we can still delete from our database
//       }
//     }
    
//     // Delete from our database
//     await SubscriptionPlan.findByIdAndDelete(plan._id);
    
//     res.status(200).json({
//       success: true,
//       message: 'Plan deleted successfully'
//     });
    
//   } catch (error) {
//     console.error('Error deleting plan:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// };

