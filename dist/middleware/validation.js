"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePaymentVerification = exports.validatePaymentRequest = void 0;
const joi_1 = __importDefault(require("joi"));
const paymentRequestSchema = joi_1.default.object({
    bookingId: joi_1.default.string().required(),
    userId: joi_1.default.string().required(),
    amount: joi_1.default.number().positive().required(),
    currency: joi_1.default.string().default('INR'),
    paymentType: joi_1.default.string().valid('booking', 'partial', 'additional', 'refund').default('booking'),
    serviceAllocation: joi_1.default.array().items(joi_1.default.object({
        serviceType: joi_1.default.string().valid('flight', 'hotel', 'cab', 'activity', 'fees', 'taxes').required(),
        serviceId: joi_1.default.string().required(),
        allocatedAmount: joi_1.default.number().positive().required(),
        currency: joi_1.default.string().default('INR')
    })).optional()
});
const paymentVerificationSchema = joi_1.default.object({
    razorpay_order_id: joi_1.default.string().required(),
    razorpay_payment_id: joi_1.default.string().required(),
    razorpay_signature: joi_1.default.string().required(),
    bookingId: joi_1.default.string().required()
});
const validatePaymentRequest = (req, res, next) => {
    const { error } = paymentRequestSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details[0].message
        });
    }
    next();
};
exports.validatePaymentRequest = validatePaymentRequest;
const validatePaymentVerification = (req, res, next) => {
    const { error } = paymentVerificationSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details[0].message
        });
    }
    next();
};
exports.validatePaymentVerification = validatePaymentVerification;
