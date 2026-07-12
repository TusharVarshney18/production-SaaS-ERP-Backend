import { PricingService } from '../pricing.service';
import { DiscountType } from '@prisma/client';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  describe('calculateLineItem', () => {
    it('should calculate line total correctly', () => {
      const result = service.calculateLineItem({
        quantity: 5,
        unitPrice: 1000,
        discount: 10,
        taxRate: 18,
      });

      expect(result.lineTotal).toBe(5000);
      expect(result.itemDiscountAmount).toBe(500);
      expect(result.itemNetTotal).toBe(5310);
      expect(result.itemTaxAmount).toBe(810);
    });

    it('should handle zero discount and tax', () => {
      const result = service.calculateLineItem({
        quantity: 3,
        unitPrice: 500,
        discount: 0,
        taxRate: 0,
      });

      expect(result.lineTotal).toBe(1500);
      expect(result.itemDiscountAmount).toBe(0);
      expect(result.itemTaxAmount).toBe(0);
      expect(result.itemNetTotal).toBe(1500);
    });

    it('should handle single quantity', () => {
      const result = service.calculateLineItem({
        quantity: 1,
        unitPrice: 2500,
        discount: 0,
        taxRate: 5,
      });

      expect(result.lineTotal).toBe(2500);
      expect(result.itemTaxAmount).toBe(125);
    });
  });

  describe('calculateSummary', () => {
    it('should calculate complete pricing summary', () => {
      const result = service.calculateSummary({
        lineItems: [
          { quantity: 2, unitPrice: 1000, discount: 0, taxRate: 10 },
          { quantity: 1, unitPrice: 500, discount: 0, taxRate: 10 },
        ],
        discountType: null,
        discountValue: 0,
        shippingAmount: 500,
      });

      expect(result.subtotal).toBe(2500);
      expect(result.discountAmount).toBe(0);
      expect(result.taxAmount).toBe(250);
      expect(result.shippingAmount).toBe(500);
      expect(result.grandTotal).toBe(3250);
    });

    it('should apply percentage discount at header level', () => {
      const result = service.calculateSummary({
        lineItems: [{ quantity: 2, unitPrice: 1000, discount: 0, taxRate: 10 }],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        shippingAmount: 0,
      });

      expect(result.subtotal).toBe(2000);
      expect(result.discountAmount).toBe(200);
      expect(result.taxAmount).toBe(200);
      expect(result.grandTotal).toBe(2000);
    });

    it('should apply fixed discount at header level', () => {
      const result = service.calculateSummary({
        lineItems: [{ quantity: 2, unitPrice: 1000, discount: 0, taxRate: 10 }],
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 300,
        shippingAmount: 200,
      });

      expect(result.subtotal).toBe(2000);
      expect(result.discountAmount).toBe(300);
      expect(result.taxAmount).toBe(200);
      expect(result.shippingAmount).toBe(200);
      expect(result.grandTotal).toBe(2100);
    });

    it('should combine item-level and header-level discounts', () => {
      const result = service.calculateSummary({
        lineItems: [{ quantity: 2, unitPrice: 1000, discount: 10, taxRate: 10 }],
        discountType: DiscountType.PERCENTAGE,
        discountValue: 5,
        shippingAmount: 0,
      });

      expect(result.subtotal).toBe(2000);
      expect(result.discountAmount).toBe(300);
      expect(result.taxAmount).toBe(180);
      expect(result.grandTotal).toBe(1880);
    });

    it('should not allow negative grand total', () => {
      const result = service.calculateSummary({
        lineItems: [{ quantity: 1, unitPrice: 500, discount: 0, taxRate: 0 }],
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 99999,
        shippingAmount: 0,
      });

      expect(result.grandTotal).toBe(0);
    });
  });

  describe('validateCalculations', () => {
    it('should return true for valid calculations', () => {
      const input = {
        lineItems: [{ quantity: 2, unitPrice: 1000, discount: 0, taxRate: 10 }],
        discountType: null as DiscountType | null,
        discountValue: 0,
        shippingAmount: 100,
      };

      const output = service.calculateSummary(input);
      const isValid = service.validateCalculations(input, output);
      expect(isValid).toBe(true);
    });

    it('should return false for tampered calculations', () => {
      const input = {
        lineItems: [{ quantity: 2, unitPrice: 1000, discount: 0, taxRate: 10 }],
        discountType: null as DiscountType | null,
        discountValue: 0,
        shippingAmount: 0,
      };

      const output = service.calculateSummary(input);
      output.grandTotal = 999;
      const isValid = service.validateCalculations(input, output);
      expect(isValid).toBe(false);
    });
  });
});
