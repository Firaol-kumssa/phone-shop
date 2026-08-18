import { Module } from '@nestjs/common';
import { SaleController } from '../controllers/sale.controller';
import { SaleService } from '../services/sale.service';
import { SaleRepository } from '../repositories/sale.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { PhoneModule } from './phone.module';
import { CustomerModule } from './customer.module';
import { ProductModule } from './product.module';

@Module({
  imports: [PhoneModule, CustomerModule, ProductModule],
  controllers: [SaleController],
  providers: [SaleService, SaleRepository, AuditLogRepository],
  exports: [SaleRepository],
})
export class SaleModule {}
