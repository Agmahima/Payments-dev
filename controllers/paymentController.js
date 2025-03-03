
const { cashfreeHandler } = require('../gateways/cashfree');

const mongoose = require('mongoose');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');

const gatewayHandlers = {
    'CASHFREE': cashfreeHandler,
};

const getAvailablePaymentMethods = async (req, res) => {
    try {
        const { amount, currency = 'INR', country = 'IN' } = req.query;
        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        const gateways = await PaymentGateway.find({
            isActive: true,
            'supportedRegions': {
                $elemMatch: { country, currency, isActive: true }
            }
        }).sort({ priority: -1 });

        const gatewaysWithMethods = gateways.map(gateway => ({
            id: gateway._id,
            name: gateway.gateway_name,
            description: gateway.description,
            logo: gateway.logoUrl,
            paymentMethods: gateway.getActivePaymentMethods(parseFloat(amount))
        }));

        res.json({ success: true, data: gatewaysWithMethods });
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const initiatePayment = async (req, res) => {
    try {
        const { amount, paymentMethod } = req.body;
        //const userId = req.body.user.id;

        // const gateway = await PaymentGateway.findById(gatewayId);
        // if (!gateway || !gateway.isActive) {
        //     return res.status(400).json({ error: 'Invalid payment gateway' });
        // }

        const handler = gatewayHandlers["CASHFREE"];
        if (!handler) {
            return res.status(400).json({ error: 'Unsupported payment gateway' });
        }

        const result = await handler.initiatePayment({
            amount,
            paymentMethod,
            user: "65f123456789abcdef123456",
            gateway: "CASHFREE",
            metadata: req.body.metadata
        });

        res.json(result);
    } catch (error) {
        console.error('Payment initiation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const handleWebhook = (req, res) => {
    return handleCashfreeWebhook(req, res);
};

const generateOrderId = () => {
    return `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

const createPayment = async (req, res) => {
    try {
        const {
            payment_purpose,
            payment_amount,
            payment_currency = 'INR',
            payee_ref,
            payee_type,
            receiver_ref,
            receiver_type,
            payee_location = 'IN',
            customer_name,
            customer_email,
            customer_phone,
            description
        } = req.body;

        const userId = "65f123456789abcdef123456";
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        if (!payment_purpose || !payment_amount || !payee_ref || !payee_type || 
            !receiver_ref || !receiver_type || !customer_email || !customer_phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }

        const orderId = generateOrderId();
        
        const payment = new Payment({
            request_ref: orderId,
            payment_purpose,
            payment_amount,
            payment_currency,
            payee_ref: mongoose.Types.ObjectId(payee_ref),
            payee_type,
            receiver_ref: mongoose.Types.ObjectId(receiver_ref),
            receiver_type,
            payee_location,
            payment_gateway: 'CASHFREE',
            payment_status: 'PENDING',
            created_by: mongoose.Types.ObjectId(userId),
            updated_by: mongoose.Types.ObjectId(userId)
        });

        await payment.save();

        const result = await cashfreeHandler.initiatePayment({
            amount: payment_amount,
            orderId: payment._id.toString(),
            currency: payment_currency,
            customerDetails: {
                id: "65f123456789abcdef123456",
                name: customer_name || 'Customer',
                email: customer_email,
                phone: customer_phone
            },
            purpose: description || `Payment for ${payment_purpose}`
        });

        if (!result.success) {
            await Payment.findByIdAndUpdate(payment._id, {
                payment_status: 'FAILED',
                updated_by: mongoose.Types.ObjectId(userId)
            });
            
            return res.status(400).json({
                success: false,
                message: result.error || 'Payment initiation failed',
                error: result.gatewayResponse
            });
        }

        const transaction = new Transaction({
            transaction_mode: 'UPI',
            payment_id: payment._id,
            gateway_used: 'CASHFREE',
            gateway_response: result.gatewayResponse,
            created_by: mongoose.Types.ObjectId(userId),
            updated_by: mongoose.Types.ObjectId(userId)
        });

        await transaction.save();

        await Payment.findByIdAndUpdate(payment._id, {
            transaction: transaction._id,
            updated_by: mongoose.Types.ObjectId(userId)
        });

        return res.status(200).json({
            success: true,
            payment_id: payment._id,
            order_id: orderId,
            payment_session_id: result.paymentSessionId,
            payment_link: result.paymentLink
        });
    } catch (error) {
        console.error('Payment creation error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const handleCashfreeWebhook = async (req, res) => {
    try {
        const signature = req.header('x-webhook-signature');
        
        if (!cashfreeHandler.verifyWebhookSignature(req.body, signature)) {
            console.error('Invalid webhook signature');
            return res.status(200).json({ success: false, message: 'Invalid signature' });
        }
        
        const { orderId, status, transactionDetails } = cashfreeHandler.processWebhookData(req.body);
        
        const payment = await Payment.findById(orderId);
        if (!payment) {
            console.error('Payment not found for order ID:', orderId);
            return res.status(200).json({ success: false, message: 'Payment not found' });
        }
        
        payment.payment_status = status;
        payment.updated_by = payment.created_by;
        await payment.save();
        
        if (payment.transaction) {
            await Transaction.findByIdAndUpdate(
                payment.transaction,
                {
                    transaction_mode: transactionDetails.transaction_mode,
                    gateway_response: {
                        ...transactionDetails,
                        webhookPayload: req.body
                    },
                    updated_by: payment.created_by
                }
            );
        } else {
            const transaction = new Transaction({
                transaction_mode: transactionDetails.transaction_mode,
                payment_id: payment._id,
                gateway_used: 'CASHFREE',
                gateway_response: {
                    ...transactionDetails,
                    webhookPayload: req.body
                },
                created_by: payment.created_by,
                updated_by: payment.created_by
            });
            
            const savedTransaction = await transaction.save();
            
            payment.transaction = savedTransaction._id;
            await payment.save();
        }
        
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook handling error:', error);
        return res.status(200).json({ success: true, message: 'Webhook received with errors' });
    }
};

const getPaymentStatus = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const userId = req.user?._id;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        
        const payment = await Payment.findById(paymentId).populate('transaction');
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }
        
        if (['SUCCESS', 'FAILED', 'CANCELLED'].includes(payment.payment_status)) {
            return res.status(200).json({
                success: true,
                payment_id: payment._id,
                status: payment.payment_status,
                amount: payment.payment_amount,
                currency: payment.payment_currency,
                purpose: payment.payment_purpose,
                created_at: payment.createdAt
            });
        }
        
        if (payment.transaction?.gateway_response?.paymentId) {
            const result = await cashfreeHandler.getPaymentStatus(
                payment._id.toString(),
                payment.transaction.gateway_response.paymentId
            );
            
            if (result.success) {
                await Transaction.findByIdAndUpdate(
                    payment.transaction._id,
                    {
                        gateway_response: {
                            ...payment.transaction.gateway_response,
                            statusCheck: result.gatewayResponse
                        },
                        updated_by: mongoose.Types.ObjectId(userId)
                    }
                );
                
                const newStatus = result.status === 'SUCCESS' ? 'SUCCESS' : 
                                  result.status === 'FAILED' ? 'FAILED' : 
                                  'PENDING';
                                  
                if (newStatus !== payment.payment_status) {
                    payment.payment_status = newStatus;
                    payment.updated_by = mongoose.Types.ObjectId(userId);
                    await payment.save();
                }
                
                return res.status(200).json({
                    success: true,
                    payment_id: payment._id,
                    status: newStatus,
                    gateway_status: result.status,
                    amount: payment.payment_amount,
                    currency: payment.payment_currency,
                    details: result.gatewayResponse
                });
            }
        }
        
        return res.status(200).json({
            success: true,
            payment_id: payment._id,
            status: payment.payment_status,
            amount: payment.payment_amount,
            currency: payment.payment_currency,
            purpose: payment.payment_purpose,
            message: 'Payment is being processed'
        });
    } catch (error) {
        console.error('Payment status check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to check payment status',
            error: error.message
        });
    }
};

module.exports = {
    getAvailablePaymentMethods,
    initiatePayment,
    handleWebhook,
    createPayment,
    handleCashfreeWebhook,
    getPaymentStatus
};