const cashfreeGateway = require('./cashfree');
const razorpayGateway = require('./razorpay');
const stripeGateway = require('./stripe');

/**
 * Factory function to get the appropriate payment gateway
 * @param {string} gatewayName - The name of the payment gateway
 * @returns {Object} The payment gateway interface
 */
const getPaymentGateway = (gatewayName) => {
  switch (gatewayName.toLowerCase()) {
    case 'cashfree':
      return cashfreeGateway;
    case 'razorpay':
      return razorpayGateway;
    case 'stripe':
      return stripeGateway;
    default:
      throw new Error(`Unsupported payment gateway: ${gatewayName}`);
  }
};

module.exports = { getPaymentGateway };