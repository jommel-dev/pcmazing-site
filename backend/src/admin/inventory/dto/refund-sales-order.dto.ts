import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RefundSalesOrderItemDto {
  @IsInt()
  @Min(1)
  itemId!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  quantity!: number;
}

export class RefundSalesOrderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  refundReason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RefundSalesOrderItemDto)
  items!: RefundSalesOrderItemDto[];
}
