const UserSubscription = require('../models/UserSubscription');

exports.createSubscription = async (req, res) => {
    try {
        const { subscription_id, payment_method_id, amount, currency, createdBy } = req.body;

        const subscription = new UserSubscription({
            subscription_id,
            payment_method_id,
            amount,
            currency,
            createdBy
        });

        await subscription.save();
        res.status(201).json({ message: "Subscription created", subscription });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
