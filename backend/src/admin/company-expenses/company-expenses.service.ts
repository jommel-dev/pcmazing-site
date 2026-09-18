import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ensureCompanyExpenseTables } from './company-expenses.schema';
import {
  deleteCompanyExpenseAttachmentFile,
  saveCompanyExpenseAttachmentFile,
} from './company-expense-attachment.util';
import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_EXPENSE_CATEGORY_COLORS,
  COMPANY_EXPENSE_CATEGORY_LABELS,
  CreateCompanyExpenseDto,
  UpdateCompanyExpenseDto,
  type CompanyExpensePaymentMethod,
  type CompanyExpenseStatus,
} from './dto/company-expense.dto';

export { COMPANY_EXPENSE_CATEGORY_COLORS, COMPANY_EXPENSE_CATEGORY_LABELS };

export interface CompanyExpenseAttachmentItem {
  id: number;
  expenseId: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  kind: 'receipt' | 'file';
  createdAt: string;
}

export interface CompanyExpenseItem {
  id: number;
  title: string;
  amount: number;
  expenseDate: string;
  category: string;
  categoryLabel: string;
  vendor: string | null;
  paymentMethod: CompanyExpensePaymentMethod;
  status: CompanyExpenseStatus;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  attachments: CompanyExpenseAttachmentItem[];
  attachmentCount: number;
}

export interface CompanyExpenseCategoryTotal {
  key: string;
  label: string;
  amount: number;
  count: number;
  color: string;
}

export interface CompanyExpenseCategorySuggestion {
  key: string;
  label: string;
  source: 'preset' | 'used';
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
  attachment_count?: string | number | null;
};

