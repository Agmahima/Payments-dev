const UserSubscription = require('../models/UserSubscription');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const PaymentGateway = require('../models/PaymentGateway');
const axios = require('axios');
const crypto = require('crypto');

exports.createSubscription = async (req, res) => {
    try {
        const { userId, tier, paymentMethod, paymentGatewayId } = req.body;

        // Fetch payment gateway details
        const paymentGateway = await PaymentGateway.findById(paymentGatewayId);
        if (!paymentGateway || !paymentGateway.isActive) {
            return res.status(400).json({ error: "Invalid or inactive payment gateway" });
        }

        // Determine the amount based on the tier
        const amount = getAmountForTier(tier); 
        const currency = 'INR'; 

        // Create a new transaction
        const transaction = new Transaction({
            transactionId: crypto.randomUUID(),
            userId,
            amount,
            currency,
            status: 'pending'
        });
        await transaction.save();

        // Create a new payment
        const payment = new Payment({
            userId,
            paymentFor: transaction._id,
            paymentMethod,
            paymentGateway: paymentGateway._id,
            amount,
            currency,
            status: 'pending',
            transactionId: transaction.transactionId,
            createdBy: userId
        });
        await payment.save();

        // Call the payment gateway API
        const paymentResponse = await axios.post(paymentGateway.config.apiUrl, {
            amount,
            currency,
            transactionId: transaction.transactionId,
            callbackUrl: 'https://callback-url.com' 
        });

        // Update transaction and payment status based on the response
        transaction.status = paymentResponse.data.status;
        payment.status = paymentResponse.data.status;
        await transaction.save();
        await payment.save();

        // Create a new subscription
        const subscription = new UserSubscription({
            person_id: userId,
            current_tier: tier,
            valid_until: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year validity
            payment_transaction_id: transaction.transactionId
        });
        await subscription.save();

        res.status(201).json({ message: "Subscription created", subscription });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

function getAmountForTier(tier) {
   
    switch (tier) {
        case 'basic':
            return 100;
        case 'premium':
            return 200;
        case 'enterprise':
            return 300;
        default:
            return 0;
    }
}
