import { Injectable } from '@nestjs/common';
import { PaymentMethod, PhoneStatus, ProductStatus, Sale } from '@prisma/client';
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

/** Thrown when a return/exchange precondition fails inside the transaction. */
export class ReturnNotPossibleError extends Error {}

export interface CreateSaleInput {
  customerId?: number;
  paymentMethod: PaymentMethod;
  soldBy: number;
  totalAmount: number;
  items: { phoneId: number; sellingPrice: number; profit: number }[];
  productItems: { productId: number; quantity: number; sellingPrice: number; profit: number }[];
}

export interface ProcessReturnInput {
  saleId: number;
  returned: {
    saleItemId: number;
    phoneId?: number;
    productId?: number;
    quantity: number;
    refundAmount: number;
    profitVoid: number;
  };
  replacement?: {
    phoneId?: number;
    productId?: number;
    quantity: number;
    sellingPrice: number;
    profit: number;
  };
}

@Injectable()
export class SaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Sale[]> {
    return this.prisma.sale.findMany({
      orderBy: { saleDate: 'desc' },
      include: { items: { include: { phone: true, product: true } }, customer: true },
    });
  }

  findById(saleId: number): Promise<Sale | null> {
    return this.prisma.sale.findUnique({
      where: { saleId },
      include: { items: { include: { phone: true, product: true } }, customer: true },
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
          where: {
            productId: item.productId,
            status: ProductStatus.Active,
            quantityInStock: { gte: item.quantity },
          },
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

  /**
   * Return/exchange in ONE atomic transaction (Blueprint Part 13):
   * restore the returned phone/product, void the line's profit, adjust the
   * sale total, and (for exchanges) add the replacement line — all or nothing.
   */
  processReturn(input: ProcessReturnInput): Promise<Sale> {
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.saleItem.findUnique({
        where: { saleItemId: input.returned.saleItemId },
      });
      if (!line || line.saleId !== input.saleId) {
        throw new ReturnNotPossibleError('Sale item not found on this sale');
      }

      if (input.returned.phoneId !== undefined) {
        // Conditional update guards against double-returns; the phone rejoins sellable stock
        const marked = await tx.phone.updateMany({
          where: { phoneId: input.returned.phoneId, status: PhoneStatus.Sold },
          data: { status: PhoneStatus.InStock },
        });
        if (marked.count === 0) {
          throw new ReturnNotPossibleError('Phone is not in Sold state (already returned?)');
        }
        // Zero quantity so units/revenue aggregations exclude the returned phone;
        // profitVoid equals the full line profit, so the decrement zeroes it
        await tx.saleItem.update({
          where: { saleItemId: line.saleItemId },
          data: { profit: { decrement: input.returned.profitVoid }, quantity: 0 },
        });
      } else {
        if (line.quantity < input.returned.quantity) {
          throw new ReturnNotPossibleError('Return quantity exceeds the quantity still on the sale');
        }
        await tx.product.update({
          where: { productId: input.returned.productId },
          data: { quantityInStock: { increment: input.returned.quantity } },
        });
        await tx.saleItem.update({
          where: { saleItemId: line.saleItemId },
          data: {
            quantity: { decrement: input.returned.quantity },
            profit: { decrement: input.returned.profitVoid },
          },
        });
      }

      let totalDelta = -input.returned.refundAmount;

      if (input.replacement) {
        const replacement = input.replacement;
        if (replacement.phoneId !== undefined) {
          const marked = await tx.phone.updateMany({
            where: { phoneId: replacement.phoneId, status: PhoneStatus.InStock },
            data: { status: PhoneStatus.Sold },
          });
          if (marked.count === 0) {
            throw new PhonesUnavailableError([]);
          }
        } else if (replacement.productId !== undefined) {
          const updated = await tx.product.updateMany({
            where: {
              productId: replacement.productId,
              status: ProductStatus.Active,
              quantityInStock: { gte: replacement.quantity },
            },
            data: { quantityInStock: { decrement: replacement.quantity } },
          });
          if (updated.count === 0) {
            throw new ProductsUnavailableError([replacement.productId]);
          }
        }
        await tx.saleItem.create({
          data: {
            saleId: input.saleId,
            phoneId: replacement.phoneId,
            productId: replacement.productId,
            quantity: replacement.quantity,
            sellingPrice: replacement.sellingPrice,
            profit: replacement.profit,
          },
        });
        totalDelta += replacement.sellingPrice * replacement.quantity;
      }

      await tx.sale.update({
        where: { saleId: input.saleId },
        data: { totalAmount: { increment: totalDelta } },
      });

      return tx.sale.findUniqueOrThrow({
        where: { saleId: input.saleId },
        include: { items: { include: { phone: true, product: true } }, customer: true },
      });
    });
  }
}
