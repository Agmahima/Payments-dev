const express = require('express');
const router = express.Router();

const subscriptionController = require('../controllers/subscriptionController');
router.post('/plan', subscriptionController.createPlan);
router.post('/create', subscriptionController.createSubscription);
router.put('/plan/:planId', subscriptionController.updatePlan);
// router.post('/verify', subscriptionController.verifySubscription);

router.get('/plans', subscriptionController.getAllPlans);
router.get('/plan/:planId', subscriptionController.getPlan);
router.get('/subscription', subscriptionController.getAllSubscriptions);
router.get('/subscription/:subscriptionId', subscriptionController.getSubscription);
router.post('/subscription/:subscriptionId/cancel', subscriptionController.cancelSubscription);
router.post('/subscription/:subscriptionId/update', subscriptionController.updateSubscription);
router.post('/webhook/:gateway', subscriptionController.handleRazorpayWebhook);




module.exports = router;

