// ## 6. Fixed Razorpay Service (src/services/RazorpayService.ts)
// ```typescript
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { RazorpayOrderData, PaymentVerificationData } from '../types/payment.types';
import { logger } from '../utils/logger';

export class RazorpayService {
  private razorpay: Razorpay;
  
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  async createOrder(orderData: RazorpayOrderData): Promise<any> {
    try {
      const amountInPaise = Math.round(orderData.amount * 100);
      console.log('💰 Razorpay Order Creation:', {
      inputAmountInRupees: orderData.amount,
      convertedAmountInPaise: amountInPaise,
      calculation: `${orderData.amount} × 100 = ${amountInPaise}`
    });

      const options = {
        amount: Math.round(orderData.amount * 100), // Convert to paise and ensure integer
        currency: orderData.currency,
receipt: `rcpt_${orderData.orderId}`.slice(0, 40),
        notes: {
          bookingId: orderData.orderId,
          customerId: orderData.customerId || '',
          description: orderData.description || '',
          ...orderData.metadata
        }
      };

      const order = await this.razorpay.orders.create(options);
      console.log('Razorpay order created:', order);
      logger.info('Razorpay order created', { orderId: order.id, amount: order.amount });
      return order;
    } catch (error) {
      logger.error('Razorpay order creation failed', error);
      console.log('Razorpay order creation error:', error);
      throw new Error(`Razorpay order creation failed: ${(error as Error).message}`);
    }
  }

  verifyPayment(verificationData: PaymentVerificationData): boolean {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verificationData;
      
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(body.toString())
        .digest('hex');

      const isValid = expectedSignature === razorpay_signature;
      logger.info('Payment signature verification', { 
        isValid, 
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id 
      });
      return isValid;
    } catch (error) {
      logger.error('Payment verification failed', error);
      return false;
    }
  }

  async fetchPaymentDetails(paymentId: string): Promise<any> {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      logger.info('Payment details fetched', { paymentId });
      return payment;
    } catch (error) {
      logger.error('Failed to fetch payment details', { paymentId, error });
      throw new Error(`Failed to fetch payment details: ${(error as Error).message}`);
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.error('Webhook secret not configured');
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');
      
      const isValid = expectedSignature === signature;
      logger.info('Webhook signature verification', { isValid });
      return isValid;
    } catch (error) {
      logger.error('Webhook signature verification failed', error);
      return false;
    }
  }

  async initiateRefund(paymentId: string, amount: number, reason?: string): Promise<any> {
    try {
      const refundData: any = {
        amount: Math.round(amount * 100), // Convert to paise
        speed: 'normal'
      };

      if (reason) {
        refundData.notes = { reason };
      }

      const refund = await this.razorpay.payments.refund(paymentId, refundData);
      logger.info('Refund initiated', { 
        paymentId, 
        refundId: refund.id, 
        amount: refund.amount 
      });
      return refund;
    } catch (error) {
      logger.error('Refund initiation failed', { paymentId, amount, error });
      throw new Error(`Refund initiation failed: ${(error as Error).message}`);
    }
  }
}