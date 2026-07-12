export interface CreditNoteRequest {
  invoiceId: string;
  organizationId: string;
  reason: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    reason?: string;
  }[];
  createdById: string;
}

export interface CreditNoteResult {
  success: boolean;
  creditNoteId: string;
  creditNoteNumber: string;
  amount: number;
}

export interface ICreditNoteService {
  createCreditNote(request: CreditNoteRequest): Promise<CreditNoteResult>;
  cancelCreditNote(creditNoteId: string): Promise<void>;
}