type AttachmentRow = {
  id: number;
  expense_id: number;
  file_name: string;
  file_url: string;
  mime_type: string;
  file_size: string | number;
  kind: string;
  created_at: string;
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
      'e.deleted_at IS NULL',
      'e.expense_date >= $1::date',
      'e.expense_date <= $2::date',
    ];

    if (category?.trim()) {
      params.push(this.normalizeCategoryInput(category));
      conditions.push(`e.category = $${params.length}`);
    }

    if (status?.trim() === 'planned' || status?.trim() === 'paid') {
      params.push(status.trim());
      conditions.push(`e.status = $${params.length}`);
    }

    const result = await this.databaseService.query<ExpenseRow>(
      `SELECT e.id, e.title, e.amount::text, e.expense_date::text, e.category, e.vendor,
              e.payment_method, e.status, e.notes, e.created_by, e.created_at, e.updated_at,
              COALESCE(att.attachment_count, 0)::text AS attachment_count
       FROM pcmazing_company_expenses e
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS attachment_count
         FROM pcmazing_company_expense_attachments a
         WHERE a.expense_id = e.id
       ) att ON TRUE
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.expense_date ASC, e.id ASC`,
      params,
    );

    const items = result.rows.map((row) => this.mapRow(row));
    await this.attachAttachmentsToItems(items);
    const amount = this.round(items.reduce((sum, item) => sum + item.amount, 0));
    const paidAmount = this.round(
      items.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0),
    );
    const plannedAmount = this.round(amount - paidAmount);

    const categoryMap = new Map<string, CompanyExpenseCategoryTotal>();
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
      let bucket = categoryMap.get(item.category);
      if (!bucket) {
        bucket = {
          key: item.category,
          label: item.categoryLabel,
          amount: 0,
          count: 0,
          color: this.colorForCategory(item.category),
        };
        categoryMap.set(item.category, bucket);
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

  async listCategorySuggestions(): Promise<CompanyExpenseCategorySuggestion[]> {
    await this.ensureReady();
    const used = await this.databaseService.query<{ category: string; count: string }>(
      `SELECT category, COUNT(*)::text AS count
       FROM pcmazing_company_expenses
       WHERE deleted_at IS NULL
       GROUP BY category
       ORDER BY COUNT(*) DESC, category ASC
       LIMIT 50`,
    );

    const suggestions: CompanyExpenseCategorySuggestion[] = COMPANY_EXPENSE_CATEGORIES.map(
      (key) => ({
        key,
        label: COMPANY_EXPENSE_CATEGORY_LABELS[key],
        source: 'preset' as const,
      }),
    );

    const seen = new Set(suggestions.map((item) => item.key));
    for (const row of used.rows) {
      const key = this.normalizeCategoryInput(row.category);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      suggestions.push({
        key,
        label: this.categoryLabel(key),
        source: 'used',
      });
    }

    return suggestions;
  }

  async getById(id: number): Promise<CompanyExpenseItem> {
    await this.ensureReady();
    const result = await this.databaseService.query<ExpenseRow>(
      `SELECT e.id, e.title, e.amount::text, e.expense_date::text, e.category, e.vendor,
              e.payment_method, e.status, e.notes, e.created_by, e.created_at, e.updated_at,
              COALESCE(att.attachment_count, 0)::text AS attachment_count
       FROM pcmazing_company_expenses e
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS attachment_count
         FROM pcmazing_company_expense_attachments a
         WHERE a.expense_id = e.id
       ) att ON TRUE
       WHERE e.id = $1 AND e.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Company expense ${id} was not found.`);
    }

    const item = this.mapRow(row);
    item.attachments = await this.listAttachments(id);
    item.attachmentCount = item.attachments.length;
    return item;
  }

  async create(dto: CreateCompanyExpenseDto, createdBy?: number): Promise<CompanyExpenseItem> {
    await this.ensureReady();
    const category = this.normalizeCategoryInput(dto.category);
    if (!category) {
      throw new BadRequestException('Category is required.');
    }

    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO pcmazing_company_expenses (
         title, amount, expense_date, category, vendor, payment_method, status, notes, created_by
       ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        dto.title.trim(),
        dto.amount,
        dto.expenseDate,
        category,
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
    const category =
      dto.category === undefined ? null : this.normalizeCategoryInput(dto.category);
    if (dto.category !== undefined && !category) {
      throw new BadRequestException('Category is required.');
    }

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
        category,
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
    for (const attachment of existing.attachments) {
      await deleteCompanyExpenseAttachmentFile(attachment.fileUrl);
    }
    await this.databaseService.query(
      `DELETE FROM pcmazing_company_expense_attachments WHERE expense_id = $1`,
      [id],
    );
    await this.databaseService.query(
      `UPDATE pcmazing_company_expenses
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return existing;
  }

  async uploadAttachment(
    expenseId: number,
    file: Express.Multer.File,
    createdBy?: number,
  ): Promise<CompanyExpenseAttachmentItem> {
    await this.getById(expenseId);
    const saved = await saveCompanyExpenseAttachmentFile(expenseId, file);

    try {
      const result = await this.databaseService.query<AttachmentRow>(
        `INSERT INTO pcmazing_company_expense_attachments (
           expense_id, file_name, file_url, mime_type, file_size, kind, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, expense_id, file_name, file_url, mime_type, file_size, kind, created_at`,
        [
          expenseId,
          file.originalname?.slice(0, 255) || `attachment-${Date.now()}`,
          saved.fileUrl,
          file.mimetype,
          file.size,
          saved.kind,
          createdBy ?? null,
        ],
      );

      return this.mapAttachment(result.rows[0]);
    } catch (error) {
      await deleteCompanyExpenseAttachmentFile(saved.fileUrl);
      throw error;
    }
  }

  async deleteAttachment(expenseId: number, attachmentId: number): Promise<void> {
    await this.getById(expenseId);
    const result = await this.databaseService.query<AttachmentRow>(
      `SELECT id, expense_id, file_name, file_url, mime_type, file_size, kind, created_at
       FROM pcmazing_company_expense_attachments
       WHERE id = $1 AND expense_id = $2
       LIMIT 1`,
      [attachmentId, expenseId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Attachment ${attachmentId} was not found.`);
    }

    await this.databaseService.query(
      `DELETE FROM pcmazing_company_expense_attachments WHERE id = $1 AND expense_id = $2`,
      [attachmentId, expenseId],
    );
    await deleteCompanyExpenseAttachmentFile(row.file_url);
  }

  private async listAttachments(expenseId: number): Promise<CompanyExpenseAttachmentItem[]> {
    const result = await this.databaseService.query<AttachmentRow>(
      `SELECT id, expense_id, file_name, file_url, mime_type, file_size, kind, created_at
       FROM pcmazing_company_expense_attachments
       WHERE expense_id = $1
       ORDER BY created_at DESC, id DESC`,
      [expenseId],
    );
    return result.rows.map((row) => this.mapAttachment(row));
  }

  private async attachAttachmentsToItems(items: CompanyExpenseItem[]): Promise<void> {
    if (!items.length) {
      return;
    }

    const ids = items.map((item) => item.id);
    const result = await this.databaseService.query<AttachmentRow>(
      `SELECT id, expense_id, file_name, file_url, mime_type, file_size, kind, created_at
       FROM pcmazing_company_expense_attachments
       WHERE expense_id = ANY($1::int[])
       ORDER BY created_at DESC, id DESC`,
      [ids],
    );

    const byExpense = new Map<number, CompanyExpenseAttachmentItem[]>();
    for (const row of result.rows) {
      const expenseId = Number(row.expense_id);
      const list = byExpense.get(expenseId) ?? [];
      list.push(this.mapAttachment(row));
      byExpense.set(expenseId, list);
    }

    for (const item of items) {
      const attachments = byExpense.get(item.id) ?? [];
      item.attachments = attachments;
      item.attachmentCount = attachments.length;
    }
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

  normalizeCategoryInput(value: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '';
    }

    const lowered = raw.toLowerCase();
    for (const key of COMPANY_EXPENSE_CATEGORIES) {
      if (key === lowered || COMPANY_EXPENSE_CATEGORY_LABELS[key].toLowerCase() === lowered) {
        return key;
      }
    }
    if (lowered === 'salaries') {
      return 'salary';
    }
    if (lowered === 'utilities') {
      return 'electric_bill';
    }

    const slug = lowered
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
      .slice(0, 80);
    return slug || 'other';
  }

  private categoryLabel(key: string): string {
    if (COMPANY_EXPENSE_CATEGORY_LABELS[key]) {
      return COMPANY_EXPENSE_CATEGORY_LABELS[key];
    }
    return key
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private colorForCategory(key: string): string {
    if (COMPANY_EXPENSE_CATEGORY_COLORS[key]) {
      return COMPANY_EXPENSE_CATEGORY_COLORS[key];
    }
    const palette = ['#94a3b8', '#fb7185', '#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#2dd4bf'];
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash + key.charCodeAt(i) * (i + 1)) % palette.length;
    }
    return palette[hash];
  }

  private mapRow(row: ExpenseRow): CompanyExpenseItem {
    const category = this.normalizeCategoryInput(row.category) || 'salary';
    return {
      id: Number(row.id),
      title: row.title,
      amount: this.toNumber(row.amount),
      expenseDate: String(row.expense_date).slice(0, 10),
      category,
      categoryLabel: this.categoryLabel(category),
      vendor: row.vendor,
      paymentMethod: (row.payment_method as CompanyExpensePaymentMethod) || 'cash',
      status: row.status === 'planned' ? 'planned' : 'paid',
      notes: row.notes,
      createdBy: row.created_by == null ? null : Number(row.created_by),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      attachments: [],
      attachmentCount: this.toNumber(row.attachment_count),
    };
  }

  private mapAttachment(row: AttachmentRow): CompanyExpenseAttachmentItem {
    return {
      id: Number(row.id),
      expenseId: Number(row.expense_id),
      fileName: row.file_name,
      fileUrl: row.file_url,
      mimeType: row.mime_type,
      fileSize: this.toNumber(row.file_size),
      kind: row.kind === 'receipt' ? 'receipt' : 'file',
      createdAt: row.created_at,
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
