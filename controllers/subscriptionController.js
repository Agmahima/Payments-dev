const Razorpay=require('razorpay');
const crypto=require('crypto');
// const UserSubscription=require('../models/UserSubscription');
// const Subscription=require('../models/SubscriptionPlan');
const UserSubscription=require('../models/UserSubscription');
const SubscriptionPlan=require('../models/subscriptionPlanSchema');
const razorpay=new Razorpay({
  key_id:process.env.RAZORPAY_KEY_ID,
  key_secret:process.env.RAZORPAY_KEY_SECRET
});

exports.createPlan=async(req,res)=>{
  try{
    const{ name,period,interval,item}=req.body;
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

    const subscriptionPlan=new SubscriptionPlan({
      name:name,
      workspace_type:req.body.workspace_type,
      description:item.description||'',
      price:item.amount,
      duration:period==='month'?'monthly':period==='year'?'yearly':'quarterly',
      categories:req.body.categories||[],
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
      start_at,
      expire_by,
      customer_notify,
      notes,
      person_id,
      workspace_id
    } = req.body;

    // First verify if plan exists before creating subscription
    const plan = await SubscriptionPlan.findOne({ plan_id: plan_id });
    console.log(plan);
    console.log(req.body);
    
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

    const subscription = await razorpay.subscriptions.create({
      plan_id,
      total_count: total_count || 12,
      quantity: quantity || 1,
      expire_by: expire_by || Math.round(Date.now() / 1000) + 31536000, // Default 1 year
      customer_notify: customer_notify || 1,
      addons: req.body.addons || [],
      notes: notes || {}
    });
    

    let validUntil = new Date();
    if (plan.duration === 'monthly') {
      validUntil.setMonth(validUntil.getMonth() + (total_count || 12));
    } else if (plan.duration === 'yearly') {
      validUntil.setFullYear(validUntil.getFullYear() + (total_count || 1));
    } else if (plan.duration === 'quarterly') {
      validUntil.setMonth(validUntil.getMonth() + (total_count || 4) * 3);
    }

    const userSubscription = new UserSubscription({
      person_id,
      workspace_id,
      current_tier: plan.name,
      valid_until: validUntil,
      payment_transaction_id: subscription.id,
      used_benefits: []
    });

    await userSubscription.save();

    return res.status(201).json({
      success: true,
      subscription,
      userSubscription
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.verifyPayment=async(req,res)=>{
  try{
    const{raazropay_payment_id,razorpay_subscription_id,razorpay_signature}=req.body;

    const generated_signature=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_subscription_id+'|'+raazropay_payment_id)
    .digest('hex');

    if(generated_signature===razorpay_signature){
      const userSubscription=await UserSubscription.findOne({
        payment_transaction_id:razorpay_subscription_id
      });

      if(!userSubscription){
        return res.status(404).json({
          success:false,
          erro:'subscription not found'
        })
      }
      await userSubscription.save();
      res.status(200).json({
        success:true,
        message:'payment verified successsfully'
      })
    }else {res.status(400).json({
      success:false,
      error:'payment verification falied'
    })
  }
}
catch(error){
  console.error("Error verifying payment:",error);
  res.status(500).json({
    success:false,
    error:error.message
  });
}
}

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
    const plan=await SubscriptionPlan.findById(req.params.id);
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
    const subscription=await UserSubscription.findById(req.params.id);
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

exports.cancelSubscription=async(req,res)=>{
  try{
    const subscription=await UserSubscription.findById(req.params.id);
    if(!subscription){
      return res.status(404).json({
        success:false,
        error:'Subscription not found'
      });
    }
    await razorpay.subscriptions.cancel(subscription.payment_transaction_id);
    await subscription.remove();
    res.status(200).json({
      success:true,
      message:'Subscription cancelled successfully'
    });
  }
  catch(error){
    console.error('Error cancelling subscription:',error);
    res.status(500).json({
      success:false,
      error:error.message
    });
  }
}

exports.updateSubscription=async(req,res)=>{
  try{
    const subscription=await UserSubscription.findById(req.params.id);
    if(!subscription){
      return res.status(404).json({
        success:false,
        error:'Subscription not found'
      });
    }
  }catch(error){
      console.error('Error updating subscription:',error);
      res.status(500).json({
        success:false,
        error:error.message
      });
    }
  }

  // exports.webhookHandler=async(req,res)=>{
  //   try{
  //     const {event, payload}=req.body;
  //     console.log('Webhook event:',event);
  //     console.log('Webhook payload:',payload);
  //     if(event==='subscription.charged'){
  //       const subscription=await UserSubscription.findOne({
  //         payment_transaction_id:payload.entity.subscription_id
  //       });
  //       if(!subscription){
  //         console.error('Subscription not found:',payload.entity.subscription_id);
  //         return res.status(404).json({
  //           success:false,
  //           error:'Subscription not found'
  //         });
  //       }
  //       subscription.used_benefits.push({
  //         category:payload.entity.item.description,
  //         feature:payload.entity.item.name,
  //         limit:payload.entity.item.quantity,
  //         usage:payload.entity.item.quantity
  //       });
  //       await subscription.save();
  //       console.log('Subscription updated:',subscription);
  //     }
  //     res.status(200).json({
  //       success:true,
  //       message:'Webhook processed successfully'
  //     });
  //   }
  //   catch(error){
  //     console.error('Error processing webhook:',error);
  //     res.status(500).json({
  //       success:false,
  //       error:error.message
  //     });
  //   }
  // }
  exports.handleRazorpayWebhook = async (req, res) => {
    try {
      // Verify webhook signature
      const webhookSignature = req.headers['x-razorpay-signature'];
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      
      const generatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      if (generatedSignature !== webhookSignature) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
      
      // Process the webhook event
      const event = req.body;
      
      switch (event.event) {
        case 'subscription.charged':
          // Payment successful, update subscription
          await handleSubscriptionCharged(event.payload.subscription.entity);
          break;
          
        case 'subscription.cancelled':
          // Subscription cancelled
          await handleSubscriptionCancelled(event.payload.subscription.entity);
          break;
          
        case 'subscription.pending':
          // Subscription payment pending
          await handleSubscriptionPending(event.payload.subscription.entity);
          break;
          
        case 'subscription.halted':
          // Subscription halted due to payment failures
          await handleSubscriptionHalted(event.payload.subscription.entity);
          break;
          
        // Add other events as needed
      }
      
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  };

