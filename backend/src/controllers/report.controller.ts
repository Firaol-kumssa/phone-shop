import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../middleware/auth.middleware';
import { Roles, RolesGuard } from '../middleware/role.middleware';
import {
  InventoryReport,
  ProfitReport,
  ReportService,
  SalesReport,
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
  profit(@Query('groupBy') groupBy?: string): Promise<ProfitReport> {
    return this.reportService.profitReport(groupBy);
  }

  /** Stock counts are visible to all staff (Blueprint 11.2 "View daily stock"). */
  @Get('inventory')
  inventory(): Promise<InventoryReport> {
    return this.reportService.inventoryReport();
  }
}
