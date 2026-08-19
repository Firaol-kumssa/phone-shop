import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Product, ProductStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../middleware/auth.middleware';
import { Roles, RolesGuard } from '../middleware/role.middleware';
import { ProductService } from '../services/product.service';
import { CreateProductDto, RestockProductDto } from '../models/dto/create-product.dto';

/** Non-serialized accessories — quantity-tracked, no IMEI. */
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll(
    @Query('status', new ParseEnumPipe(ProductStatus, { optional: true }))
    status?: ProductStatus,
  ): Promise<Product[]> {
    return this.productService.listProducts(status);
  }

  @Post()
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Product> {
    return this.productService.createProduct(dto, user.userId);
  }

  /** Adds quantity to an existing product's stock. */
  @Post(':id/restock')
  restock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RestockProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Product> {
    return this.productService.restock(id, dto.quantity, user.userId);
  }

  /** Soft removal from active use — Admin only (Blueprint 11.2). */
  @Patch(':id/discontinue')
  @Roles(UserRole.Admin)
  discontinue(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Product> {
    return this.productService.discontinue(id, user.userId);
  }
}
