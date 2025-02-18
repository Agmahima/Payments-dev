const express = require('express');
const router = express.Router();
const { addGateway } = require('../controllers/gatewayController');

router.post('/add', addGateway);

module.exports = router;
