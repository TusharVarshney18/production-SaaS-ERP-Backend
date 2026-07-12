export interface InvoiceGenerationRequest {
  salesOrderId: string;
  organizationId: string;
  items: {
    productId: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  grandTotal: number;
  currency: string;
}

export interface InvoiceGenerationResult {
  success: boolean;
  invoiceId: string;
  invoiceNumber: string;
}

export interface IInvoiceGenerationService {
  generateInvoice(request: InvoiceGenerationRequest): Promise<InvoiceGenerationResult>;
}
