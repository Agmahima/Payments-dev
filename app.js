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

// Raw body parser specifically for webhooks
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use('/api/subscriptions/webhook', express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Regular JSON parsing for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Process webhook raw body
app.use('/api/payments/webhook', (req, res, next) => {
  if (req.body) {
    const rawBody = req.body.toString('utf8');
    req.rawBody = rawBody;
    try {
      req.body = JSON.parse(rawBody);
    } catch (error) {
      console.error('Error parsing webhook body:', error);
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  next();
});

app.use('/api/subscriptions/webhook', 
  express.raw({ type: 'application/json' }), 
  (req, res, next) => {
    try {
      // Store raw body for signature verification
      const rawBody = req.body;
      
      // Parse body only if it's a buffer
      if (Buffer.isBuffer(rawBody)) {
        req.rawBody = rawBody;
        req.body = JSON.parse(rawBody.toString('utf8'));
        console.log('Webhook payload:', req.body);
      } else {
        console.log('Raw body type:', typeof rawBody);
        req.rawBody = rawBody;
        req.body = rawBody;
      }
      next();
    } catch (error) {
      console.error('Error parsing webhook body:', error);
      console.error('Raw body:', req.body);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
