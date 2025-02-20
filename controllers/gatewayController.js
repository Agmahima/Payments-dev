const PaymentGateway = require('../models/PaymentGateway');

exports.addGateway = async (req, res) => {
    try {
        const { gateway_name, gatewayIdentifier, config, supportedCurrencies, createdBy } = req.body;

        const gateway = new PaymentGateway({
            gateway_name,
            gatewayIdentifier,
            config,
            supportedCurrencies,
            createdBy
        });

        await gateway.save();
        res.status(201).json({ message: "Payment gateway added", gateway });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
