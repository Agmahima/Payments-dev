import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

const paymentRequestSchema = Joi.object({
  bookingId: Joi.string().required(),
  userId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().default('INR'),
  paymentType: Joi.string().valid('booking', 'partial', 'additional', 'refund').default('booking'),
  serviceAllocation: Joi.array().items(Joi.object({
    serviceType: Joi.string().valid('flight', 'hotel', 'cab', 'activity', 'fees', 'taxes').required(),
    serviceId: Joi.string().required(),
    allocatedAmount: Joi.number().positive().required(),
    currency: Joi.string().default('INR')
  })).optional()
});

const paymentVerificationSchema = Joi.object({
  razorpay_order_id: Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
  razorpay_signature: Joi.string().required(),
  bookingId : Joi.string().required()
});

export const validatePaymentRequest = (req: Request, res: Response, next: NextFunction) => {
  const { error } = paymentRequestSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }
  next();
};

export const validatePaymentVerification = (req: Request, res: Response, next: NextFunction) => {
  const { error } = paymentVerificationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }
  next();
};