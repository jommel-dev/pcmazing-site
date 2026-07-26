import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CLIENT_TYPES, SUPPORTED_CURRENCIES } from '../prospect-deal.util';

export class ProspectDealFieldsDto {
  @IsOptional()
  @IsIn([...CLIENT_TYPES])
  clientType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  @IsIn([...SUPPORTED_CURRENCIES])
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  proposedPriceDeal?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPercent?: number | null;
}
