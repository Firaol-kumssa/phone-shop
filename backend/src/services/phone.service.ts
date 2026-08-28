import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Phone, PhoneStatus, Prisma } from '@prisma/client';
import { PhoneRepository } from '../repositories/phone.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { CreatePhoneDto } from '../models/dto/create-phone.dto';
import { UpdatePhoneDto } from '../models/dto/update-phone.dto';

/** Manual status changes allowed per Blueprint 3.1; Sold only via the Sales Module. */
const ALLOWED_TRANSITIONS: Partial<Record<PhoneStatus, PhoneStatus[]>> = {
  [PhoneStatus.InStock]: [PhoneStatus.Reserved, PhoneStatus.Returned],
};

/**
 * Inventory business rules (Blueprint 3.1):
 * - IMEI must be globally unique.
 * - A phone can never be added without a purchase price; supplier is optional.
 * - IMEI and purchase price are locked after creation (Admin correction flow only).
 * - Status can never be manually set to Sold — only the Sales Module does that.
 * - Phones are never hard-deleted; sale returns restock automatically, and the
 *   manual Returned status remains for damaged/supplier-return units.
 */
@Injectable()
export class PhoneService {
  constructor(
    private readonly phoneRepository: PhoneRepository,
    private readonly auditLogs: AuditLogRepository,
  ) {}

  listPhones(status?: PhoneStatus): Promise<Phone[]> {
    return this.phoneRepository.findAll(status);
  }

  async getPhone(phoneId: number): Promise<Phone> {
    const phone = await this.phoneRepository.findById(phoneId);
    if (!phone) {
      throw new NotFoundException(`Phone ${phoneId} not found`);
    }
    return phone;
  }

  /** Adds a phone with status In Stock; rejects duplicate IMEIs with 409 (Blueprint 3.1 / 8.1). */
  async addPhone(dto: CreatePhoneDto, userId: number): Promise<Phone> {
    const existing = await this.phoneRepository.findByImei(dto.imei);
    if (existing) {
      throw new ConflictException(`A phone with IMEI ${dto.imei} already exists`);
    }

    let phone: Phone;
    try {
      phone = await this.phoneRepository.create({
        imei: dto.imei,
        brand: dto.brand,
        model: dto.model,
        storage: dto.storage,
        color: dto.color,
        purchasePrice: dto.purchasePrice,
        sellingPrice: dto.sellingPrice,
        supplierId: dto.supplierId,
      });
    } catch (error) {
      // DB unique constraint is the backstop against concurrent inserts
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`A phone with IMEI ${dto.imei} already exists`);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException(`Supplier ${dto.supplierId} does not exist`);
      }
      throw error;
    }

    await this.auditLogs.record({
      userId,
      action: 'PHONE_ADDED',
      tableAffected: 'phones',
      recordId: String(phone.phoneId),
      details: { imei: phone.imei, brand: phone.brand, model: phone.model },
    });

    return phone;
  }

  /** Edits per Blueprint 3.1: only sellingPrice, color, and controlled status transitions. */
  async updatePhone(phoneId: number, dto: UpdatePhoneDto, userId: number): Promise<Phone> {
    const phone = await this.phoneRepository.findById(phoneId);
    if (!phone) {
      throw new NotFoundException(`Phone ${phoneId} not found`);
    }

    if (dto.status !== undefined && dto.status !== phone.status) {
      if (dto.status === PhoneStatus.Sold) {
        throw new BadRequestException(
          'Status can never be manually set to Sold — record a sale instead',
        );
      }
      if (!(ALLOWED_TRANSITIONS[phone.status] ?? []).includes(dto.status)) {
        throw new BadRequestException(
          `Status transition ${phone.status} → ${dto.status} is not allowed`,
        );
      }
    }

    // Change set doubles as the audit trail payload
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (dto.sellingPrice !== undefined && dto.sellingPrice !== phone.sellingPrice.toNumber()) {
      changes.sellingPrice = { from: phone.sellingPrice.toNumber(), to: dto.sellingPrice };
    }
    if (dto.color !== undefined && dto.color !== phone.color) {
      changes.color = { from: phone.color, to: dto.color };
    }
    if (dto.status !== undefined && dto.status !== phone.status) {
      changes.status = { from: phone.status, to: dto.status };
    }

    if (Object.keys(changes).length === 0) {
      return phone;
    }

    const updated = await this.phoneRepository.update(phoneId, {
      sellingPrice: dto.sellingPrice,
      color: dto.color,
      status: dto.status,
    });

    await this.auditLogs.record({
      userId,
      action: 'PHONE_UPDATED',
      tableAffected: 'phones',
      recordId: String(phoneId),
      details: { imei: phone.imei, changes },
    });

    return updated;
  }
}
