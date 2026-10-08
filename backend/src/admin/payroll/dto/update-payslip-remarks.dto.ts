import { IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdatePayslipRemarksDto {
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(5000)
  remarks!: string | null;
}
