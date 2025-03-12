const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// Example: If you need to protect these routes, add auth middleware
router.get('/methods', paymentController.getAvailablePaymentMethods);
router.post('/create', paymentController.createPayment);
router.get('/status/:paymentId', paymentController.getPaymentStatus);

// If you need the gatewayId, ensure your controller handles it:
router.post('/webhook/:gatewayId', paymentController.webhookHandler);
router.get('/webhook/:gatewayId',(req,res)=>{
  res.send('webhook is running fine');
});
module.exports = router;
