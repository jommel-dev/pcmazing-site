import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ensureCompanyExpenseTables } from './company-expenses.schema';
import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_EXPENSE_CATEGORY_COLORS,
  COMPANY_EXPENSE_CATEGORY_LABELS,
  CreateCompanyExpenseDto,
  UpdateCompanyExpenseDto,
  type CompanyExpenseCategory,
  type CompanyExpensePaymentMethod,
  type CompanyExpenseStatus,
} from './dto/company-expense.dto';

export { COMPANY_EXPENSE_CATEGORY_COLORS, COMPANY_EXPENSE_CATEGORY_LABELS };

export interface CompanyExpenseItem {
  id: number;
  title: string;
  amount: number;
  expenseDate: string;
  category: CompanyExpenseCategory;
  categoryLabel: string;
  vendor: string | null;
  paymentMethod: CompanyExpensePaymentMethod;
  status: CompanyExpenseStatus;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyExpenseCategoryTotal {
  key: CompanyExpenseCategory;
  label: string;
  amount: number;
  count: number;
  color: string;
}

export interface CompanyExpenseCalendar {
  items: CompanyExpenseItem[];
  totals: {
    amount: number;
    paidAmount: number;
    plannedAmount: number;
    count: number;
  };
  categories: CompanyExpenseCategoryTotal[];
  range: { from: string; to: string };
}

type ExpenseRow = {
  id: number;
  title: string;
  amount: string | number;
  expense_date: string;
  category: string;
  vendor: string | null;
  payment_method: string;
  status: string;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class CompanyExpensesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async ensureReady(): Promise<void> {
    await ensureCompanyExpenseTables(this.databaseService);
  }

  async listCalendar(from?: string, to?: string, category?: string, status?: string) {
    await this.ensureReady();
    const range = this.resolveRange(from, to);
    const params: unknown[] = [range.from, range.to];
    const conditions = [
      'deleted_at IS NULL',
      'expense_date >= $1::date',
      'expense_date <= $2::date',
    ];

    if (category?.trim() && this.isCategory(category.trim())) {
      params.push(category.trim());
      conditions.push(`category = $${params.length}`);
    }

    if (status?.trim() === 'planned' || status?.trim() === 'paid') {
      params.push(status.trim());
      conditions.push(`status = $${params.length}`);
    }

    const result = await this.databaseService.query<ExpenseRow>(
      `SELECT id, title, amount::text, expense_date::text, category, vendor,
              payment_method, status, notes, created_by, created_at, updated_at
       FROM pcmazing_company_expenses
       WHERE ${conditions.join(' AND ')}
       ORDER BY expense_date ASC, id ASC`,
      params,
    );

    const items = result.rows.map((row) => this.mapRow(row));
    const amount = this.round(items.reduce((sum, item) => sum + item.amount, 0));
    const paidAmount = this.round(
      items.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0),
    );
    const plannedAmount = this.round(amount - paidAmount);

    const categoryMap = new Map<CompanyExpenseCategory, CompanyExpenseCategoryTotal>();
    for (const key of COMPANY_EXPENSE_CATEGORIES) {
      categoryMap.set(key, {
        key,
        label: COMPANY_EXPENSE_CATEGORY_LABELS[key],
        amount: 0,
        count: 0,
        color: COMPANY_EXPENSE_CATEGORY_COLORS[key],
      });
    }
    for (const item of items) {
      const bucket = categoryMap.get(item.category);
      if (!bucket) {
        continue;
      }
      bucket.amount = this.round(bucket.amount + item.amount);
      bucket.count += 1;
    }

    return {
      items,
      totals: {
        amount,
        paidAmount,
        plannedAmount,
        count: items.length,
      },
      categories: [...categoryMap.values()].filter((item) => item.count > 0),
      range,
    } satisfies CompanyExpenseCalendar;
  }

  async getById(id: number): Promise<CompanyExpenseItem> {
    await this.ensureReady();
    const result = await this.databaseService.query<ExpenseRow>(
      `SELECT id, title, amount::text, expense_date::text, category, vendor,
              payment_method, status, notes, created_by, created_at, updated_at
       FROM pcmazing_company_expenses
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Company expense ${id} was not found.`);
    }

    return this.mapRow(row);
  }

  async create(dto: CreateCompanyExpenseDto, createdBy?: number): Promise<CompanyExpenseItem> {
    await this.ensureReady();
    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO pcmazing_company_expenses (
         title, amount, expense_date, category, vendor, payment_method, status, notes, created_by
       ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        dto.title.trim(),
        dto.amount,
        dto.expenseDate,
        dto.category,
        dto.vendor?.trim() || null,
        dto.paymentMethod ?? 'cash',
        dto.status ?? 'paid',
        dto.notes?.trim() || null,
        createdBy ?? null,
      ],
    );

    return this.getById(result.rows[0].id);
  }

  async update(id: number, dto: UpdateCompanyExpenseDto): Promise<CompanyExpenseItem> {
    await this.getById(id);
    await this.databaseService.query(
      `UPDATE pcmazing_company_expenses
       SET title = COALESCE($2, title),
           amount = COALESCE($3, amount),
           expense_date = COALESCE($4::date, expense_date),
           category = COALESCE($5, category),
           vendor = CASE WHEN $6::boolean THEN $7 ELSE vendor END,
           payment_method = COALESCE($8, payment_method),
           status = COALESCE($9, status),
           notes = CASE WHEN $10::boolean THEN $11 ELSE notes END,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [
        id,
        dto.title?.trim() ?? null,
        dto.amount ?? null,
        dto.expenseDate ?? null,
        dto.category ?? null,
        dto.vendor !== undefined,
        dto.vendor === undefined ? null : dto.vendor.trim() || null,
        dto.paymentMethod ?? null,
        dto.status ?? null,
        dto.notes !== undefined,
        dto.notes === undefined ? null : dto.notes.trim() || null,
      ],
    );

    return this.getById(id);
  }

  async remove(id: number): Promise<CompanyExpenseItem> {
    const existing = await this.getById(id);
    await this.databaseService.query(
      `UPDATE pcmazing_company_expenses
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return existing;
  }

  private resolveRange(from?: string, to?: string): { from: string; to: string } {
    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return from <= to ? { from, to } : { from: to, to: from };
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      from: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      to: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private isCategory(value: string): value is CompanyExpenseCategory {
    return (COMPANY_EXPENSE_CATEGORIES as readonly string[]).includes(value);
  }

  private normalizeCategory(value: string): CompanyExpenseCategory {
    if (this.isCategory(value)) {
      return value;
    }
    if (value === 'salaries') {
      return 'salary';
    }
    if (value === 'utilities') {
      return 'electric_bill';
    }
    return 'salary';
  }

  private mapRow(row: ExpenseRow): CompanyExpenseItem {
    const category = this.normalizeCategory(row.category);
    return {
      id: Number(row.id),
      title: row.title,
      amount: this.toNumber(row.amount),
      expenseDate: String(row.expense_date).slice(0, 10),
      category,
      categoryLabel: COMPANY_EXPENSE_CATEGORY_LABELS[category],
      vendor: row.vendor,
      paymentMethod: (row.payment_method as CompanyExpensePaymentMethod) || 'cash',
      status: row.status === 'planned' ? 'planned' : 'paid',
      notes: row.notes,
      createdBy: row.created_by == null ? null : Number(row.created_by),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
