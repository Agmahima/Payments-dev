"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRoutes = void 0;
const express_1 = require("express");
const paymentController_1 = require("../controllers/paymentController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const rawBody_1 = require("../middleware/rawBody");
const router = (0, express_1.Router)();
exports.paymentRoutes = router;
const paymentController = new paymentController_1.PaymentController();
// Health check (no auth required)
router.get('/health', paymentController.healthCheck);
// Initiate payment for booking
router.post('/initiate', auth_1.authMiddleware, validation_1.validatePaymentRequest, paymentController.initiatePayment);
// Verify payment after completion
router.post('/verify', validation_1.validatePaymentVerification, paymentController.verifyPayment);
// Get payment status by ID
router.get('/:paymentId', auth_1.authMiddleware, paymentController.getPaymentStatus);
// Get all payments for a booking
router.get('/booking/:bookingId', auth_1.authMiddleware, paymentController.getBookingPayments);
// Get user's saved payment methods (optional feature)
router.get('/methods/:userId', auth_1.authMiddleware, paymentController.getPaymentMethods);
// Webhook endpoint (no auth, raw body required)
router.post('/webhook', rawBody_1.rawBodyMiddleware, paymentController.handleWebhook);
// Initiate refund
router.post('/:paymentId/refund', auth_1.authMiddleware, paymentController.initiateRefund);
