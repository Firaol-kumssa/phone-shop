import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class SaleItemDto {
  @IsInt()
  @IsPositive()
  phoneId!: number;

  /** Actual negotiated price — recorded instead of the listed price (Blueprint 3.2). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  sellingPrice!: number;
}

/** Non-serialized accessory line: quantity of a product at a unit price. */
export class ProductSaleItemDto {
  @IsInt()
  @IsPositive()
  productId!: number;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  sellingPrice!: number;
}

export class CreateSaleDto {
  /** Optional — walk-in sales are allowed (Blueprint 3.3). */
  @IsOptional()
  @IsInt()
  @IsPositive()
  customerId?: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  /** Serialized phones. A sale needs at least one phone or product line. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items?: SaleItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSaleItemDto)
  productItems?: ProductSaleItemDto[];
}
