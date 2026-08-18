import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** One physical unit received (Blueprint 3.1): IMEI, brand, model, storage, color, purchase price. */
export class PurchaseItemDto {
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

  /** Listed price the phone will be offered at (phones.selling_price is NOT NULL). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  sellingPrice!: number;
}

export class RecordPurchaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  invoiceNumber?: string;

  @IsDateString()
  purchaseDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}
