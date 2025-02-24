const crypto = require('crypto');
const axios = require('axios');
const Transaction = require('../models/Transaction');
const PaymentLog = require('../models/PaymentLog');

class CashfreeHandler {
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

        const orderPayload = {
            order_id: orderId,
            order_amount: amount,
            order_currency: 'INR',
            customer_details: {
                customer_id: user.id,
                customer_email: user.email,
                customer_phone: user.phone,
                customer_name: user.name
            },
            order_meta: {
                return_url: `${config.redirectUrl}?order_id={order_id}`,
                notify_url: config.webhookUrl,
                payment_methods: paymentMethod
            }
        };

        const response = await axios.post(
            `${config.apiBaseUrl}/orders`,
            orderPayload,
            {
                headers: {
                    'x-api-version': '2022-09-01',
                    'x-client-id': config.apiKey,
                    'x-client-secret': config.secretKey
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
                paymentSessionId: response.data.payment_session_id
            }
        };
    }

    async handleWebhook({ body, headers, gateway }) {
        const signature = headers['x-webhook-signature'];
        const config = gateway.config[gateway.config.mode];

        const computedSignature = crypto
            .createHmac('sha256', config.webhookSecret)
            .update(JSON.stringify(body))
            .digest('base64');

        if (computedSignature !== signature) {
            throw new Error('Invalid signature');
        }

        const transaction = await Transaction.findOne({ 
            transactionId: body.order_id 
        });

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        if (body.type === 'PAYMENT_SUCCESS_WEBHOOK') {
            transaction.status = 'success';
            transaction.gatewayPaymentId = body.data.payment.cf_payment_id;
        } else if (body.type === 'PAYMENT_FAILED_WEBHOOK') {
            transaction.status = 'failed';
            transaction.errorReason = body.data.error_details.error_description;
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

module.exports = new CashfreeHandler();