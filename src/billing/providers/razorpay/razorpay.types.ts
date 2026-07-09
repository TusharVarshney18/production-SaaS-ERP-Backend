export interface RazorpayOrderOptions {
  amount: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string>;
  partial_payment?: boolean;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_due: number;
  amount_paid: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  invoice_id: string | null;
  method: string;
  amount_refunded: number;
  refund_status: string | null;
  captured: boolean;
  description: string;
  bank: string | null;
  card_id: string | null;
  email: string;
  contact: string;
  notes: Record<string, string>;
  fee: number | null;
  tax: number | null;
  created_at: number;
}

export interface RazorpayRefund {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  payment_id: string;
  status: string;
  created_at: number;
}

export interface RazorpayWebhookEvent {
  event: string;
  contains: string[];
  payload: {
    payment?: { entity: RazorpayPayment };
    order?: { entity: RazorpayOrder };
    subscription?: { entity: Record<string, unknown> };
  };
  created_at: number;
}

export interface RazorpayInstance {
  orders: {
    create(
      options: RazorpayOrderOptions,
      extra?: { headers?: Record<string, string> },
    ): Promise<RazorpayOrder>;
    fetch(orderId: string): Promise<RazorpayOrder>;
  };
  payments: {
    fetch(paymentId: string): Promise<RazorpayPayment>;
    refund(
      paymentId: string,
      options?: { amount?: number; notes?: Record<string, string> },
    ): Promise<RazorpayRefund>;
  };
}
