export interface RecurringInvoiceConfig {
  organizationId: string;
  companyId: string;
  contactId: string;
  ownerId: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  interval: number;
  startDate: Date;
  endDate?: Date;
  nextInvoiceDate: Date;
  items: {
    productId: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate?: number;
  }[];
  currency?: string;
  terms?: string;
}

export interface IRecurringInvoiceService {
  createRecurringInvoice(config: RecurringInvoiceConfig): Promise<{ id: string }>;
  pauseRecurringInvoice(id: string): Promise<void>;
  resumeRecurringInvoice(id: string): Promise<void>;
  cancelRecurringInvoice(id: string): Promise<void>;
  generateNextInvoice(recurringId: string): Promise<{ invoiceId: string; invoiceNumber: string }>;
}
