export class RazorpayCheckoutDto {
  amount!: number;
  currency!: string;
  receipt?: string;
  notes?: Record<string, string>;
  callback_url?: string;
  cancel_url?: string;
}

export class RazorpayVerificationDto {
  razorpay_payment_id!: string;
  razorpay_order_id!: string;
  razorpay_signature!: string;
}

export class RazorpayRefundDto {
  payment_id!: string;
  amount?: number;
  notes?: Record<string, string>;
}

export interface RazorpayWebhookEvent {
  event: string;
  payload: Record<string, unknown>;
  created_at: number;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
}
