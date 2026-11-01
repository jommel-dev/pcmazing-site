import { IsNumber, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateServiceManualTotalDto {
  /** Null clears the override (back to calculated). */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  amount!: number | null;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  reason!: string;
}
