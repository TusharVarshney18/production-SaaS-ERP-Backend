export interface AccountingHookParams {
  organizationId: string;
  referenceType: string;
  referenceId: string;
  postingDate: Date;
  description: string;
  lines: AccountingHookLine[];
}

export interface AccountingHookLine {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface IAccountingHooksService {
  onSalesInvoicePosted(params: SalesInvoicePostedParams): Promise<void>;
  onPaymentReceived(params: PaymentReceivedParams): Promise<void>;
  onPurchaseReceipt(params: PurchaseReceiptParams): Promise<void>;
  onInventoryAdjustment(params: InventoryAdjustmentParams): Promise<void>;
  onRefund(params: RefundParams): Promise<void>;
}

export interface SalesInvoicePostedParams extends AccountingHookParams {
  invoiceId: string;
  customerId: string;
  totalAmount: number;
  taxAmount: number;
}

export interface PaymentReceivedParams extends AccountingHookParams {
  paymentId: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
}

export interface PurchaseReceiptParams extends AccountingHookParams {
  goodsReceiptId: string;
  purchaseOrderId: string;
  vendorId: string;
  totalCost: number;
  taxAmount: number;
}

export interface InventoryAdjustmentParams extends AccountingHookParams {
  adjustmentId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
}

export interface RefundParams extends AccountingHookParams {
  refundId: string;
  originalReferenceType: string;
  originalReferenceId: string;
  amount: number;
}
