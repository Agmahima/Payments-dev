export interface PaymentGatewayConfig {
  apiKey: string;
  secretKey: string;
  mode: 'sandbox' | 'production';
}

export interface PaymentRequest {
  request_ref?: string;
  payment_purpose: 'Investment' | 'Subscription' | 'Service';
  payment_amount: number;
  payment_currency: string;
  payee_ref: string;
  payee_type: 'Person' | 'Entity';
  receiver_ref: string;
  receiver_type: 'Nucleo' | 'Person' | 'Entity';
  payee_location: string;
  payment_gateway: string;
  customer_details: {
    name: string;
    email: string;
    phone: string;
    id: string;
  };
}

export interface GatewayInitiateRequest {
  orderId: string;
  amount: number;
  currency: string;
  customerDetails: {
    name: string;
    email: string;
    phone: string;
    id: string;
  };
  metadata?: Record<string, any>;
}

export interface GatewayResponse {
  success: boolean;
  gatewayOrderId?: string;
  paymentUrl?: string;
  error?: string;
  gatewayResponse: Record<string, any>;
} 