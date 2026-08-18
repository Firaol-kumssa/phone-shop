import { Injectable } from '@nestjs/common';
import { PaymentMethod, PhoneStatus, Sale } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';

/** Thrown when a phone stopped being In Stock between selection and commit. */
export class PhonesUnavailableError extends Error {
  constructor(readonly imeis: string[]) {
    super(`Phones no longer In Stock: ${imeis.join(', ') || 'concurrent sale detected'}`);
  }
}

/** Thrown when product stock became insufficient between selection and commit. */
export class ProductsUnavailableError extends Error {
  constructor(readonly productIds: number[]) {
    super('Insufficient product stock — another sale may have just taken it');
  }
}

export interface CreateSaleInput {
  customerId?: number;
  paymentMethod: PaymentMethod;
  soldBy: number;
  totalAmount: number;
  items: { phoneId: number; sellingPrice: number; profit: number }[];
  productItems: { productId: number; quantity: number; sellingPrice: number; profit: number }[];
}

@Injectable()
export class SaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Sale[]> {
    return this.prisma.sale.findMany({ include: { items: true } });
  }

  findById(saleId: number): Promise<Sale | null> {
    return this.prisma.sale.findUnique({
      where: { saleId },
      include: { items: true, customer: true },
    });
  }

  /**
   * ONE atomic transaction (Blueprint 3.2 / 8.2): re-check In Stock, create the
   * Sale header + SaleItems, set phones to Sold, decrement product stock —
   * commit all or nothing.
   */
  createSaleWithItems(input: CreateSaleInput): Promise<Sale> {
    const phoneIds = input.items.map((item) => item.phoneId);

    return this.prisma.$transaction(async (tx) => {
      if (phoneIds.length > 0) {
        const phones = await tx.phone.findMany({
          where: { phoneId: { in: phoneIds } },
          select: { phoneId: true, imei: true, status: true },
        });
        const unavailable = phones.filter((p) => p.status !== PhoneStatus.InStock);
        if (phones.length !== phoneIds.length || unavailable.length > 0) {
          throw new PhonesUnavailableError(unavailable.map((p) => p.imei));
        }
      }

      // Conditional decrement doubles as the stock guard: 0 rows → rollback
      for (const item of input.productItems) {
        const updated = await tx.product.updateMany({
          where: { productId: item.productId, quantityInStock: { gte: item.quantity } },
          data: { quantityInStock: { decrement: item.quantity } },
        });
        if (updated.count === 0) {
          throw new ProductsUnavailableError([item.productId]);
        }
      }

      const sale = await tx.sale.create({
        data: {
          customerId: input.customerId ?? null,
          paymentMethod: input.paymentMethod,
          soldBy: input.soldBy,
          totalAmount: input.totalAmount,
          items: {
            create: [
              ...input.items.map((item) => ({
                phoneId: item.phoneId,
                quantity: 1,
                sellingPrice: item.sellingPrice,
                profit: item.profit,
              })),
              ...input.productItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                sellingPrice: item.sellingPrice,
                profit: item.profit,
              })),
            ],
          },
        },
        include: { items: true },
      });

      if (phoneIds.length > 0) {
        const marked = await tx.phone.updateMany({
          where: { phoneId: { in: phoneIds }, status: PhoneStatus.InStock },
          data: { status: PhoneStatus.Sold },
        });
        if (marked.count !== phoneIds.length) {
          throw new PhonesUnavailableError([]);
        }
      }

      return sale;
    });
  }
}
