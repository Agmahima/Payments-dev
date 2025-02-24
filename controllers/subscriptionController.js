const UserSubscription = require('../models/UserSubscription');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const axios = require('axios');
const crypto = require('crypto');

const CASHFREE_API_BASE = process.env.NODE_ENV === 'production' 
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

exports.createSubscription = async (req, res) => {
    try {
        const { userId, tier, customerEmail, customerPhone, customerName } = req.body;

        // Determining the amount based on the tier
        const amount = getAmountForTier(tier); 
        const orderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        // Create a new transaction first
        const transaction = new Transaction({
            transactionId: orderId,
            userId,
            amount,
            currency: 'INR',
            status: 'pending'
        });
        await transaction.save();

        // Create Cashfree order
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

        // Create payment record
        const payment = new Payment({
            userId,
            paymentFor: transaction._id,
            paymentMethod: 'CASHFREE',
            amount,
            currency: 'INR',
            status: 'pending',
            transactionId: orderId,
            paymentLink: cashfreeResponse.data.payment_link,
            createdBy: userId
        });
        await payment.save();

        res.status(200).json({
            success: true,
            data: {
                orderId: orderId,
                paymentSessionId: cashfreeResponse.data.payment_session_id,
                paymentLink: cashfreeResponse.data.payment_link
            }
        });

    } catch (error) {
        console.error('Payment creation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// Webhook handler for Cashfree callbacks
exports.webhookHandler = async (req, res) => {
    try {
        const { order, payment } = req.body.data;
        
        // Verify webhook signature
        const webhookSignature = req.headers["x-webhook-signature"];
        const computedSignature = crypto
            .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest("base64");

        if (webhookSignature !== computedSignature) {
            return res.status(400).json({ error: "Invalid signature" });
        }

        // Update transaction
        const transaction = await Transaction.findOne({ transactionId: order.order_id });
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        // Update payment
        const paymentDoc = await Payment.findOne({ transactionId: order.order_id });
        if (!paymentDoc) {
            return res.status(404).json({ error: "Payment not found" });
        }

        if (payment.payment_status === "SUCCESS") {
            // Update transaction and payment status
            transaction.status = 'success';
            paymentDoc.status = 'success';
            await transaction.save();
            await paymentDoc.save();

            // Create subscription
            const subscription = new UserSubscription({
                person_id: transaction.userId,
                current_tier: getTierFromAmount(transaction.amount),
                valid_until: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                payment_transaction_id: transaction.transactionId
            });
            await subscription.save();
        } else {
            transaction.status = 'failed';
            paymentDoc.status = 'failed';
            await transaction.save();
            await paymentDoc.save();
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
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

