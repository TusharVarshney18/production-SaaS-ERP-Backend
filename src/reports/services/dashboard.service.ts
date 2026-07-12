import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesReportsService } from './sales-reports.service';
import { InventoryReportsService } from './inventory-reports.service';
import { ProcurementReportsService } from './procurement-reports.service';
import { FinanceReportsService } from './finance-reports.service';
import { HrReportsService } from './hr-reports.service';

interface WarehouseReportItem {
  name: string;
  totalStock: number;
}

interface TrialBalanceRow {
  account: { accountCode: string };
  totalDebit: number;
  totalCredit: number;
}

interface TrialBalanceResult {
  rows: TrialBalanceRow[];
}

interface StatusDistItem {
  label: string;
  value: number;
}

interface DeptDistItem {
  department: string;
  count: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesReportsService,
    private readonly inventory: InventoryReportsService,
    private readonly procurement: ProcurementReportsService,
    private readonly finance: FinanceReportsService,
    private readonly hr: HrReportsService,
  ) {}

  async getExecutiveDashboard(orgId: string) {
    const [
      revenue,
      outstandingInvoices,
      inventoryValue,
      purchaseSpend,
      employeeCount,
      revenueTrend,
    ] = await Promise.all([
      this.sales.getRevenueKpi(orgId),
      this.finance.getOutstandingInvoices(orgId),
      this.inventory.getInventoryValue(orgId),
      this.procurement.getPurchaseSpend(orgId),
      this.hr.getEmployeeCount(orgId),
      this.sales.getRevenueTrend(orgId, new Date().getFullYear()),
    ]);
    return {
      kpis: [
        { label: 'Revenue', value: revenue, change: 0, trend: 'neutral' as const },
        {
          label: 'Outstanding Invoices',
          value: outstandingInvoices,
          change: 0,
          trend: 'neutral' as const,
        },
        { label: 'Inventory Value', value: inventoryValue, change: 0, trend: 'neutral' as const },
        { label: 'Purchase Spend', value: purchaseSpend, change: 0, trend: 'neutral' as const },
        { label: 'Active Employees', value: employeeCount, change: 0, trend: 'neutral' as const },
      ],
      charts: {
        revenueTrend: {
          labels: revenueTrend.map((r) =>
            new Date(2024, r.month - 1).toLocaleString('default', { month: 'short' }),
          ),
          datasets: [
            {
              label: 'Revenue',
              data: revenueTrend.map((r) => r.value),
              backgroundColor: '#4f46e5',
              borderColor: '#4f46e5',
            },
          ],
        },
      },
    };
  }

  async getSalesDashboard(orgId: string) {
    const [revenue, revenueTrend, salesByStatus, topProducts] = await Promise.all([
      this.sales.getRevenueKpi(orgId),
      this.sales.getRevenueTrend(orgId, new Date().getFullYear()),
      this.sales.getSalesByStatus(orgId),
      this.sales.getTopProducts(orgId, undefined, undefined, 5),
    ]);
    return {
      kpis: [{ label: 'Revenue', value: revenue, change: 0, trend: 'neutral' as const }],
      charts: {
        revenueTrend: {
          labels: revenueTrend.map((r) =>
            new Date(2024, r.month - 1).toLocaleString('default', { month: 'short' }),
          ),
          datasets: [{ label: 'Revenue', data: revenueTrend.map((r) => r.value) }],
        },
        salesByStatus: {
          labels: salesByStatus.map((s: StatusDistItem) => s.label),
          datasets: [{ label: 'Orders', data: salesByStatus.map((s: StatusDistItem) => s.value) }],
        },
        topProducts: {
          labels: topProducts.map((p: Record<string, unknown>) => p.productName as string),
          datasets: [
            {
              label: 'Revenue',
              data: topProducts.map((p: Record<string, unknown>) => p.totalRevenue as number),
            },
          ],
        },
      },
    };
  }

  async getInventoryDashboard(orgId: string) {
    const [value, totalStock, lowStock, outOfStock, reserved, warehouses] = await Promise.all([
      this.inventory.getInventoryValue(orgId),
      this.prisma.stock.aggregate({
        where: { organizationId: orgId },
        _sum: { availableQty: true },
      }),
      this.prisma.stock
        .findMany({
          where: { organizationId: orgId, availableQty: { gt: 0 } },
          select: { availableQty: true, reorderLevel: true },
        })
        .then((rows) => rows.filter((r) => r.availableQty <= r.reorderLevel).length),
      this.prisma.stock.count({ where: { organizationId: orgId, availableQty: 0 } }),
      this.prisma.stock.count({ where: { organizationId: orgId, reservedQty: { gt: 0 } } }),
      this.inventory.getWarehouseReport(orgId),
    ]);
    return {
      kpis: [
        { label: 'Inventory Value', value, change: 0, trend: 'neutral' as const },
        {
          label: 'Total Stock',
          value: totalStock._sum.availableQty || 0,
          change: 0,
          trend: 'neutral' as const,
        },
        { label: 'Low Stock Items', value: lowStock, change: 0, trend: 'neutral' as const },
        { label: 'Out of Stock', value: outOfStock, change: 0, trend: 'neutral' as const },
        { label: 'Reserved Items', value: reserved, change: 0, trend: 'neutral' as const },
      ],
      charts: {
        warehouseStock: {
          labels: (warehouses as unknown as WarehouseReportItem[]).map((w) => w.name),
          datasets: [
            {
              label: 'Stock',
              data: (warehouses as unknown as WarehouseReportItem[]).map((w) => w.totalStock),
            },
          ],
        },
      },
    };
  }

  async getProcurementDashboard(orgId: string) {
    const [spend, pendingPOs, purchaseByStatus, purchaseTrend] = await Promise.all([
      this.procurement.getPurchaseSpend(orgId),
      this.prisma.purchaseOrder.count({
        where: {
          organizationId: orgId,
          status: { in: ['DRAFT', 'SENT', 'APPROVED', 'PARTIALLY_RECEIVED'] as never[] },
        },
      }),
      this.procurement.getPurchaseByStatus(orgId),
      this.procurement.getPurchaseTrend(orgId, new Date().getFullYear()),
    ]);
    return {
      kpis: [
        { label: 'Purchase Spend', value: spend, change: 0, trend: 'neutral' as const },
        { label: 'Pending POs', value: pendingPOs, change: 0, trend: 'neutral' as const },
      ],
      charts: {
        purchaseTrend: {
          labels: purchaseTrend.map((r) =>
            new Date(2024, r.month - 1).toLocaleString('default', { month: 'short' }),
          ),
          datasets: [{ label: 'Spend', data: purchaseTrend.map((r) => r.value) }],
        },
        purchaseByStatus: {
          labels: purchaseByStatus.map((s: StatusDistItem) => s.label),
          datasets: [{ label: 'POs', data: purchaseByStatus.map((s: StatusDistItem) => s.value) }],
        },
      },
    };
  }

  async getAccountingDashboard(orgId: string) {
    const [outstanding, trialBalance] = await Promise.all([
      this.finance.getOutstandingInvoices(orgId),
      this.finance.getTrialBalance(orgId),
    ]);
    return {
      kpis: [
        { label: 'Outstanding Invoices', value: outstanding, change: 0, trend: 'neutral' as const },
      ],
      charts: {
        trialBalance: {
          labels: (trialBalance as TrialBalanceResult).rows.map((r) => r.account.accountCode),
          datasets: [
            {
              label: 'Debit',
              data: (trialBalance as TrialBalanceResult).rows.map((r) => r.totalDebit),
            },
            {
              label: 'Credit',
              data: (trialBalance as TrialBalanceResult).rows.map((r) => r.totalCredit),
            },
          ],
        },
      },
    };
  }

  async getHrDashboard(orgId: string) {
    const [employeeCount, byStatus, byDept] = await Promise.all([
      this.hr.getEmployeeCount(orgId),
      this.hr.getEmployeeByStatus(orgId),
      this.hr.getEmployeeByDepartment(orgId),
    ]);
    return {
      kpis: [
        { label: 'Active Employees', value: employeeCount, change: 0, trend: 'neutral' as const },
      ],
      charts: {
        employeeByStatus: {
          labels: (byStatus as StatusDistItem[]).map((s) => s.label),
          datasets: [
            { label: 'Employees', data: (byStatus as StatusDistItem[]).map((s) => s.value) },
          ],
        },
        employeeByDepartment: {
          labels: (byDept as DeptDistItem[]).map((d) => d.department),
          datasets: [{ label: 'Employees', data: (byDept as DeptDistItem[]).map((d) => d.count) }],
        },
      },
    };
  }
}
