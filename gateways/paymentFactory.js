const cashfreeHandler = require('./cashfree');
const razorpayHandler = require('./razorpay');

class PaymentFactory {
    static getHandler(gatewayIdentifier) {
        switch (gatewayIdentifier) {
            case 'CASHFREE':
                return cashfreeHandler;
            case 'RAZORPAY':
                return razorpayHandler;
            default:
                throw new Error('Unsupported payment gateway');
        }
    }
}

module.exports = PaymentFactory;