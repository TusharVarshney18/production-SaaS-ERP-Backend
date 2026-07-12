export interface ShipmentRequest {
  salesOrderId: string;
  organizationId: string;
  items: {
    productId: string;
    quantity: number;
  }[];
  shippingAddress: string;
  carrier?: string;
  trackingNumber?: string;
}

export interface ShipmentResult {
  success: boolean;
  shipmentId: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: Date;
}

export interface IShipmentService {
  createShipment(request: ShipmentRequest): Promise<ShipmentResult>;
  cancelShipment(shipmentId: string): Promise<void>;
}
