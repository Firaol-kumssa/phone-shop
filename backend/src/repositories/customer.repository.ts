import { Injectable } from '@nestjs/common';
import { Customer } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Customer[]> {
    return this.prisma.customer.findMany();
  }

  findById(customerId: number): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { customerId } });
  }

  /** Purchase history is derived from sales, not stored separately (Blueprint 3.3). */
  findWithPurchaseHistory(customerId: number): Promise<Customer | null> {
    return this.prisma.customer.findUnique({
      where: { customerId },
      include: {
        sales: {
          orderBy: { saleDate: 'desc' },
          include: { items: { include: { phone: true, product: true } } },
        },
      },
    });
  }

  create(data: {
    fullName: string;
    phoneNumber?: string;
    email?: string;
    address?: string;
  }): Promise<Customer> {
    return this.prisma.customer.create({ data });
  }

  update(
    customerId: number,
    data: { fullName?: string; phoneNumber?: string; email?: string; address?: string },
  ): Promise<Customer> {
    return this.prisma.customer.update({ where: { customerId }, data });
  }
}
