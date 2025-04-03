const razorpay = require('../config/razorpay');
const cashfree= require('../config/cashfree');
const mongoose = require('mongoose');
const SubscriptionPlan= require('../models/subscriptionPlanSchema');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const UserSubscription = require('../models/userSubscriptionSchema');


class RazorpayService {
  static async createSubscription(data) {
    try {
      const { plan_id, total_count, quantity, person_id, workspace_id, customer_notify, notes } = data;

      // Fetch plan details from MongoDB
      let plan = await SubscriptionPlan.findOne({ plan_id });
      if (!plan) {
        throw new Error('Plan not found in database');
      }

      // If the plan does not exist in Razorpay, create it dynamically
      if (!plan.plan_id) {
        console.log(`Plan not found in Razorpay. Creating dynamically: ${plan_id}`);

        let period, interval;
        if (plan.duration === 'monthly') {
          period = 'monthly';
          interval = 1;
        } else if (plan.duration === 'quarterly') {
          period = 'monthly';
          interval = 3;
        } else if (plan.duration === 'yearly') {
          period = 'yearly';
          interval = 1;
        } else {
          period = 'monthly';
          interval = 1;
        }

        const razorpayPlan = await razorpay.plans.create({
          period,
          interval,
          item: {
            name: plan.name,
            amount: plan.price * 100,
            currency: 'INR',
            description: plan.description || '',
          },
          notes: notes || {},
        });

        plan.plan_id = razorpayPlan.id;
        await plan.save();
      }

      console.log('Creating subscription for plan:', plan.name);

      // Create Subscription in Razorpay
      const subscriptionOptions = {
        plan_id: plan.plan_id,
        total_count: total_count || 12,
        quantity: quantity || 1,
        expire_by: Math.round(Date.now() / 1000) + 31536000,
        customer_notify: customer_notify || 1,
        notes: notes || {},
      };

      if (data.customer_id) {
        subscriptionOptions.customer_id = data.customer_id;
      }

      const subscription = await razorpay.subscriptions.create(subscriptionOptions);

      // Calculate validity period
      let validUntil = new Date();
      if (plan.duration === 'monthly') {
        validUntil.setMonth(validUntil.getMonth() + (total_count || 12));
      } else if (plan.duration === 'quarterly') {
        validUntil.setMonth(validUntil.getMonth() + ((total_count || 4) * 3));
      } else if (plan.duration === 'yearly') {
        validUntil.setFullYear(validUntil.getFullYear() + (total_count || 1));
      }

      let personObjectId = mongoose.Types.ObjectId.isValid(person_id)
        ? new mongoose.Types.ObjectId(person_id)
        : person_id;
      let workspaceObjectId = mongoose.Types.ObjectId.isValid(workspace_id)
        ? new mongoose.Types.ObjectId(workspace_id)
        : workspace_id;

      // Store subscription details in MongoDB
      const userSubscription = new UserSubscription({
        person_id: personObjectId,
        workspace_id: workspaceObjectId,
        current_tier: plan.name,
        valid_until: validUntil,
        subscription_id: subscription.id,
        used_benefits: [],
        status: 'created',
      });

      await userSubscription.save();

      // Create payment record
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
        updated_by: personObjectId,
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
        updated_by: personObjectId,
      });

      await transaction.save();

      // Link payment to transaction
      await Payment.findByIdAndUpdate(payment._id, { transaction: transaction._id });

      return {
        success: true,
        subscription,
        userSubscription,
        payment_id: payment._id,
        razorpay_key: process.env.RAZORPAY_KEY_ID,
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new Error(error.message);
    }
  }

  static async createOrder(paymentData) {
    try {
        // 1️⃣ Create Payment Record in MongoDB
        const payment = new Payment({
          request_ref: `INV-${Date.now()}`,
          payment_purpose: 'Investment',
          payment_amount: paymentData.payment_amount,
          payment_currency: 'INR',
          payee_ref: paymentData.payee_ref,
          payee_type: paymentData.payee_type,
          receiver_ref: paymentData.receiver_ref,
          receiver_type: paymentData.receiver_type,
          payment_gateway: 'RAZORPAY',
          payment_status: 'PENDING',
          created_by: paymentData.created_by,
          updated_by: paymentData.updated_by
        });
    
        await payment.save();
    
        // 2️⃣ Create Razorpay Order
        const razorpayOrder = await razorpay.orders.create({
          amount: paymentData.payment_amount * 100, // Razorpay accepts amount in paise
          currency: 'INR',
          receipt: payment.request_ref,
          payment_capture: 1
        });
    
        // 3️⃣ Create a Transaction Record in MongoDB
        const transaction = new Transaction({
          transaction_mode: 'PENDING',
          payment_id: payment._id,
          gateway_used: 'RAZORPAY',
          gateway_response: razorpayOrder,
          created_by: paymentData.created_by,
          updated_by: paymentData.updated_by
        });
    
        await transaction.save();
    
        return {
          success: true,
          orderId: razorpayOrder.id,
          paymentId: payment._id
        };
      } catch (error) {
        console.error('Error processing investment payment:', error);
        throw error;
      }
  }
}

module.exports = RazorpayService;
