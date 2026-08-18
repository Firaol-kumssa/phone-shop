import { BadRequestException, Injectable } from '@nestjs/common';
import { PhoneStatus } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';

export interface SalesReport {
  from: string;
  to: string;
  salesCount: number;
  unitsSold: number;
  totalRevenue: number;
  totalProfit: number;
}

export interface InventoryReport {
  totalUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
  byModel: {
    brand: string;
    model: string;
    units: number;
    costValue: number;
    retailValue: number;
  }[];
}

export type ProfitGroupBy = 'model' | 'brand' | 'staff';

export interface ProfitReport {
  groupBy: ProfitGroupBy;
  rows: { key: string; unitsSold: number; revenue: number; profit: number }[];
}

/**
 * Read-only reporting (Blueprint 3.5): daily/weekly/monthly are the same
 * aggregate query with different date ranges. This service never writes.
 */
@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  dailyReport(date?: string): Promise<SalesReport> {
    const start = this.parseDate(date);
    return this.salesReport(start, this.addDays(start, 1));
  }

  /** Week starts Monday; `date` may be any day within the week. */
  weeklyReport(date?: string): Promise<SalesReport> {
    const day = this.parseDate(date);
    const start = this.addDays(day, -((day.getDay() + 6) % 7));
    return this.salesReport(start, this.addDays(start, 7));
  }

  monthlyReport(month?: string): Promise<SalesReport> {
    if (month !== undefined && !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month must be YYYY-MM');
    }
    const now = new Date();
    const [year, mon] = month
      ? month.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];
    const start = new Date(year, mon - 1, 1);
    return this.salesReport(start, new Date(year, mon, 1));
  }

  /** The one shared query: totals over sales/sale_items in [from, to). */
  private async salesReport(from: Date, to: Date): Promise<SalesReport> {
    const [sales, items] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { saleDate: { gte: from, lt: to } },
        _count: { saleId: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.saleItem.aggregate({
        where: { sale: { saleDate: { gte: from, lt: to } } },
        _sum: { quantity: true, profit: true },
      }),
    ]);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      salesCount: sales._count.saleId,
      unitsSold: items._sum.quantity ?? 0,
      totalRevenue: Number(sales._sum.totalAmount ?? 0),
      totalProfit: Number(items._sum.profit ?? 0),
    };
  }

  /** Count and value of phones where status = In Stock, grouped by brand/model (Blueprint 3.5). */
  async inventoryReport(): Promise<InventoryReport> {
    const where = { status: PhoneStatus.InStock };
    const [totals, groups] = await Promise.all([
      this.prisma.phone.aggregate({
        where,
        _count: { phoneId: true },
        _sum: { purchasePrice: true, sellingPrice: true },
      }),
      this.prisma.phone.groupBy({
        by: ['brand', 'model'],
        where,
        _count: { phoneId: true },
        _sum: { purchasePrice: true, sellingPrice: true },
        orderBy: [{ brand: 'asc' }, { model: 'asc' }],
      }),
    ]);

    return {
      totalUnits: totals._count.phoneId,
      totalCostValue: Number(totals._sum.purchasePrice ?? 0),
      totalRetailValue: Number(totals._sum.sellingPrice ?? 0),
      byModel: groups.map((g) => ({
        brand: g.brand,
        model: g.model,
        units: g._count.phoneId,
        costValue: Number(g._sum.purchasePrice ?? 0),
        retailValue: Number(g._sum.sellingPrice ?? 0),
      })),
    };
  }

  /** Profit per model, brand, or staff member (Blueprint 3.5) — derived, never re-entered. */
  async profitReport(groupBy?: string): Promise<ProfitReport> {
    const grouping = (groupBy ?? 'model') as ProfitGroupBy;
    if (!['model', 'brand', 'staff'].includes(grouping)) {
      throw new BadRequestException('groupBy must be one of: model, brand, staff');
    }

    // Single-shop volume is small (Blueprint 3.5) — aggregate in memory
    const items = await this.prisma.saleItem.findMany({
      select: {
        sellingPrice: true,
        profit: true,
        quantity: true,
        phone: { select: { brand: true, model: true } },
        product: { select: { name: true, brand: true } },
        sale: { select: { seller: { select: { username: true } } } },
      },
    });

    const keyOf = (item: (typeof items)[number]): string => {
      if (grouping === 'staff') return item.sale.seller.username;
      if (item.phone) {
        return grouping === 'brand' ? item.phone.brand : `${item.phone.brand} ${item.phone.model}`;
      }
      return grouping === 'brand'
        ? (item.product?.brand ?? item.product?.name ?? 'Unknown')
        : (item.product?.name ?? 'Unknown');
    };

    const rows = new Map<string, { key: string; unitsSold: number; revenue: number; profit: number }>();
    for (const item of items) {
      const key = keyOf(item);
      const row = rows.get(key) ?? { key, unitsSold: 0, revenue: 0, profit: 0 };
      row.unitsSold += item.quantity;
      row.revenue += Number(item.sellingPrice) * item.quantity;
      row.profit += Number(item.profit);
      rows.set(key, row);
    }

    return {
      groupBy: grouping,
      rows: [...rows.values()].sort((a, b) => b.profit - a.profit),
    };
  }

  private parseDate(date?: string): Date {
    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    const parsed = date ? new Date(`${date}T00:00:00`) : new Date();
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date: ${date}`);
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
