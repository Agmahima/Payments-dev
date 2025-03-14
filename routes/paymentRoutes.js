const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

//  to protect these routes, add auth middleware
router.get('/methods', paymentController.getAvailablePaymentMethods);
router.post('/create', paymentController.createPayment);
router.get('/status/:paymentId', paymentController.getPaymentStatus);

// If you need the gatewayId, ensure your controller handles it:
router.post('/webhook/:gatewayId', paymentController.webhookHandler);
router.get('/webhook/:gatewayId',(req,res)=>{
  res.send('webhook is running fine');
});

// router.post('/create', paymentController.createPayment);

// // Payment status
// router.get('/status/:orderId', paymentController.getPaymentStatus);

// // Webhooks for different gateways
// router.post('/webhook/:gateway', paymentController.handleWebhook);

// // Payment verification (for Razorpay)
// router.post('/verify', paymentController.verifyPayment);
module.exports = router;
