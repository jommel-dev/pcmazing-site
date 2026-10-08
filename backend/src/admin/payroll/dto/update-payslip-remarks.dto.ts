import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePayslipRemarksDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks!: string | null;
}
