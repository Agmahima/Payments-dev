"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const crypto_1 = __importDefault(require("crypto"));
// import paymentRoutes from './routes/paymentRoutes';
const PaymentRoutes_1 = require("./routes/PaymentRoutes");
const CASHFREE_API_URL = process.env.CASHFREE_BASE_URL;
console.log("Cashfree Base URL:", CASHFREE_API_URL);
const app = (0, express_1.default)();
// Webhook raw body parser
app.use('/api/payments/webhook/:gateway', express_1.default.raw({ type: 'application/json' }), (req, res, next) => {
    if (req.body.length) {
        req.rawBody = req.body;
        try {
            req.body = JSON.parse(req.body.toString());
        }
        catch (error) {
            console.error('Error parsing webhook body:', error);
            return res.status(400).json({ error: 'Invalid JSON payload' });
        }
    }
    next();
});
// Regular parsers
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(body_parser_1.default.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));
// Webhook verification function
function verifyWebhookSignature(rawBody, receivedSignature, webhookSecret) {
    try {
        const hmac = crypto_1.default.createHmac('sha256', webhookSecret);
        hmac.update(rawBody);
        const expectedSignature = hmac.digest('hex');
        return receivedSignature === expectedSignature;
    }
    catch (error) {
        console.error('Error verifying webhook signature:', error);
        return false;
    }
}
// Webhook route
app.post('/api/subscriptions/webhook', (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const rawBody = req.rawBody;
        if (!signature)
            return res.status(400).json({ error: "Signature missing" });
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret)
            return res.status(400).json({ error: "Webhook secret missing" });
        if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
            return res.status(400).json({ error: "Invalid signature" });
        }
        const { event, payload } = req.body;
        console.log(`Received webhook:`, { event, payload });
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error("Error processing webhook:", error);
        res.status(400).json({ error: "Webhook processing failed" });
    }
});
// CORS setup
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-webhook-signature');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS')
        return res.sendStatus(200);
    next();
});
// Routes
app.use('/api/payment', PaymentRoutes_1.paymentRoutes);
app.get('/', (req, res) => {
    res.send('Payment Service API is running');
});
// Error handler
app.use((err, req, res, next) => {
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
exports.default = app;
