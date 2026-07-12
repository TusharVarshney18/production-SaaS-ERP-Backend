export interface InventoryReservationRequest {
  salesOrderId: string;
  organizationId: string;
  items: {
    productId: string;
    quantity: number;
  }[];
}

export interface InventoryReservationResult {
  success: boolean;
  reservedItems: {
    productId: string;
    quantityReserved: number;
  }[];
  errors?: {
    productId: string;
    message: string;
  }[];
}

export interface IInventoryReservationService {
  reserve(request: InventoryReservationRequest): Promise<InventoryReservationResult>;
  release(salesOrderId: string): Promise<void>;
}
