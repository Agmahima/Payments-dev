const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

router.get('/methods', paymentController.getAvailablePaymentMethods);
router.post('/initiate', paymentController.initiatePayment);
router.post('/webhook/:gatewayId', paymentController.handleWebhook);
//router.get('/status/:transactionId', auth, paymentController.getTransactionStatus);

module.exports = router;
