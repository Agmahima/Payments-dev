const Payment = require('../models/Payment');
const PaymentLog = require('../models/PaymentLog');
const PaymentGateway = require('../models/PaymentGateway');

exports.processPayment = async (req, res) => {
    try {
        const { userId, amount, currency, paymentMethod, paymentGateway } = req.body;
        const gateway = await PaymentGateway.findById(paymentGateway);
        console.log('hello boss i am here');
        if (!gateway || !gateway.isActive) {
            return res.status(400).json({ error: "Invalid or inactive payment gateway" });
        }
        const payment = new Payment({ userId, amount, currency, paymentMethod, paymentGateway, status: 'pending' });
        await payment.save();

        await PaymentLog.create({ paymentGatewayId: gateway._id, eventType: 'pending', payload: payment });

        res.status(201).json({ message: "Payment initiated", payment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
