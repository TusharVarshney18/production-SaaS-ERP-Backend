import { Injectable } from '@nestjs/common';
import { DiscountType } from '@prisma/client';

export interface PricingLineItemInput {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

export interface PricingLineItemOutput {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  itemDiscountAmount: number;
  itemTaxAmount: number;
  itemNetTotal: number;
}

export interface PricingSummaryInput {
  lineItems: PricingLineItemInput[];
  discountType?: DiscountType | null;
  discountValue?: number;
  shippingAmount?: number;
}

export interface PricingSummaryOutput {
  lineItems: PricingLineItemOutput[];
  subtotal: number;
  discountType: DiscountType | null;
  discountValue: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  shippingAmount: number;
  grandTotal: number;
}

@Injectable()
export class PricingService {
  calculateLineItem(item: PricingLineItemInput): PricingLineItemOutput {
    const lineTotal = item.quantity * item.unitPrice;
    const itemDiscountAmount = Math.round(lineTotal * (item.discount / 100));
    const itemNetTotal = lineTotal - itemDiscountAmount;
    const itemTaxAmount = Math.round(itemNetTotal * (item.taxRate / 100));

    return {
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxRate: item.taxRate,
      lineTotal,
      itemDiscountAmount,
      itemTaxAmount,
      itemNetTotal: itemNetTotal + itemTaxAmount,
    };
  }

  calculateSummary(input: PricingSummaryInput): PricingSummaryOutput {
    const lineItems = input.lineItems.map((item) => this.calculateLineItem(item));

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalItemDiscount = lineItems.reduce((sum, item) => sum + item.itemDiscountAmount, 0);

    const discountType = input.discountType ?? null;
    const discountValue = input.discountValue ?? 0;

    let discountAmount = totalItemDiscount;
    if (discountType === DiscountType.PERCENTAGE && discountValue > 0) {
      discountAmount += Math.round(subtotal * (discountValue / 100));
    } else if (discountType === DiscountType.FIXED_AMOUNT && discountValue > 0) {
      discountAmount += discountValue;
    }

    const taxableAmount = subtotal - discountAmount;
    const taxAmount = lineItems.reduce((sum, item) => sum + item.itemTaxAmount, 0);
    const shippingAmount = input.shippingAmount ?? 0;
    const grandTotal = taxableAmount + taxAmount + shippingAmount;

    return {
      lineItems,
      subtotal,
      discountType,
      discountValue,
      discountAmount: Math.max(0, discountAmount),
      taxableAmount: Math.max(0, taxableAmount),
      taxAmount,
      shippingAmount,
      grandTotal: Math.max(0, grandTotal),
    };
  }

  validateCalculations(input: PricingSummaryInput, output: PricingSummaryOutput): boolean {
    const expectedLineItems = input.lineItems.map((item) => this.calculateLineItem(item));

    const lineTotalsMatch = output.lineItems.every((item, i) => {
      const expected = expectedLineItems[i];
      return (
        item.lineTotal === expected.lineTotal &&
        item.itemDiscountAmount === expected.itemDiscountAmount &&
        item.itemTaxAmount === expected.itemTaxAmount &&
        item.itemNetTotal === expected.itemNetTotal
      );
    });

    if (!lineTotalsMatch) return false;

    const expectedSummary = this.calculateSummary(input);
    return (
      output.subtotal === expectedSummary.subtotal &&
      output.discountAmount === expectedSummary.discountAmount &&
      output.taxAmount === expectedSummary.taxAmount &&
      output.grandTotal === expectedSummary.grandTotal
    );
  }
}
