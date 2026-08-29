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
  phones: { units: number; costValue: number; retailValue: number };
  products: { units: number; costValue: number; retailValue: number };
  byModel: {
    brand: string;
    model: string;
    units: number;
    costValue: number;
    retailValue: number;
  }[];
  byProduct: {
    name: string;
    category: string;
    units: number;
    costValue: number;
    retailValue: number;
  }[];
}

export interface SalesSplit {
  phones: { units: number; revenue: number; profit: number };
  products: { units: number; revenue: number; profit: number };
}

export interface ReturnsReport {
  totalReturns: number;
  totalRefunded: number;
  totalProfitVoided: number;
  rows: {
    date: string;
    saleId: number;
    mode: 'return' | 'exchange';
    item: string;
    quantity: number;
    /** Unit price the item originally sold for. */
    soldFor: number;
    refundAmount: number;
    replacement: string | null;
    /** Total price of the replacement line (exchanges only). */
    replacementPrice: number | null;
    staff: string;
  }[];
}

export type ProfitGroupBy = 'model' | 'brand' | 'staff';

export interface ProfitReport {
  groupBy: ProfitGroupBy;
  /** null = all-time */
  from: string | null;
  to: string | null;
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
    const range = this.periodRange('daily', date);
    return this.salesReport(range.from, range.to);
  }

  /** Week starts Monday; `date` may be any day within the week. */
  weeklyReport(date?: string): Promise<SalesReport> {
    const range = this.periodRange('weekly', date);
    return this.salesReport(range.from, range.to);
  }

  monthlyReport(month?: string): Promise<SalesReport> {
    const range = this.periodRange('monthly', month);
    return this.salesReport(range.from, range.to);
  }

  /** [from, to) for a daily/weekly/monthly bucket containing `param` (defaults to today). */
  private periodRange(period: 'daily' | 'weekly' | 'monthly', param?: string): { from: Date; to: Date } {
    if (period === 'monthly') {
      if (param !== undefined && !/^\d{4}-\d{2}$/.test(param)) {
        throw new BadRequestException('month must be YYYY-MM');
      }
      const now = new Date();
      const [year, mon] = param
        ? param.split('-').map(Number)
        : [now.getFullYear(), now.getMonth() + 1];
      return { from: new Date(year, mon - 1, 1), to: new Date(year, mon, 1) };
    }
    const day = this.parseDate(param);
    if (period === 'daily') {
      return { from: day, to: this.addDays(day, 1) };
    }
    const monday = this.addDays(day, -((day.getDay() + 6) % 7));
    return { from: monday, to: this.addDays(monday, 7) };
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

  /** Last `count` periods, oldest first — same shared query per bucket (Blueprint 3.5). */
  async salesSeries(period?: string, count = 7): Promise<SalesReport[]> {
    const grouping = period ?? 'daily';
    if (!['daily', 'weekly', 'monthly'].includes(grouping)) {
      throw new BadRequestException('period must be one of: daily, weekly, monthly');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ranges: { from: Date; to: Date }[] = [];

    if (grouping === 'daily') {
      for (let i = count - 1; i >= 0; i--) {
        const from = this.addDays(today, -i);
        ranges.push({ from, to: this.addDays(from, 1) });
      }
    } else if (grouping === 'weekly') {
      const monday = this.addDays(today, -((today.getDay() + 6) % 7));
      for (let i = count - 1; i >= 0; i--) {
        const from = this.addDays(monday, -7 * i);
        ranges.push({ from, to: this.addDays(from, 7) });
      }
    } else {
      for (let i = count - 1; i >= 0; i--) {
        ranges.push({
          from: new Date(today.getFullYear(), today.getMonth() - i, 1),
          to: new Date(today.getFullYear(), today.getMonth() - i + 1, 1),
        });
      }
    }

    return Promise.all(ranges.map((range) => this.salesReport(range.from, range.to)));
  }

  /** All-time revenue/profit split between serialized phones and products. */
  async salesSplit(): Promise<SalesSplit> {
    const items = await this.prisma.saleItem.findMany({
      select: { sellingPrice: true, profit: true, quantity: true, phoneId: true },
    });

    const split: SalesSplit = {
      phones: { units: 0, revenue: 0, profit: 0 },
      products: { units: 0, revenue: 0, profit: 0 },
    };
    for (const item of items) {
      const bucket = item.phoneId !== null ? split.phones : split.products;
      bucket.units += item.quantity;
      bucket.revenue += Number(item.sellingPrice) * item.quantity;
      bucket.profit += Number(item.profit);
    }
    return split;
  }

  /** Count and value of everything in stock — phones by model, products by item (Blueprint 3.5). */
  async inventoryReport(): Promise<InventoryReport> {
    const where = { status: PhoneStatus.InStock };
    const [totals, groups, stockedProducts] = await Promise.all([
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
      this.prisma.product.findMany({
        where: { quantityInStock: { gt: 0 } },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const phones = {
      units: totals._count.phoneId,
      costValue: Number(totals._sum.purchasePrice ?? 0),
      retailValue: Number(totals._sum.sellingPrice ?? 0),
    };

    // Aggregates can't multiply price × quantity — single-shop volume, compute in memory
    const byProduct = stockedProducts.map((p) => ({
      name: p.name,
      category: p.category,
      units: p.quantityInStock,
      costValue: p.costPrice.toNumber() * p.quantityInStock,
      retailValue: p.sellingPrice.toNumber() * p.quantityInStock,
    }));
    const products = byProduct.reduce(
      (acc, row) => ({
        units: acc.units + row.units,
        costValue: acc.costValue + row.costValue,
        retailValue: acc.retailValue + row.retailValue,
      }),
      { units: 0, costValue: 0, retailValue: 0 },
    );

    return {
      totalUnits: phones.units + products.units,
      totalCostValue: phones.costValue + products.costValue,
      totalRetailValue: phones.retailValue + products.retailValue,
      phones,
      products,
      byModel: groups.map((g) => ({
        brand: g.brand,
        model: g.model,
        units: g._count.phoneId,
        costValue: Number(g._sum.purchasePrice ?? 0),
        retailValue: Number(g._sum.sellingPrice ?? 0),
      })),
      byProduct,
    };
  }

  /** Profit per model, brand, or staff member (Blueprint 3.5) — derived, never re-entered.
   *  Optionally scoped to a daily/weekly/monthly bucket; all-time when period is omitted. */
  async profitReport(groupBy?: string, period?: string, param?: string): Promise<ProfitReport> {
    const grouping = (groupBy ?? 'model') as ProfitGroupBy;
    if (!['model', 'brand', 'staff'].includes(grouping)) {
      throw new BadRequestException('groupBy must be one of: model, brand, staff');
    }
    let range: { from: Date; to: Date } | null = null;
    if (period !== undefined && period !== 'all') {
      if (!['daily', 'weekly', 'monthly'].includes(period)) {
        throw new BadRequestException('period must be one of: all, daily, weekly, monthly');
      }
      range = this.periodRange(period as 'daily' | 'weekly' | 'monthly', param);
    }

    // Single-shop volume is small (Blueprint 3.5) — aggregate in memory
    const items = await this.prisma.saleItem.findMany({
      where: range ? { sale: { saleDate: { gte: range.from, lt: range.to } } } : undefined,
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
      from: range?.from.toISOString() ?? null,
      to: range?.to.toISOString() ?? null,
      rows: [...rows.values()].sort((a, b) => b.profit - a.profit),
    };
  }

  /** What got returned in [from, to) — derived from the RETURN_PROCESSED audit trail. */
  async returnsReport(from?: string, to?: string): Promise<ReturnsReport> {
    const range: { gte?: Date; lt?: Date } = {};
    for (const [key, value] of [['gte', from], ['lt', to]] as const) {
      if (value !== undefined) {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException(`Invalid date: ${value}`);
        }
        range[key] = parsed;
      }
    }

    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: 'RETURN_PROCESSED',
        ...(range.gte || range.lt ? { createdAt: range } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { username: true } } },
    });

    interface ReturnDetails {
      mode?: string;
      returned?: {
        phoneId: number | null;
        productId: number | null;
        quantity: number;
        refundAmount: number;
        profitVoided: number;
      };
      replacement?: {
        phoneId: number | null;
        productId: number | null;
        quantity: number;
        sellingPrice: number;
      } | null;
    }
    const parsed = logs.map((log) => ({
      log,
      details: JSON.parse(log.details ?? '{}') as ReturnDetails,
    }));

    const phoneIds = new Set<number>();
    const productIds = new Set<number>();
    for (const { details } of parsed) {
      for (const ref of [details.returned, details.replacement]) {
        if (ref?.phoneId != null) phoneIds.add(ref.phoneId);
        if (ref?.productId != null) productIds.add(ref.productId);
      }
    }

    const [phones, products] = await Promise.all([
      phoneIds.size > 0
        ? this.prisma.phone.findMany({
            where: { phoneId: { in: [...phoneIds] } },
            select: { phoneId: true, imei: true, brand: true, model: true },
          })
        : [],
      productIds.size > 0
        ? this.prisma.product.findMany({
            where: { productId: { in: [...productIds] } },
            select: { productId: true, name: true },
          })
        : [],
    ]);
    const phoneById = new Map(phones.map((p) => [p.phoneId, p]));
    const productById = new Map(products.map((p) => [p.productId, p]));

    const label = (ref: { phoneId: number | null; productId: number | null }): string => {
      if (ref.phoneId != null) {
        const phone = phoneById.get(ref.phoneId);
        return phone ? `${phone.brand} ${phone.model} (${phone.imei})` : `Phone #${ref.phoneId}`;
      }
      const product = ref.productId != null ? productById.get(ref.productId) : undefined;
      return product?.name ?? `Product #${ref.productId}`;
    };

    const rows = parsed
      .filter(({ details }) => details.returned)
      .map(({ log, details }) => ({
        date: log.createdAt.toISOString(),
        saleId: Number(log.recordId),
        mode: (details.mode === 'exchange' ? 'exchange' : 'return') as 'return' | 'exchange',
        item: label(details.returned!),
        quantity: details.returned!.quantity,
        soldFor:
          details.returned!.quantity > 0
            ? details.returned!.refundAmount / details.returned!.quantity
            : details.returned!.refundAmount,
        refundAmount: details.returned!.refundAmount,
        replacement: details.replacement ? label(details.replacement) : null,
        replacementPrice: details.replacement
          ? details.replacement.sellingPrice * details.replacement.quantity
          : null,
        staff: log.user?.username ?? 'unknown',
      }));

    return {
      totalReturns: rows.length,
      totalRefunded: rows.reduce((sum, row) => sum + row.refundAmount, 0),
      totalProfitVoided: parsed.reduce(
        (sum, { details }) => sum + (details.returned?.profitVoided ?? 0),
        0,
      ),
      rows,
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
