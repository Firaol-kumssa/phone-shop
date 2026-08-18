import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Purchase, Supplier } from '@prisma/client';
import { SupplierRepository } from '../repositories/supplier.repository';
import { PhoneRepository } from '../repositories/phone.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { CreateSupplierDto } from '../models/dto/create-supplier.dto';
import { RecordPurchaseDto } from '../models/dto/record-purchase.dto';

/**
 * Supplier & purchase rules (Blueprint 3.1 / 3.4):
 * recording a purchase atomically creates one Purchase header plus one
 * PurchaseItem and one Phone (status = In Stock) per unit received.
 */
@Injectable()
export class SupplierService {
  constructor(
    private readonly supplierRepository: SupplierRepository,
    private readonly phoneRepository: PhoneRepository,
    private readonly auditLogs: AuditLogRepository,
  ) {}

  listSuppliers(): Promise<Supplier[]> {
    return this.supplierRepository.findAll();
  }

  /** Supplier with purchase history: which phones came from which batch, at what cost (3.4). */
  async getSupplier(supplierId: number): Promise<Supplier> {
    const supplier = await this.supplierRepository.findWithPurchaseHistory(supplierId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }
    return supplier;
  }

  /** Creates a supplier record (Blueprint 3.4): name, contact phone/email, address. */
  createSupplier(dto: CreateSupplierDto): Promise<Supplier> {
    return this.supplierRepository.create({
      name: dto.name,
      phoneNumber: dto.phoneNumber,
      email: dto.email,
      address: dto.address,
    });
  }

  /** Records a delivery per Blueprint 3.1 stage 1; every IMEI must be new to the system. */
  async recordPurchase(
    supplierId: number,
    dto: RecordPurchaseDto,
    createdBy: number,
  ): Promise<Purchase> {
    const supplier = await this.supplierRepository.findById(supplierId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    const imeis = dto.items.map((item) => item.imei);
    if (new Set(imeis).size !== imeis.length) {
      throw new BadRequestException('The same IMEI appears more than once in the delivery');
    }

    // Hard business rule (Blueprint 3.1): an IMEI can only exist once, ever
    const existing = await this.phoneRepository.findManyByImeis(imeis);
    if (existing.length > 0) {
      throw new ConflictException(
        `IMEIs already in the system: ${existing.map((p) => p.imei).join(', ')}`,
      );
    }

    const totalAmount = dto.items.reduce((sum, item) => sum + item.purchasePrice, 0);

    let purchase: Purchase;
    try {
      purchase = await this.supplierRepository.createPurchaseWithItems({
        supplierId,
        invoiceNumber: dto.invoiceNumber,
        purchaseDate: new Date(dto.purchaseDate),
        totalAmount,
        createdBy,
        items: dto.items,
      });
    } catch (error) {
      // unique constraint backstop against a concurrent intake of the same IMEI
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('One or more IMEIs were just added by another user');
      }
      throw error;
    }

    await this.auditLogs.record({
      userId: createdBy,
      action: 'PURCHASE_RECORDED',
      tableAffected: 'purchases',
      recordId: String(purchase.purchaseId),
      details: {
        supplierId,
        invoiceNumber: dto.invoiceNumber ?? null,
        totalAmount,
        units: imeis.length,
      },
    });

    return purchase;
  }
}
