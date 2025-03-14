// filepath: /Users/priyanshu/Desktop/POD/payments/gateways/paymentFactory.js
const cashfreeHandler = require('./cashfree');
const razorpayHandler = require('./razorpay');
const stripeHandler = require('./stripe');

class PaymentFactory {
    static getHandler(gatewayIdentifier) {
        switch (gatewayIdentifier) {
            case 'CASHFREE':
                return cashfreeHandler;
            case 'RAZORPAY':
                return razorpayHandler;
            case 'STRIPE':
                return stripeHandler;
            default:
                throw new Error('Unsupported payment gateway');
        }
    }
}

module.exports = PaymentFactory;