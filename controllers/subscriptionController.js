const UserSubscription = require('../models/UserSubscription');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');

const CASHFREE_API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

exports.createSubscription = async (req, res) => {
  try {
    const { userId, tier, customerEmail, customerPhone, customerName } = req.body;
    const amount = getAmountForTier(tier);
    const orderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const orderPayload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: userId,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_name: customerName
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/payment-status?order_id={order_id}`,
        notify_url: `${process.env.BACKEND_URL}/api/subscription/webhook`
      },
      order_note: `Subscription payment for ${tier} tier`
    };
    const cashfreeResponse = await axios.post(
      `${CASHFREE_API_BASE}/orders`, 
      orderPayload,
      {
        headers: {
          'x-api-version': '2022-09-01',
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    const payment = new Payment({
      request_ref: orderId,
      payment_purpose: `Subscription - ${tier.toUpperCase()}`,
      payment_amount: amount,
      payment_currency: 'INR',
      payee_ref: new mongoose.Types.ObjectId(userId),
      payee_type: 'user',
      receiver_ref: new mongoose.Types.ObjectId(userId),
      receiver_type: 'platform',
      payment_gateway: 'CASHFREE',
      payment_status: 'PENDING',
      created_by: new mongoose.Types.ObjectId(userId),
      updated_by: new mongoose.Types.ObjectId(userId)
    });
    await payment.save();
    const transaction = new Transaction({
      transaction_mode: 'OTHER',
      payment_id: payment._id,
      gateway_used: 'CASHFREE',
      gateway_response: cashfreeResponse.data,
      created_by: new mongoose.Types.ObjectId(userId),
      updated_by: new mongoose.Types.ObjectId(userId)
    });
    await transaction.save();
    payment.transaction = transaction._id;
    await payment.save();
    return res.status(200).json({
      success: true,
      data: {
        orderId: orderId,
        paymentSessionId: cashfreeResponse.data.payment_session_id,
        paymentLink: cashfreeResponse.data.payment_link
      }
    });
  } catch (error) {
    console.error('Subscription creation error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

function getAmountForTier(tier) {
  switch (tier) {
    case 'basic':
      return 999;
    case 'premium':
      return 1999;
    case 'enterprise':
      return 4999;
    default:
      return 0;
  }
}
