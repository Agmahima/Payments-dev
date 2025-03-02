const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/auth.middleware');

// Public routes (no authentication needed)
router.post('/webhook/cashfree', paymentController.handleWebhook);

// Protected routes (require authentication)
router.post('/', authMiddleware, paymentController.createPayment);
router.get('/:paymentId', authMiddleware, paymentController.getPaymentStatus);

module.exports = router; 