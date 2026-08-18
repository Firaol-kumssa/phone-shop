import { Injectable } from '@nestjs/common';
import { Product } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Product[]> {
    return this.prisma.product.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  findById(productId: number): Promise<Product | null> {
    return this.prisma.product.findUnique({ where: { productId } });
  }

  findManyByIds(productIds: number[]): Promise<Product[]> {
    return this.prisma.product.findMany({ where: { productId: { in: productIds } } });
  }

  create(data: {
    name: string;
    category: string;
    brand?: string;
    costPrice: number;
    sellingPrice: number;
    quantityInStock: number;
  }): Promise<Product> {
    return this.prisma.product.create({ data });
  }

  incrementStock(productId: number, quantity: number): Promise<Product> {
    return this.prisma.product.update({
      where: { productId },
      data: { quantityInStock: { increment: quantity } },
    });
  }
}
