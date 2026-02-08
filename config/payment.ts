import { PaymentConfig } from '../types/payment.types';

export const paymentConfig: PaymentConfig = {
  regionMap: {
    'IN': ['razorpay'],
    'US': ['stripe'],
    'EU': ['stripe', 'razorpay'],
    'default': ['razorpay']
  },
  
  gateways: {
    razorpay: {
      enabled: true,
      name: 'Razorpay',
      keyId: process.env.RAZORPAY_KEY_ID!,
      keySecret: process.env.RAZORPAY_KEY_SECRET!,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET!,
      supportedMethods: ['card', 'upi', 'netbanking', 'wallet'],
      subscriptionEnabled: false // Not needed for travel bookings
    },
    
    stripe: {
      enabled: false,
      name: 'Stripe',
      keyId: process.env.STRIPE_PUBLISHABLE_KEY!,
      keySecret: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      supportedMethods: ['card'],
      subscriptionEnabled: false
    }
  }
}