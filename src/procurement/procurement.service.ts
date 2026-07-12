import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(orgId: string) {
    const [totalVendors, pendingPOs, monthlySpend, topVendors, allItems] = await Promise.all([
      this.prisma.vendor.count({
        where: { organizationId: orgId, status: 'ACTIVE' as never, deletedAt: null },
      }),
      this.prisma.purchaseOrder.count({
        where: {
          organizationId: orgId,
          status: { in: ['DRAFT', 'SENT', 'APPROVED', 'PARTIALLY_RECEIVED'] as never[] },
        },
      }),
      this.prisma.purchaseOrder.aggregate({
        where: {
          organizationId: orgId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          status: { not: 'CANCELLED' as never },
        },
        _sum: { grandTotal: true },
      }),
      this.prisma.purchaseOrder.groupBy({
        by: ['vendorId'],
        where: {
          organizationId: orgId,
          status: { not: 'CANCELLED' as never },
        },
        _sum: { grandTotal: true },
        _count: { id: true },
        orderBy: { _sum: { grandTotal: 'desc' } },
        take: 5,
      }),
      this.prisma.purchaseOrderItem.findMany({
        where: {
          purchaseOrder: { organizationId: orgId },
        },
        select: { quantity: true, receivedQuantity: true },
      }),
    ]);

    const vendorIds = topVendors.map((v) => v.vendorId);
    const vendors =
      vendorIds.length > 0
        ? await this.prisma.vendor.findMany({
            where: { id: { in: vendorIds } },
            select: { id: true, companyName: true, vendorCode: true },
          })
        : [];

    const topVendorList = topVendors.map((v) => {
      const vendor = vendors.find((ven) => ven.id === v.vendorId);
      return {
        vendorId: v.vendorId,
        companyName: vendor?.companyName || 'Unknown',
        vendorCode: vendor?.vendorCode || '',
        totalSpend: v._sum.grandTotal || 0,
        orderCount: v._count.id,
      };
    });

    const totalAwaiting = allItems.reduce(
      (sum, item) => sum + Math.max(0, item.quantity - item.receivedQuantity),
      0,
    );

    return {
      totalVendors,
      pendingPurchaseOrders: pendingPOs,
      goodsAwaitingReceipt: totalAwaiting,
      monthlyPurchasing: monthlySpend._sum.grandTotal || 0,
      topVendors: topVendorList,
    };
  }

  async search(orgId: string, query: string) {
    const [vendors, purchaseOrders, goodsReceipts] = await Promise.all([
      this.prisma.vendor.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            { companyName: { contains: query, mode: 'insensitive' } },
            { vendorCode: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, companyName: true, vendorCode: true },
        take: 10,
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          organizationId: orgId,
          poNumber: { contains: query, mode: 'insensitive' },
        },
        select: { id: true, poNumber: true, status: true },
        take: 10,
      }),
      this.prisma.goodsReceipt.findMany({
        where: {
          organizationId: orgId,
          grnNumber: { contains: query, mode: 'insensitive' },
        },
        select: { id: true, grnNumber: true, status: true },
        take: 10,
      }),
    ]);

    return { vendors, purchaseOrders, goodsReceipts };
  }
}
