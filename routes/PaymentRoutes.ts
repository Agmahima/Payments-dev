import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { authMiddleware } from '../middleware/auth';
import { validatePaymentRequest, validatePaymentVerification } from '../middleware/validation';
import { rawBodyMiddleware } from '../middleware/rawBody';

const router = Router();
const paymentController = new PaymentController();

// Health check (no auth required)
router.get('/health', paymentController.healthCheck);

// Initiate payment for booking
router.post('/initiate', 
  authMiddleware,
  validatePaymentRequest, 
  paymentController.initiatePayment
);

// Verify payment after completion
router.post('/verify', 
  validatePaymentVerification, 
  paymentController.verifyPayment
);

// Get payment status by ID
router.get('/:paymentId', 
  authMiddleware, 
  paymentController.getPaymentStatus
);

// Get all payments for a booking
router.get('/booking/:bookingId', 
  authMiddleware, 
  paymentController.getBookingPayments
);

// Get user's saved payment methods (optional feature)
router.get('/methods/:userId', 
  authMiddleware, 
  paymentController.getPaymentMethods
);

// Webhook endpoint (no auth, raw body required)
router.post('/webhook', 
  rawBodyMiddleware,
  paymentController.handleWebhook
);

// Initiate refund
router.post('/:paymentId/refund', 
  authMiddleware, 
  paymentController.initiateRefund
);

export { router as paymentRoutes };