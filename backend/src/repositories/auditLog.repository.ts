import { Injectable } from '@nestjs/common';
import { AuditLog } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';

export interface AuditEntry {
  userId?: number;
  action: string;
  tableAffected?: string;
  recordId?: string;
  details?: unknown;
}

/** Accountability trail for sensitive actions (Blueprint Part 11.5). */
@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        tableAffected: entry.tableAffected,
        recordId: entry.recordId,
        details: entry.details === undefined ? undefined : JSON.stringify(entry.details),
      },
    });
  }
}
