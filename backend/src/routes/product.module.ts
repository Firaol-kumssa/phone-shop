import { Module } from '@nestjs/common';
import { ProductController } from '../controllers/product.controller';
import { ProductService } from '../services/product.service';
import { ProductRepository } from '../repositories/product.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';

@Module({
  controllers: [ProductController],
  providers: [ProductService, ProductRepository, AuditLogRepository],
  exports: [ProductRepository],
})
export class ProductModule {}
