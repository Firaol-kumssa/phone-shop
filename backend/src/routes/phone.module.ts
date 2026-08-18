import { Module } from '@nestjs/common';
import { PhoneController } from '../controllers/phone.controller';
import { PhoneService } from '../services/phone.service';
import { PhoneRepository } from '../repositories/phone.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';

@Module({
  controllers: [PhoneController],
  providers: [PhoneService, PhoneRepository, AuditLogRepository],
  exports: [PhoneRepository],
})
export class PhoneModule {}
