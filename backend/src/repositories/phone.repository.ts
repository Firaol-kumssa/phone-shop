import { Injectable } from '@nestjs/common';
import { Phone, PhoneStatus } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class PhoneRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(status?: PhoneStatus): Promise<Phone[]> {
    return this.prisma.phone.findMany({ where: status ? { status } : undefined });
  }

  findById(phoneId: number): Promise<Phone | null> {
    return this.prisma.phone.findUnique({ where: { phoneId } });
  }

  findByImei(imei: string): Promise<Phone | null> {
    return this.prisma.phone.findUnique({ where: { imei } });
  }

  findManyByIds(phoneIds: number[]): Promise<Phone[]> {
    return this.prisma.phone.findMany({ where: { phoneId: { in: phoneIds } } });
  }

  findManyByImeis(imeis: string[]): Promise<Phone[]> {
    return this.prisma.phone.findMany({ where: { imei: { in: imeis } } });
  }

  create(data: {
    imei: string;
    brand: string;
    model: string;
    storage?: string;
    color?: string;
    purchasePrice: number;
    sellingPrice: number;
    supplierId?: number;
  }): Promise<Phone> {
    return this.prisma.phone.create({ data });
  }

  update(
    phoneId: number,
    data: { sellingPrice?: number; color?: string; status?: PhoneStatus },
  ): Promise<Phone> {
    return this.prisma.phone.update({ where: { phoneId }, data });
  }
}
