require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { createPaymentConsumer } = require('./services/queueConsumer');
const webhookController = require('./controllers/webhookController');

const paymentRoutes = require('./routes/paymentRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const gatewayRoutes = require('./routes/gatewayRoutes');

const app = express();

app.use(express.json());
app.use('/api/payments', paymentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/gateways', gatewayRoutes);

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Webhook endpoints for payment gateways
app.post('/api/webhooks/cashfree', webhookController.handleCashfreeWebhook);

// Start SQS consumer for payment requests
const paymentConsumer = createPaymentConsumer();
paymentConsumer.start();

// Start HTTP server for webhooks
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    paymentConsumer.stop();
    await mongoose.disconnect();
    process.exit(0);
});
