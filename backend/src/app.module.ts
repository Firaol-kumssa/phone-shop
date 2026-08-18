import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PrismaModule } from './config/prisma.module';
import { AuthModule } from './routes/auth.module';
import { PhoneModule } from './routes/phone.module';
import { SaleModule } from './routes/sale.module';
import { CustomerModule } from './routes/customer.module';
import { SupplierModule } from './routes/supplier.module';
import { ReportModule } from './routes/report.module';
import { ProductModule } from './routes/product.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    PhoneModule,
    SaleModule,
    CustomerModule,
    SupplierModule,
    ReportModule,
    ProductModule,
  ],
})
export class AppModule {}
