const express = require('express');
const router = express.Router();
const { createSubscription } = require('../controllers/subscriptionController');

router.post('/create', createSubscription);

module.exports = router;

