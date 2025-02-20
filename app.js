require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');

const paymentRoutes = require('./routes/paymentRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const gatewayRoutes = require('./routes/gatewayRoutes');

const app = express();
connectDB();

app.use(express.json());

app.use('/api/payments', paymentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/gateways', gatewayRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
