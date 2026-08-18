import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** Manual phone intake (Blueprint 3.1) — supplier and purchase price are mandatory. */
export class CreatePhoneDto {
  @Matches(/^\d{14,16}$/, { message: 'imei must be 14-16 digits' })
  imei!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  brand!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  storage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  purchasePrice!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  sellingPrice!: number;

  @IsInt()
  @IsPositive()
  supplierId!: number;
}
