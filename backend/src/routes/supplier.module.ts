import { Module } from '@nestjs/common';
import { SupplierController } from '../controllers/supplier.controller';
import { SupplierService } from '../services/supplier.service';
import { SupplierRepository } from '../repositories/supplier.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { PhoneModule } from './phone.module';

@Module({
  imports: [PhoneModule],
  controllers: [SupplierController],
  providers: [SupplierService, SupplierRepository, AuditLogRepository],
  exports: [SupplierRepository],
})
export class SupplierModule {}
