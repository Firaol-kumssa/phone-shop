import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { Product } from '@prisma/client';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../middleware/auth.middleware';
import { RolesGuard } from '../middleware/role.middleware';
import { ProductService } from '../services/product.service';
import { CreateProductDto, RestockProductDto } from '../models/dto/create-product.dto';

/** Non-serialized accessories — quantity-tracked, no IMEI. */
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll(): Promise<Product[]> {
    return this.productService.listProducts();
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
}
