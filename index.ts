import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { baseDbConnection } from './dbConnections';

// import paymentRoutes from './routes/paymentRoutes';
import { paymentRoutes } from './routes/PaymentRoutes';



const CASHFREE_API_URL = process.env.CASHFREE_BASE_URL;
console.log("Cashfree Base URL:", CASHFREE_API_URL);

const app = express();

// Webhook raw body parser
app.use('/api/payments/webhook/:gateway', express.raw({ type: 'application/json' }), (req, res, next) => {
  if (req.body.length) {
    (req as any).rawBody = req.body;
    try {
      req.body = JSON.parse(req.body.toString());
    } catch (error) {
      console.error('Error parsing webhook body:', error);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
  }
  next();
});

// Regular parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(bodyParser.json({
  verify: (req: Request, res: Response, buf: Buffer) => {
    (req as any).rawBody = buf.toString();
  }
}));

// Webhook verification function
function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string,
  webhookSecret: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(rawBody);
    const expectedSignature = hmac.digest('hex');
    return receivedSignature === expectedSignature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

// Webhook route
app.post('/api/subscriptions/webhook', (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = (req as any).rawBody;

    if (!signature) return res.status(400).json({ error: "Signature missing" });

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(400).json({ error: "Webhook secret missing" });

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const { event, payload } = req.body;
    console.log(`Received webhook:`, { event, payload });
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(400).json({ error: "Webhook processing failed" });
  }
});

// CORS setup
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-webhook-signature');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Routes
app.use('/api/payment', paymentRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Payment Service API is running');
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
