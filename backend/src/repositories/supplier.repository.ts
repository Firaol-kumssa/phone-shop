import { Injectable } from '@nestjs/common';
import { Purchase, Supplier } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';

export interface PurchaseItemInput {
  imei: string;
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  purchasePrice: number;
  sellingPrice: number;
}

export interface CreatePurchaseInput {
  supplierId: number;
  invoiceNumber?: string;
  purchaseDate: Date;
  totalAmount: number;
  createdBy: number;
  items: PurchaseItemInput[];
}

@Injectable()
export class SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Supplier[]> {
    return this.prisma.supplier.findMany();
  }

  findById(supplierId: number): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({ where: { supplierId } });
  }

  findWithPurchaseHistory(supplierId: number): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({
      where: { supplierId },
      include: {
        purchases: {
          orderBy: { purchaseDate: 'desc' },
          include: { items: { include: { phone: true } } },
        },
      },
    });
  }

  create(data: {
    name: string;
    phoneNumber?: string;
    email?: string;
    address?: string;
  }): Promise<Supplier> {
    return this.prisma.supplier.create({ data });
  }

  /**
   * ONE atomic transaction (Blueprint 3.1 stage 1): Purchase header + one
   * PurchaseItem and one Phone (status defaults to In Stock) per unit received.
   */
  createPurchaseWithItems(input: CreatePurchaseInput): Promise<Purchase> {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          supplierId: input.supplierId,
          invoiceNumber: input.invoiceNumber,
          purchaseDate: input.purchaseDate,
          totalAmount: input.totalAmount,
          createdBy: input.createdBy,
        },
      });

      for (const item of input.items) {
        // phones.purchase_price is the deliberate denormalized copy (Blueprint 5.2)
        const phone = await tx.phone.create({
          data: {
            imei: item.imei,
            brand: item.brand,
            model: item.model,
            storage: item.storage,
            color: item.color,
            purchasePrice: item.purchasePrice,
            sellingPrice: item.sellingPrice,
            supplierId: input.supplierId,
          },
        });
        await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.purchaseId,
            phoneId: phone.phoneId,
            purchasePrice: item.purchasePrice,
          },
        });
      }

      return tx.purchase.findUniqueOrThrow({
        where: { purchaseId: purchase.purchaseId },
        include: { items: { include: { phone: true } } },
      });
    });
  }
}
