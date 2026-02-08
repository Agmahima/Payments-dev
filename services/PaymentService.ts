import { Types } from 'mongoose';
import { Payment } from '../models/Payment';
import { RazorpayService } from './razorpay';
import { BookingService } from './BookingService';
import { PaymentRequestData, PaymentVerificationData } from '../types/payment.types';
import { logger } from '../utils/logger';

export class PaymentService {
  private razorpayService: RazorpayService;
  private bookingService: BookingService;

  constructor() {
    this.razorpayService = new RazorpayService();
    this.bookingService = new BookingService();
  }

  async initiatePayment(paymentData: PaymentRequestData): Promise<any> {
    try {
      // Validate booking exists
      // const booking = await this.bookingService.getBookingDetails(paymentData.bookingId, authToken);
      // if (!booking) {
      //   throw new Error('Booking not found');
      // }

      // Create payment record
      const payment = new Payment({
        bookingId: new Types.ObjectId(paymentData.bookingId),
        userId: new Types.ObjectId(paymentData.userId),
        paymentType: paymentData.paymentType || 'booking',
        serviceAllocation: paymentData.serviceAllocation || [],
        transactionRef: '', // Will be updated after Razorpay order creation
        paymentGateway: 'razorpay',
        amount: paymentData.amount,
        currency: paymentData.currency || 'INR',
        status: 'pending'
      });

      await payment.save();

      // Create Razorpay order
      const razorpayOrder = await this.razorpayService.createOrder({
        orderId: payment._id.toString(),
        amount: paymentData.amount,
        currency: paymentData.currency || 'INR',
        customerId: paymentData.userId,
        metadata: paymentData.metadata
      });

       console.log("Razorpay order data:",razorpayOrder)

      // Update payment with Razorpay order details
      payment.transactionRef = razorpayOrder.id;
      payment.gatewayResponse = { raw: razorpayOrder };
      await payment.save();

      return {
        success: true,
        payment: {
          id: payment._id,
          razorpayOrderId: razorpayOrder.id,
          amount: paymentData.amount,
          currency: razorpayOrder.currency,
          key: process.env.RAZORPAY_KEY_ID
        }
      };
    } catch (error) {
      logger.error('Payment initiation failed', { error, paymentData });
      throw error;
    }
  }

