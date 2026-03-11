"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const PaymentService_1 = require("../services/PaymentService");
const BookingService_1 = require("../services/BookingService");
const logger_1 = require("../utils/logger");
const mongoose_1 = require("mongoose");
class PaymentController {
    constructor() {
        /**
         * Initiate payment for a travel booking
         * POST /api/payment/initiate
         */
        this.initiatePayment = async (req, res) => {
            var _a, _b, _c;
            try {
                const { bookingId, amount, currency = 'INR', paymentType = 'booking', serviceAllocation, } = req.body;
                // const userId = req.params.userId;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
                console.log("userId:", userId);
                if (!userId) {
                    res.status(401).json({
                        success: false,
                        error: 'Unauthorized: user not authenticated'
                    });
                    return;
                }
                console.log('Initiate payment request body:', req.body);
                console.log(bookingId, userId, amount);
                const authToken = (_b = req.headers.authorization) === null || _b === void 0 ? void 0 : _b.replace('Bearer ', '');
                console.log('Auth token in initiatePayment:', authToken);
                console.log('🔑 Authorization header:', req.headers.authorization);
                console.log('🔑 Extracted auth token:', authToken ? `${authToken.substring(0, 20)}...` : 'NONE');
                if (!authToken) {
                    logger_1.logger.warn('Payment initiation without auth token', { bookingId, userId });
                    console.log('Payment initiation without auth token', { bookingId, userId });
                }
                logger_1.logger.info('Initiating payment', { bookingId, userId, hasAuthToken: !!authToken });
                console.log('Initiating payment', { bookingId, userId, hasAuthToken: !!authToken });
                // Validate booking exists and get details
                const bookingResponse = await this.bookingService.getBookingDetails(bookingId, authToken);
                if (!bookingResponse) {
                    res.status(404).json({
                        success: false,
                        error: 'Booking not found'
                    });
                    return;
                }
                console.log("Booking details from booking service:", bookingResponse);
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
                });
                console.log('Payment initiation result:', result);
                logger_1.logger.info('Payment initiated successfully', {
                    bookingId,
                    razorpayOrderId: (_c = result.razorpayOrder) === null || _c === void 0 ? void 0 : _c.id
                });
                res.status(201).json(result);
            }
            catch (error) {
                logger_1.logger.error('Initiate payment error', {
                    error: error.message,
                    body: req.body
                });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        };
        /**
         * Verify payment after successful payment
         * POST /api/payment/verify
         */
        this.verifyPayment = async (req, res) => {
            var _a;
            try {
                const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;
                console.log("verified payments :", req.body);
                const authToken = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
                if (!authToken) {
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
                console.log("payment verified results :", result);
                res.json(result);
            }
            catch (error) {
                logger_1.logger.error('Payment verification error', {
                    error: error.message,
                    body: req.body
                });
                res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
        };
        /**
         * Get payment status
         * GET /api/payment/:paymentId
         */
        this.getPaymentStatus = async (req, res) => {
            try {
                const { paymentId } = req.params;
                if (!mongoose_1.Types.ObjectId.isValid(paymentId)) {
                    res.status(400).json({
                        success: false,
                        error: 'Invalid payment ID format'
                    });
                    return;
                }
                const result = await this.paymentService.getPaymentStatus(paymentId);
                res.json(result);
            }
            catch (error) {
                logger_1.logger.error('Get payment status error', {
                    error: error.message,
                    paymentId: req.params.paymentId
                });
                res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
        };
        /**
         * Get payments for a booking
         * GET /api/payment/booking/:bookingId
         */
        this.getBookingPayments = async (req, res) => {
            try {
                const { bookingId } = req.params;
                if (!mongoose_1.Types.ObjectId.isValid(bookingId)) {
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
            }
            catch (error) {
                logger_1.logger.error('Get booking payments error', {
                    error: error.message,
                    bookingId: req.params.bookingId
                });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        };
        /**
         * Handle webhook from Razorpay
         * POST /api/payment/webhook
         */
        this.handleWebhook = async (req, res) => {
            try {
                const signature = req.headers['x-razorpay-signature'];
                if (!signature && process.env.NODE_ENV === 'production') {
                    logger_1.logger.error('Webhook signature missing in production');
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
            }
            catch (error) {
                logger_1.logger.error('Webhook handling error', {
                    error: error.message,
                    event: req.body.event
                });
                // Still return 200 to prevent retries from Razorpay
                res.status(200).json({
                    success: false,
                    error: error.message,
                    message: 'Webhook received but processing failed'
                });
            }
        };
        /**
         * Initiate refund for a payment
         * POST /api/payment/:paymentId/refund
         */
        this.initiateRefund = async (req, res) => {
            try {
                const { paymentId } = req.params;
                const { amount, reason = 'Customer request' } = req.body;
                if (!mongoose_1.Types.ObjectId.isValid(paymentId)) {
                    res.status(400).json({
                        success: false,
                        error: 'Invalid payment ID format'
                    });
                    return;
                }
                const result = await this.paymentService.initiateRefund(paymentId, amount);
                res.json(result);
            }
            catch (error) {
                logger_1.logger.error('Refund initiation error', {
                    error: error.message,
                    paymentId: req.params.paymentId
                });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        };
        /**
         * GET /api/payment/methods/:userId
         */
        this.getPaymentMethods = async (req, res) => {
            try {
                const { userId } = req.params;
                if (!mongoose_1.Types.ObjectId.isValid(userId)) {
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
            }
            catch (error) {
                logger_1.logger.error('Get payment methods error', {
                    error: error.message,
                    userId: req.params.userId
                });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        };
        /**
         * Health check endpoint
         * GET /api/payment/health
         */
        this.healthCheck = async (req, res) => {
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
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: 'Health check failed'
                });
            }
        };
        this.paymentService = new PaymentService_1.PaymentService();
        this.bookingService = new BookingService_1.BookingService();
    }
}
exports.PaymentController = PaymentController;
