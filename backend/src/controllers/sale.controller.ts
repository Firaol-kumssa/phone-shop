import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Sale } from '@prisma/client';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../middleware/auth.middleware';
import { RolesGuard } from '../middleware/role.middleware';
import { SaleService } from '../services/sale.service';
import { CreateSaleDto } from '../models/dto/create-sale.dto';
import { ProcessReturnDto } from '../models/dto/process-return.dto';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  @Get()
  findAll(): Promise<Sale[]> {
    return this.saleService.listSales();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Sale> {
    return this.saleService.getSale(id);
  }

  /**
   * Records a sale as ONE atomic transaction (Blueprint 3.2 / 8.2):
   * re-check In Stock → create sale + sale items → set phones to Sold → commit.
   */
  @Post()
  create(
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Sale> {
    return this.saleService.createSale(dto, user.userId);
  }

  /** Return or exchange an item from this sale (Blueprint Part 13), atomically. */
  @Post(':id/return')
  processReturn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Sale> {
    return this.saleService.processReturn(id, dto, user.userId);
  }
}
