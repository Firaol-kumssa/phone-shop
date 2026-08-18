import { Injectable, NotFoundException } from '@nestjs/common';
import { Product } from '@prisma/client';
import { ProductRepository } from '../repositories/product.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { CreateProductDto } from '../models/dto/create-product.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly auditLogs: AuditLogRepository,
  ) {}

  listProducts(): Promise<Product[]> {
    return this.productRepository.findAll();
  }

  async createProduct(dto: CreateProductDto, userId: number): Promise<Product> {
    const product = await this.productRepository.create({
      name: dto.name,
      category: dto.category,
      brand: dto.brand,
      costPrice: dto.costPrice,
      sellingPrice: dto.sellingPrice,
      quantityInStock: dto.quantity,
    });

    await this.auditLogs.record({
      userId,
      action: 'PRODUCT_ADDED',
      tableAffected: 'products',
      recordId: String(product.productId),
      details: { name: product.name, category: product.category, quantity: dto.quantity },
    });

    return product;
  }

  async restock(productId: number, quantity: number, userId: number): Promise<Product> {
    const existing = await this.productRepository.findById(productId);
    if (!existing) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const product = await this.productRepository.incrementStock(productId, quantity);

    await this.auditLogs.record({
      userId,
      action: 'PRODUCT_RESTOCKED',
      tableAffected: 'products',
      recordId: String(productId),
      details: { name: product.name, added: quantity, newQuantity: product.quantityInStock },
    });

    return product;
  }
}
