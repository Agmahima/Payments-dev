import { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';
import { BookingService } from '../services/BookingService';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';


export class PaymentController {
  private paymentService: PaymentService;
  private bookingService: BookingService;

  constructor() {
    this.paymentService = new PaymentService();
    this.bookingService = new BookingService();
  }

  /**
   * Initiate payment for a travel booking
   * POST /api/payment/initiate
   */
  initiatePayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        bookingId,
        amount,
        
        currency = 'INR',
        paymentType = 'booking',
        serviceAllocation,
      } = req.body;
      // const userId = req.params.userId;
      const userId = req.user?.userId;
      console.log("userId:", userId)
      if (!userId) {
  res.status(401).json({
    success: false,
    error: 'Unauthorized: user not authenticated'
  });
  return;
}
      console.log('Initiate payment request body:', req.body);
      console.log(bookingId, userId, amount);

       const authToken = req.headers.authorization?.replace('Bearer ', '');
       console.log('Auth token in initiatePayment:', authToken);
       console.log('🔑 Authorization header:', req.headers.authorization);

           console.log('🔑 Extracted auth token:', authToken ? `${authToken.substring(0, 20)}...` : 'NONE');


      
      if (!authToken) {
        logger.warn('Payment initiation without auth token', { bookingId, userId });
        console.log('Payment initiation without auth token', { bookingId, userId });
      }

      logger.info('Initiating payment', { bookingId, userId, hasAuthToken: !!authToken });
      console.log('Initiating payment', { bookingId, userId,  hasAuthToken: !!authToken });

      


      // Validate booking exists and get details
      const bookingResponse = await this.bookingService.getBookingDetails(bookingId, authToken);
      if (!bookingResponse) {
        res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
        return;
      }

      const booking = bookingResponse.booking;
      // const payableAmount = booking.pricing.totalAmount;
      // console.log("Payable amount :", payableAmount)

     console.log('💰 Amount from request:', amount, typeof amount);
 console.log('💰 Amount from booking:', booking.pricing.totalAmount, typeof booking.pricing.totalAmount);
 console.log('💰 Are they equal?', amount === booking.pricing.totalAmount);
 console.log('💰 Strict equality:', amount, '===', booking.pricing.totalAmount);


      // Validate amount matches booking total
      if (amount !== booking.pricing.totalAmount) {
        res.status(400).json({
          success: false,
          error: 'Payment amount does not match booking total'
        });
        return;
      }

      const result = await this.paymentService.initiatePayment({
        bookingId,
        userId,
        amount,
        currency,
        paymentType,
        serviceAllocation,
      },
      
        
      );
      console.log('Payment initiation result:', result);
       logger.info('Payment initiated successfully', { 
        bookingId, 
        razorpayOrderId: result.razorpayOrder?.id 
      });

      res.status(201).json(result);
    } catch (error) {
      logger.error('Initiate payment error', { 
        error: (error as Error).message, 
        body: req.body 
      });
      
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  };

  /**
   * Verify payment after successful payment
   * POST /api/payment/verify
   */
  verifyPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature,bookingId } = req.body;
      console.log( "verified payments :",req.body);

      const authToken = req.headers.authorization?.replace('Bearer ', '');

      if(!authToken){
        console.log('No auth token provided in verifyPayment');
      }

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400).json({
          success: false,
          error: 'Missing required payment verification parameters'
        });
        return;
      }

      const result = await this.paymentService.verifyPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        bookingId

      }, authToken);
      console.log("payment verified results :", result)

      res.json(result);
    } catch (error) {
      logger.error('Payment verification error', { 
        error: (error as Error).message, 
        body: req.body 
      });
      
      res.status(400).json({
        success: false,
        error: (error as Error).message
      });
    }
  };

  /**
   * Get payment status
   * GET /api/payment/:paymentId
   */
  getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { paymentId } = req.params;

      if (!Types.ObjectId.isValid(paymentId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid payment ID format'
        });
        return;
      }

      const result = await this.paymentService.getPaymentStatus(paymentId);
      res.json(result);
    } catch (error) {
      logger.error('Get payment status error', { 
        error: (error as Error).message, 
        paymentId: req.params.paymentId 
      });
      
      res.status(404).json({
        success: false,
        error: (error as Error).message
      });
    }
  };

  /**
   * Get payments for a booking
   * GET /api/payment/booking/:bookingId
   */
  getBookingPayments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { bookingId } = req.params;

      if (!Types.ObjectId.isValid(bookingId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid booking ID format'
        });
        return;
      }

      const payments = await this.paymentService.getBookingPayments(bookingId);
      
      res.json({
        success: true,
        payments
      });
    } catch (error) {
      logger.error('Get booking payments error', { 
        error: (error as Error).message, 
        bookingId: req.params.bookingId 
      });
      
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  };

  /**
   * Handle webhook from Razorpay
   * POST /api/payment/webhook
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      
      if (!signature && process.env.NODE_ENV === 'production') {
        logger.error('Webhook signature missing in production');
        res.status(400).json({
          success: false,
          error: 'Webhook signature missing'
        });
        return;
      }

      await this.paymentService.handleWebhook(req.body, signature);
      
      // Always return 200 to prevent retries
      res.status(200).json({ 
        success: true,
        message: 'Webhook processed successfully'
      });
    } catch (error) {
      logger.error('Webhook handling error', { 
        error: (error as Error).message,
        event: req.body.event 
      });
      
      // Still return 200 to prevent retries from Razorpay
      res.status(200).json({
        success: false,
        error: (error as Error).message,
        message: 'Webhook received but processing failed'
      });
    }
  };

  /**
   * Initiate refund for a payment
   * POST /api/payment/:paymentId/refund
   */
  initiateRefund = async (req: Request, res: Response): Promise<void> => {
    try {
      const { paymentId } = req.params;
      const { amount, reason = 'Customer request' } = req.body;

      if (!Types.ObjectId.isValid(paymentId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid payment ID format'
        });
        return;
      }

      const result = await this.paymentService.initiateRefund(paymentId, amount);
      res.json(result);
    } catch (error) {
      logger.error('Refund initiation error', { 
        error: (error as Error).message, 
        paymentId: req.params.paymentId 
      });
      
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  };

  /**
   * Get available payment methods for user (optional feature)
   * GET /api/payment/methods/:userId
   */
  getPaymentMethods = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!Types.ObjectId.isValid(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID format'
        });
        return;
      }

      // For now, return empty array - can be enhanced later if needed
      res.json({
        success: true,
        methods: []
      });
    } catch (error) {
      logger.error('Get payment methods error', { 
        error: (error as Error).message, 
        userId: req.params.userId 
      });
      
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  };

  /**
   * Health check endpoint
   * GET /api/payment/health
   */
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const bookingServiceHealthy = await this.bookingService.healthCheck();
      
      res.json({
        success: true,
        service: 'payment-service',
        status: bookingServiceHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        dependencies: {
          booking_service: bookingServiceHealthy ? 'healthy' : 'unhealthy'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  };
}