module.exports = {
  defaultGateway: process.env.DEFAULT_PAYMENT_GATEWAY || 'cashfree',
  
  cashfree: {
    baseUrl: process.env.NODE_ENV === 'production' 
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg',
    appId: process.env.CASHFREE_APP_ID,
    secretKey: process.env.CASHFREE_SECRET_KEY,
    apiVersion: '2022-09-01'
  },
  
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
  },
  
  stripe: {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  }
};
