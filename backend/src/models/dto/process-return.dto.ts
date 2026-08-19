import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, ValidateNested } from 'class-validator';

export class ReplacementItemDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  phoneId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  productId?: number;

  /** Product replacements only; defaults to 1. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  sellingPrice!: number;
}

/** Returns/exchange workflow (Blueprint Part 13). Exactly one of phoneId/productId. */
export class ProcessReturnDto {
  @IsIn(['return', 'exchange'])
  mode!: 'return' | 'exchange';

  @IsOptional()
  @IsInt()
  @IsPositive()
  phoneId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  productId?: number;

  /** Product returns only; defaults to 1. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReplacementItemDto)
  replacement?: ReplacementItemDto;
}
