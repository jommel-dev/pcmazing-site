import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export const PROJECT_PAYMENT_METHODS = [
  'Cash',
  'Check',
  'Bank Transfer',
  'Wise',
  'PayPal',
] as const;

export type ProjectPaymentMethod = (typeof PROJECT_PAYMENT_METHODS)[number];

export const PROJECT_SETTLEMENT_TYPES = ['partial', 'full'] as const;
export type ProjectSettlementType = (typeof PROJECT_SETTLEMENT_TYPES)[number];

export class SettleProjectPaymentDto {
  @IsDateString()
  date!: string;

  @IsString()
  @IsIn(PROJECT_PAYMENT_METHODS)
  paymentMethod!: ProjectPaymentMethod;

  @IsString()
  @IsIn(PROJECT_SETTLEMENT_TYPES)
  settlementType!: ProjectSettlementType;

  /** Required when settlementType is partial. */
  @ValidateIf((dto: SettleProjectPaymentDto) => dto.settlementType === 'partial')
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  /** Required for Bank Transfer, Wise, PayPal. */
  @ValidateIf((dto: SettleProjectPaymentDto) =>
    ['Bank Transfer', 'Wise', 'PayPal'].includes(dto.paymentMethod),
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  referenceNumber?: string;

  /** Required for Check. */
  @ValidateIf((dto: SettleProjectPaymentDto) => dto.paymentMethod === 'Check')
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  checkNumber?: string;

  /** Required for Check. */
  @ValidateIf((dto: SettleProjectPaymentDto) => dto.paymentMethod === 'Check')
  @IsDateString()
  checkDate?: string;
}
