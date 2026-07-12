export interface PaymentAllocationRequest {
  invoiceId: string;
  organizationId: string;
  amount: number;
  paymentMethod?: string;
  transactionReference?: string;
  allocatedById: string;
}

export interface PaymentAllocationResult {
  success: boolean;
  invoiceId: string;
  amountAllocated: number;
  newAmountPaid: number;
  newBalanceDue: number;
  paymentStatus: string;
}

export interface IPaymentAllocationService {
  allocatePayment(request: PaymentAllocationRequest): Promise<PaymentAllocationResult>;
  reverseAllocation(invoiceId: string, amount: number): Promise<void>;
}
