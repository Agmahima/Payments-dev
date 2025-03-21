module.exports = {
  // Map regions to supported gateways and their priorities
  regionMap: {
    'IN': ['razorpay', 'cashfree'], 
    'US': ['stripe'],              
    'EU': ['stripe', 'razorpay'],   
    'default': ['cashfree'] 
  },
  gateways: {
  cashfree: {
    enabled: true,
    name: 'Cashfree',
    baseUrl: 'https://api.cashfree.com/pg',
    appId: process.env.CASHFREE_APP_ID,
    secretKey: process.env.CASHFREE_SECRET_KEY,
    supportedMethods: ['card', 'upi', 'netbanking', 'wallet','other'],
    subscriptionEnabled: true,
    apiVersion: '2022-09-01'
  },
  
  razorpay: {
    enabled: true,
    name: 'Razorpay',
    
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    supportedMethods: ['card', 'upi', 'netbanking', 'wallet','other'],
    subscriptionEnabled: true
  },
  stripe: {
    enabled: false, //enable later
    name: 'Stripe',
    
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    supportedMethods: ['card'],
    subscriptionEnabled: true
  }
  }
};
