const crypto = require('crypto');
const axios = require('axios');
const Transaction = require('../models/Transaction');
const PaymentLog = require('../models/PaymentLog');

class RazorpayHandler {
    async initiatePayment({ amount, paymentMethod, user, gateway, metadata }) {
        const config = gateway.config[gateway.config.mode];
        const orderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const transaction = new Transaction({
            transactionId: orderId,
            userId: user.id,
            paymentGatewayId: gateway._id,
            amount,
            currency: 'INR',
            paymentMethod,
            metadata
        });
        await transaction.save();

        const response = await axios.post(
            `${config.apiBaseUrl}/orders`,
            {
                amount: amount * 100, // Razorpay expects amount in paise
                currency: 'INR',
                receipt: orderId,
                notes: {
                    userId: user.id,
                    paymentMethod
                }
            },
            {
                auth: {
                    username: config.apiKey,
                    password: config.secretKey
                }
            }
        );

        await PaymentLog.create({
            paymentGatewayId: gateway._id,
            transactionId: transaction._id,
            eventType: 'initiated',
            payload: response.data,
            createdBy: user.id
        });

        return {
            success: true,
            data: {
                orderId,
                razorpayOrderId: response.data.id,
                amount: response.data.amount,
                currency: response.data.currency
            }
        };
    }

    async handleWebhook({ body, headers, gateway }) {
        const signature = headers['x-razorpay-signature'];
        const config = gateway.config[gateway.config.mode];

        const shasum = crypto.createHmac('sha256', config.webhookSecret);
        shasum.update(JSON.stringify(body));
        const computedSignature = shasum.digest('hex');

        if (computedSignature !== signature) {
            throw new Error('Invalid signature');
        }

        const transaction = await Transaction.findOne({ 
            transactionId: body.payload.payment.entity.receipt 
        });

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        if (body.event === 'payment.captured') {
            transaction.status = 'success';
            transaction.gatewayPaymentId = body.payload.payment.entity.id;
        } else if (body.event === 'payment.failed') {
            transaction.status = 'failed';
            transaction.errorReason = body.payload.payment.entity.error_description;
        }

        await transaction.save();

        await PaymentLog.create({
            paymentGatewayId: gateway._id,
            transactionId: transaction._id,
            eventType: transaction.status,
            payload: body,
            createdBy: 'system'
        });

        return { success: true };
    }
}

module.exports = new RazorpayHandler();