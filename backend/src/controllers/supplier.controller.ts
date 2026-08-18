import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Purchase, Supplier } from '@prisma/client';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../middleware/auth.middleware';
import { RolesGuard } from '../middleware/role.middleware';
import { SupplierService } from '../services/supplier.service';
import { CreateSupplierDto } from '../models/dto/create-supplier.dto';
import { RecordPurchaseDto } from '../models/dto/record-purchase.dto';

/** Supplier & Purchase process (Blueprint DFD 4.0) — purchases are recorded here. */
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  findAll(): Promise<Supplier[]> {
    return this.supplierService.listSuppliers();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Supplier> {
    return this.supplierService.getSupplier(id);
  }

  @Post()
  create(@Body() dto: CreateSupplierDto): Promise<Supplier> {
    return this.supplierService.createSupplier(dto);
  }

  /**
   * Record a delivery: one Purchase + one PurchaseItem + one Phone per unit,
   * each phone created with status In Stock (Blueprint 3.1).
   */
  @Post(':id/purchases')
  recordPurchase(
    @Param('id', ParseIntPipe) supplierId: number,
    @Body() dto: RecordPurchaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Purchase> {
    return this.supplierService.recordPurchase(supplierId, dto, user.userId);
  }
}
