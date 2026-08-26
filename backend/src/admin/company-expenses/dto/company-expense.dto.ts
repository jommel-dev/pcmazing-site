import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const COMPANY_EXPENSE_CATEGORIES = [
  'salary',
  'rent',
  'electric_bill',
  'water_bill',
  'internet_bill',
  'taxes',
  'maintenance',
] as const;

export type CompanyExpenseCategory = (typeof COMPANY_EXPENSE_CATEGORIES)[number];

export const COMPANY_EXPENSE_CATEGORY_LABELS: Record<CompanyExpenseCategory, string> = {
  salary: 'Salary',
  rent: 'Rent',
  electric_bill: 'Electric Bill',
  water_bill: 'Water Bill',
  internet_bill: 'Internet Bill',
  taxes: 'Taxes',
  maintenance: 'Maintenance',
};

export const COMPANY_EXPENSE_CATEGORY_COLORS: Record<CompanyExpenseCategory, string> = {
  salary: '#64748b',
  rent: '#7c3aed',
  electric_bill: '#f59e0b',
  water_bill: '#0ea5e9',
  internet_bill: '#6366f1',
  taxes: '#ef4444',
  maintenance: '#14b8a6',
};

export const COMPANY_EXPENSE_PAYMENT_METHODS = [
  'cash',
  'bank',
  'gcash',
  'card',
  'other',
] as const;

export type CompanyExpensePaymentMethod = (typeof COMPANY_EXPENSE_PAYMENT_METHODS)[number];

export const COMPANY_EXPENSE_STATUSES = ['planned', 'paid'] as const;

export type CompanyExpenseStatus = (typeof COMPANY_EXPENSE_STATUSES)[number];

export class CreateCompanyExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  amount!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expenseDate!: string;

  @IsIn([...COMPANY_EXPENSE_CATEGORIES])
  category!: CompanyExpenseCategory;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendor?: string;

  @IsOptional()
  @IsIn([...COMPANY_EXPENSE_PAYMENT_METHODS])
  paymentMethod?: CompanyExpensePaymentMethod;

  @IsOptional()
  @IsIn([...COMPANY_EXPENSE_STATUSES])
  status?: CompanyExpenseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateCompanyExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  amount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expenseDate?: string;

  @IsOptional()
  @IsIn([...COMPANY_EXPENSE_CATEGORIES])
  category?: CompanyExpenseCategory;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendor?: string;

  @IsOptional()
  @IsIn([...COMPANY_EXPENSE_PAYMENT_METHODS])
  paymentMethod?: CompanyExpensePaymentMethod;

  @IsOptional()
  @IsIn([...COMPANY_EXPENSE_STATUSES])
  status?: CompanyExpenseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
