import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../middleware/auth.middleware';
import { Roles, RolesGuard } from '../middleware/role.middleware';
import {
  InventoryReport,
  ProfitReport,
  ReportService,
  ReturnsReport,
  SalesReport,
  SalesSplit,
} from '../services/report.service';

/** Read-only views computed on demand (Blueprint 3.5). Financial reports are Admin-only (11.2). */
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('daily')
  @Roles(UserRole.Admin)
  daily(@Query('date') date?: string): Promise<SalesReport> {
    return this.reportService.dailyReport(date);
  }

  @Get('weekly')
  @Roles(UserRole.Admin)
  weekly(@Query('date') date?: string): Promise<SalesReport> {
    return this.reportService.weeklyReport(date);
  }

  @Get('monthly')
  @Roles(UserRole.Admin)
  monthly(@Query('month') month?: string): Promise<SalesReport> {
    return this.reportService.monthlyReport(month);
  }

  @Get('profit')
  @Roles(UserRole.Admin)
  profit(
    @Query('groupBy') groupBy?: string,
    @Query('period') period?: string,
    @Query('date') date?: string,
    @Query('month') month?: string,
  ): Promise<ProfitReport> {
    return this.reportService.profitReport(groupBy, period, period === 'monthly' ? month : date);
  }

  /** Last 7 buckets of the given period, oldest first — feeds the revenue/profit chart. */
  @Get('series')
  @Roles(UserRole.Admin)
  series(@Query('period') period?: string): Promise<SalesReport[]> {
    return this.reportService.salesSeries(period);
  }

  /** Revenue/profit split between phones and products — feeds the pie chart. */
  @Get('split')
  @Roles(UserRole.Admin)
  split(): Promise<SalesSplit> {
    return this.reportService.salesSplit();
  }

  /** Everything returned or exchanged in [from, to), derived from the audit trail. */
  @Get('returns')
  @Roles(UserRole.Admin)
  returns(@Query('from') from?: string, @Query('to') to?: string): Promise<ReturnsReport> {
    return this.reportService.returnsReport(from, to);
  }

  /** Stock counts are visible to all staff (Blueprint 11.2 "View daily stock"). */
  @Get('inventory')
  inventory(): Promise<InventoryReport> {
    return this.reportService.inventoryReport();
  }
}
