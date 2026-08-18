import { Module } from '@nestjs/common';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { UserRepository } from '../repositories/user.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';

@Module({
  controllers: [AuthController],
  providers: [AuthService, UserRepository, AuditLogRepository],
})
export class AuthModule {}
