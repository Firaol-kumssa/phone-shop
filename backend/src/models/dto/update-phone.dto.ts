import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { PhoneStatus } from '@prisma/client';

/**
 * Editable fields after creation (Blueprint 3.1). IMEI and purchasePrice are
 * locked — the global forbidNonWhitelisted pipe rejects them with 400.
 */
export class UpdatePhoneDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  sellingPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsOptional()
  @IsEnum(PhoneStatus)
  status?: PhoneStatus;
}
