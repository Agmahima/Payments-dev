const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const mongoose = require('mongoose');
const CASHFREE_API_URL = process.env.CASHFREE_BASE_URL;
const bodyParser = require('body-parser');

console.log("Cashfree Base URL:", CASHFREE_API_URL);

const paymentRoutes = require('./routes/paymentRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

const app = express();
// app.post('/api/payments/webhook/razorpay', express.raw({ type: 'application/json' }), handleRazorpayWebhook);

// Add raw body parser for webhooks
app.use('/api/payments/webhook/:gateway', express.raw({type: 'application/json'}), (req, res, next) => {
  if (req.body.length) {
    req.rawBody = req.body;
    try {
      req.body = JSON.parse(req.body);
    } catch (error) {
      console.error('Error parsing webhook body:', error);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
  }
  next();
});

// Regular JSON parser for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

const crypto = require('crypto');

app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body;  // Store the raw body for signature verification
  console.log('Webhook payload:', req.body);
  console.log('Raw body:', req.rawBody);
  next();
});

// Webhook handler route
app.post('/api/subscriptions/webhook', (req, res) => {
  try {
    // Get the signature sent by Razorpay in the headers
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody;

    if (!signature) {
      console.error("Webhook signature missing");
      return res.status(400).json({ error: "Signature missing" });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; // Your Razorpay webhook secret

    if (!webhookSecret) {
      console.error("Webhook secret missing");
      return res.status(400).json({ error: "Webhook secret missing" });
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.error("Invalid webhook signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Process the webhook event
    const { event, payload } = req.body;
    console.log(`Received Razorpay webhook:`, { event, payload });

    // Handle the event (e.g., subscription activated)
    switch (event) {
      case 'subscription.activated':
        console.log("Subscription activated:", payload);
        break;
      case 'subscription.ended':
        console.log("Subscription ended:", payload);
        break;
      // Add other cases as needed
      default:
        console.log("Unhandled event:", event);
    }

    // Respond to Razorpay to acknowledge receipt
    res.status(200).json({ received: true });

  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(400).json({ error: "Webhook processing failed" });
  }
});

// Helper function to verify the Razorpay webhook signature
const verifyWebhookSignature = (rawBody, receivedSignature, webhookSecret) => {
  try {
    // Generate HMAC-SHA256 hash using the webhook secret and raw body
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(rawBody); // Update HMAC with raw body
    const expectedSignature = hmac.digest('hex');  // Generate expected signature
    console.log('Expected signature:', expectedSignature);

    // Compare the received signature with the expected signature
    return receivedSignature === expectedSignature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // adjust for production
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-webhook-signature');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/payments', paymentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

app.get('/', (req, res) => {
  res.send('Payment Service API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong' 
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
