export const BUSINESS_EVENTS = [
  'LeadCreated',
  'LeadConverted',
  'QuotationCreated',
  'QuotationApproved',
  'SalesOrderCreated',
  'InvoiceCreated',
  'InvoicePaid',
  'PaymentCaptured',
  'VendorCreated',
  'PurchaseOrderApproved',
  'GoodsReceived',
  'StockLow',
  'InventoryAdjusted',
  'JournalPosted',
  'EmployeeCreated',
  'LeaveApproved',
  'AttendanceCheckedIn',
] as const;

export type BusinessEvent = (typeof BUSINESS_EVENTS)[number];

export interface BusinessEventPayload {
  organizationId: string;
  event: BusinessEvent;
  resourceId: string;
  data?: Record<string, unknown>;
  occurredAt: Date;
}
