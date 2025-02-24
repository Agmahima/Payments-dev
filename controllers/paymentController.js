const Payment = require('../models/Payment');
const PaymentLog = require('../models/PaymentLog');
const PaymentGateway = require('../models/PaymentGateway');
const Transaction = require('../models/Transaction');
const UserSubscription = require('../models/UserSubscription');
const { cashfreeHandler } = require('../gateways/cashfree');
const { razorpayHandler } = require('../gateways/razorpay');

const gatewayHandlers = {
    'CASHFREE': cashfreeHandler,
    'RAZORPAY': razorpayHandler
};

// exports.processPayment = async (req, res) => {
//     try {
//         const { userId, amount, currency, paymentMethod, paymentGateway } = req.body;
//         const gateway = await PaymentGateway.findById(paymentGateway);
//         console.log('hello boss i am here');
//         if (!gateway || !gateway.isActive) {
//             return res.status(400).json({ error: "Invalid or inactive payment gateway" });
//         }
//         const payment = new Payment({ userId, amount, currency, paymentMethod, paymentGateway, status: 'pending' });
//         await payment.save();

//         await PaymentLog.create({ paymentGatewayId: gateway._id, eventType: 'pending', payload: payment });

//         res.status(201).json({ message: "Payment initiated", payment });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

const getAvailablePaymentMethods = async (req, res) => {
    try {
        const { amount, currency = 'INR', country = 'IN' } = req.query;
        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        const gateways = await PaymentGateway.find({
            isActive: true,
            'supportedRegions': {
                $elemMatch: { country, currency, isActive: true }
            }
        }).sort({ priority: -1 });

        const gatewaysWithMethods = gateways.map(gateway => ({
            id: gateway._id,
            name: gateway.gateway_name,
            description: gateway.description,
            logo: gateway.logoUrl,
            paymentMethods: gateway.getActivePaymentMethods(parseFloat(amount))
        }));

        res.json({ success: true, data: gatewaysWithMethods });
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const initiatePayment = async (req, res) => {
    try {
        const { amount, gatewayId, paymentMethod } = req.body;
        const userId = req.user.id;

        const gateway = await PaymentGateway.findById(gatewayId);
        if (!gateway || !gateway.isActive) {
            return res.status(400).json({ error: 'Invalid payment gateway' });
        }

        const handler = gatewayHandlers[gateway.gatewayIdentifier];
        if (!handler) {
            return res.status(400).json({ error: 'Unsupported payment gateway' });
        }

        const result = await handler.initiatePayment({
            amount,
            paymentMethod,
            user: req.user,
            gateway,
            metadata: req.body.metadata
        });

        res.json(result);
    } catch (error) {
        console.error('Payment initiation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const handleWebhook = async (req, res) => {
    try {
        const gatewayId = req.params.gatewayId;
        const gateway = await PaymentGateway.findById(gatewayId);
        
        if (!gateway) {
            return res.status(400).json({ error: 'Invalid gateway' });
        }

        const handler = gatewayHandlers[gateway.gatewayIdentifier];
        if (!handler) {
            return res.status(400).json({ error: 'Unsupported payment gateway' });
        }

        const result = await handler.handleWebhook({
            body: req.body,
            headers: req.headers,
            gateway
        });

        res.json(result);
    } catch (error) {
        console.error('Webhook handling error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getAvailablePaymentMethods,
    initiatePayment,
    handleWebhook
};
