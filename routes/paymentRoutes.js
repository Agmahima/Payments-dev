const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');
//  to protect these routes, add auth middleware
// router.get('/methods', paymentController.getAvailablePaymentMethods);
// router.post('/create', paymentController.createPayment);
// router.get('/status/:paymentId', paymentController.getPaymentStatus);
// router.post('/webhook/:gatewayId', paymentController.webhookHandler);
// router.get('/webhook/:gatewayId',(req,res)=>{
//   res.send('webhook is running fine');
// });
// router.post('/create', paymentController.createPayment);
router.post('/create',paymentController.createInvestmentPayment);
// Payment status
router.get('/status/:orderId', paymentController.getPaymentStatus);
// // Webhooks for different gateways
// router.post('/webhook/:gateway', paymentController.handleWebhook);
router.post(
    '/webhook/razorpay',
    express.raw({ type: 'application/json' }), 
    paymentController.processRazorpayWebhook
  );
  
// Payment verification (for Razorpay)
router.post('/verify', paymentController.verifyPayment);
// router.get('/subscriptions', paymentController.getUserSubscriptions);
// router.post('/subscription/:subscriptionId/cancel',
//   paymentController.cancelSubscription
// );
module.exports = router;