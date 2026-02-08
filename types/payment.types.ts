// import { Document, Types } from 'mongoose';

// export interface ServiceAllocation {
//   serviceType: 'flight' | 'hotel' | 'cab' | 'activity' | 'fees' | 'taxes';
//   serviceId: Types.ObjectId;
//   allocatedAmount: number;
//   currency: string;
// }

// export interface PaymentMethodDetails {
//   card?: {
//     network?: 'visa' | 'mastercard' | 'amex' | 'rupay';
//     type?: 'credit' | 'debit';
//     last4?: string;
//     bank?: string;
//   };
//   upi?: {
//     vpa?: string;
//     app?: string;
//   };
//   netbanking?: {
//     bankCode?: string;
//     bankName?: string;
//   };
//   wallet?: {
//     name?: string;
//     id?: string;
//   };
// }

// export interface GatewayResponse {
//   raw?: any;
//   receiptUrl?: string;
//   failureReason?: string;
//   errorCode?: string;
// }

// export interface RefundDetails {
//   refundId?: string;
//   refundAmount?: number;
//   refundReason?: string;
//   refundDate?: Date;
//   refundStatus?: 'pending' | 'processed' | 'failed';
// }

// export interface CustomerDetails {
//   name?: string;
//   email?: string;
//   phone?: string;
// }

// export interface IPayment extends Document {
//   bookingId: Types.ObjectId;
//   userId: Types.ObjectId;
//   paymentType: 'booking' | 'partial' | 'additional' | 'refund';
//   serviceAllocation: ServiceAllocation[];
  
//   // Gateway Information
//   razorpayOrderId?: string;
//   razorpayPaymentId?: string;
//   transactionRef: string;
//   paymentGateway: 'razorpay' | 'stripe' | 'cashfree';
  
//   // Payment Details
//   paymentMethod?: 'card' | 'upi' | 'netbanking' | 'wallet' | 'other';
//   paymentMethodDetails?: PaymentMethodDetails;
  
//   amount: number;
//   currency: string;
  
//   // Status Tracking
//   status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  
//   // Timestamps
//   initiatedAt: Date;
//   completedAt?: Date;
  
//   // Gateway Response
//   gatewayResponse: GatewayResponse;
  
//   // Refund Information
//   refundDetails?: RefundDetails;
  
//   // Metadata
//   processedBy?: string;
//   notes?: string;
//   customerDetails?: CustomerDetails;
  
//   createdAt: Date;
//   updatedAt: Date;
  
//   // Methods
//   markAsPaid(paymentDetails: any): Promise<IPayment>;
//   markAsFailed(reason: string, errorCode?: string): Promise<IPayment>;
//   initiateRefund(refundAmount: number, reason: string): Promise<IPayment>;
// }

// ### Complete Types File (src/types/payment.types.ts)
// ```typescript
import { Document, Types } from 'mongoose';

export interface ServiceAllocation {
  serviceType: 'flight' | 'hotel' | 'cab' | 'activity' | 'fees' | 'taxes';
  serviceId: Types.ObjectId;
  allocatedAmount: number;
  currency: string;
}

export interface PaymentMethodDetails {
  card?: {
    network?: 'visa' | 'mastercard' | 'amex' | 'rupay';
    type?: 'credit' | 'debit';
    last4?: string;
    bank?: string;
  };
  upi?: {
    vpa?: string;
    app?: string;
  };
  netbanking?: {
    bankCode?: string;
    bankName?: string;
  };
  wallet?: {
    name?: string;
    id?: string;
  };
}

export interface GatewayResponse {
  raw?: any;
  receiptUrl?: string;
  failureReason?: string;
  errorCode?: string;
}

export interface RefundDetails {
  refundId?: string;
  refundAmount?: number;
  refundReason?: string;
  refundDate?: Date;
  refundStatus?: 'pending' | 'processed' | 'failed';
}

export interface CustomerDetails {
  name?: string;
  email?: string;
  phone?: string;
}

export interface IPayment extends Document {
  bookingId: Types.ObjectId;
  userId: Types.ObjectId;
  paymentType: 'booking' | 'partial' | 'additional' | 'refund';
  serviceAllocation: ServiceAllocation[];
  
  // Gateway Information
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  transactionRef: string;
  paymentGateway: 'razorpay' | 'stripe' | 'cashfree';
  
  // Payment Details
  paymentMethod?: 'card' | 'upi' | 'netbanking' | 'wallet' | 'other';
  paymentMethodDetails?: PaymentMethodDetails;
  
  amount: number;
  currency: string;
  
  // Status Tracking
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  
  // Timestamps
  initiatedAt: Date;
  completedAt?: Date;
  
  // Gateway Response
  gatewayResponse: GatewayResponse;
  
  // Refund Information
  refundDetails?: RefundDetails;
  
  // Metadata
  processedBy?: string;
  notes?: string;
  customerDetails?: CustomerDetails;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  markAsPaid(paymentDetails: any): Promise<IPayment>;
  markAsFailed(reason: string, errorCode?: string): Promise<IPayment>;
  initiateRefund(refundAmount: number, reason: string): Promise<IPayment>;
}

export interface PaymentRequestData {
  bookingId: string;
  userId: string;
  amount: number;
  currency?: string;
  paymentType?: 'booking' | 'partial' | 'additional' | 'refund';
  serviceAllocation?: ServiceAllocation[];
  customerDetails?: CustomerDetails;
  returnUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

export interface RazorpayOrderData {
  orderId: string;
  amount: number;
  currency: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentVerificationData {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  bookingId: string;
}

export interface BookingUpdateData {
  paymentStatus: string;
  totalPaid: number;
  paymentId: string;
}

export interface PaymentGatewayConfig {
  enabled: boolean;
  name: string;
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  supportedMethods: string[];
  subscriptionEnabled: boolean;
}

export interface PaymentConfig {
  regionMap: Record<string, string[]>;
  gateways: Record<string, PaymentGatewayConfig>;
}

export * from './payment.types';