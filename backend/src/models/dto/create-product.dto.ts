import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

/** Non-serialized accessory — no IMEI, tracked by quantity. */
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  brand?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  costPrice!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  sellingPrice!: number;

  @IsInt()
  @Min(0)
  quantity!: number;
}

export class RestockProductDto {
  @IsInt()
  @IsPositive()
  quantity!: number;
}
