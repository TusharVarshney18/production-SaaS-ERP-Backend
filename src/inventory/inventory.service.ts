import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(orgId: string) {
    const [totalWarehouses, totalProducts, stockSummary, allStock, recentTransfers, topMoving] =
      await Promise.all([
        this.prisma.warehouse.count({
          where: { organizationId: orgId, status: 'ACTIVE' as never, deletedAt: null },
        }),
        this.prisma.product.count({
          where: { organizationId: orgId, deletedAt: null, status: 'ACTIVE' as never },
        }),
        this.prisma.stock.aggregate({
          where: { organizationId: orgId },
          _sum: { availableQty: true, reservedQty: true, damagedQty: true },
        }),
        this.prisma.stock.findMany({
          where: { organizationId: orgId },
          select: { availableQty: true, reservedQty: true, reorderLevel: true },
        }),
        this.prisma.inventoryTransfer.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            createdAt: true,
            fromWarehouse: { select: { name: true } },
            toWarehouse: { select: { name: true } },
          },
        }),
        this.prisma.stockLedger.groupBy({
          by: ['productId'],
          where: {
            organizationId: orgId,
            transactionType: 'SALE' as never,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 10,
        }),
      ]);

    const lowStockCount = allStock.filter(
      (s) => s.availableQty > 0 && s.availableQty <= s.reorderLevel,
    ).length;
    const outOfStockCount = allStock.filter((s) => s.availableQty === 0).length;
    const reservedCount = allStock.filter((s) => s.reservedQty > 0).length;

    const topProductIds = topMoving.map((t) => t.productId);
    const topProducts =
      topProductIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: topProductIds } },
            select: { id: true, name: true, sku: true },
          })
        : [];

    const topMovingProducts = topMoving.map((t) => {
      const product = topProducts.find((p) => p.id === t.productId);
      return {
        productId: t.productId,
        productName: product?.name || 'Unknown',
        sku: product?.sku || '',
        totalSold: Math.abs(t._sum.quantity || 0),
      };
    });

    return {
      totalWarehouses,
      totalProducts,
      currentInventory: stockSummary._sum.availableQty || 0,
      reservedInventory: stockSummary._sum.reservedQty || 0,
      damagedInventory: stockSummary._sum.damagedQty || 0,
      lowStockCount,
      outOfStockCount,
      reservedCount,
      recentTransfers,
      topMovingProducts,
    };
  }

  async search(orgId: string, query: string, warehouseId?: string) {
    const productWhere: Record<string, unknown> = {
      organizationId: orgId,
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
      ],
    };

    const products = await this.prisma.product.findMany({
      where: productWhere,
      select: { id: true, name: true, sku: true },
      take: 20,
    });

    if (products.length === 0) return { products: [], stock: [] };

    const stockWhere: Record<string, unknown> = {
      organizationId: orgId,
      productId: { in: products.map((p) => p.id) },
    };
    if (warehouseId) stockWhere.warehouseId = warehouseId;

    const stock = await this.prisma.stock.findMany({
      where: stockWhere,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    return { products, stock };
  }
}