  async verifyPayment(verificationData: PaymentVerificationData,authToken?:string): Promise<any> {
    try {
      const { razorpay_order_id, razorpay_payment_id } = verificationData;

      // Find payment by Razorpay order ID
      const payment = await Payment.findOne({ transactionRef: razorpay_order_id });
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Verify signature
      const isValid = this.razorpayService.verifyPayment(verificationData);
      if (!isValid) {
        payment.status = 'failed';
        payment.gatewayResponse.failureReason = 'Invalid signature';
        await payment.save();
        throw new Error('Payment verification failed');
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await this.razorpayService.fetchPaymentDetails(razorpay_payment_id);

      // Update payment record
      payment.status = 'paid';
      payment.completedAt = new Date();
      payment.paymentMethod = paymentDetails.method;
      payment.gatewayResponse = { 
        ...payment.gatewayResponse, 
        raw: paymentDetails 
      };

      await payment.save();

      // Update booking service
      await this.bookingService.updatePaymentStatus(payment.bookingId.toString(), {
        paymentStatus: 'paid',
        totalPaid: payment.amount,
        paymentId: payment._id.toString()
      },authToken);

      return {
        success: true,
        message: 'Payment verified successfully',
        payment: {
          id: payment._id,
          status: payment.status,
          amount: payment.amount,
          completedAt: payment.completedAt
        }
      };
    } catch (error) {
      logger.error('Payment verification failed', { error, verificationData });
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<any> {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      return {
        success: true,
        payment: {
          id: payment._id,
          bookingId: payment.bookingId,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          paymentGateway: payment.paymentGateway,
          initiatedAt: payment.initiatedAt,
          completedAt: payment.completedAt
        }
      };
    } catch (error) {
      logger.error('Get payment status failed', { error, paymentId });
      throw error;
    }
  }

  async handleWebhook(payload: any, signature: string): Promise<any> {
    try {
      // Verify webhook signature
      const isValid = this.razorpayService.verifyWebhookSignature(
        JSON.stringify(payload), 
        signature
      );

      if (!isValid && process.env.NODE_ENV === 'production') {
        throw new Error('Invalid webhook signature');
      }

      const event = payload.event;
      logger.info('Webhook received', { event });

      switch (event) {
        case 'order.paid':
          await this.handleOrderPaid(payload.payload);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(payload.payload);
          break;
        default:
          logger.info(`Unhandled webhook event: ${event}`);
      }

      return { success: true };
    } catch (error) {
      logger.error('Webhook handling failed', { error, payload });
      throw error;
    }
  }

  private async handleOrderPaid(payload: any): Promise<void> {
    try {
      const order = payload.order.entity;
      const paymentEntity = payload.payment?.entity;

      const payment = await Payment.findOne({ transactionRef: order.id });
      if (!payment) {
        logger.error('Payment not found for webhook', { orderId: order.id });
        return;
      }

      if (payment.status !== 'paid') {
        payment.status = 'paid';
        payment.completedAt = new Date();
        if (paymentEntity) {
          payment.paymentMethod = paymentEntity.method;
        }
        await payment.save();

        // Update booking service
        await this.bookingService.updatePaymentStatus(payment.bookingId.toString(), {
          paymentStatus: 'paid',
          totalPaid: payment.amount,
          paymentId: payment._id.toString()
        });

        logger.info('Payment status updated via webhook', { paymentId: payment._id });
      }
    } catch (error) {
      logger.error('Handle order paid webhook failed', { error, payload });
    }
  }

  private async handlePaymentFailed(payload: any): Promise<void> {
    try {
      const paymentEntity = payload.payment.entity;
      
      const payment = await Payment.findOne({ transactionRef: paymentEntity.order_id });
      if (!payment) {
        logger.error('Payment not found for failed webhook', { orderId: paymentEntity.order_id });
        return;
      }

      payment.status = 'failed';
      payment.gatewayResponse.failureReason = paymentEntity.error_description;
      await payment.save();

      logger.info('Payment marked as failed via webhook', { paymentId: payment._id });
    } catch (error) {
      logger.error('Handle payment failed webhook failed', { error, payload });
    }
  }

  async initiateRefund(paymentId: string, amount?: number): Promise<any> {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'paid') {
        throw new Error('Can only refund paid payments');
      }

      const refundAmount = amount || payment.amount;
      const refund = await this.razorpayService.initiateRefund(
        payment.transactionRef, 
        refundAmount
      );

      // Update payment record
      payment.refundDetails = {
        refundId: refund.id,
        refundAmount,
        refundReason: 'Customer request',
        refundDate: new Date(),
        refundStatus: 'pending'
      };

      if (refundAmount === payment.amount) {
        payment.status = 'refunded';
      }

      await payment.save();

      return {
        success: true,
        refund: {
          id: refund.id,
          amount: refundAmount,
          status: refund.status
        }
      };
    } catch (error) {
      logger.error('Refund initiation failed', { error, paymentId, amount });
      throw error;
    }
  }

  async getBookingPayments(bookingId: string): Promise<any> {
    try {
      const payments = await Payment.find({ bookingId: new Types.ObjectId(bookingId) });

      return {
        success: true,
        payments: payments.map(payment => ({
          id: payment._id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          paymentType: payment.paymentType,
          initiatedAt: payment.initiatedAt,
          completedAt: payment.completedAt,
          refundDetails: payment.refundDetails || null
        }))
      };
    } catch (error) {
      logger.error('Get booking payments failed', { error, bookingId });
      throw error;
    }
  }
}