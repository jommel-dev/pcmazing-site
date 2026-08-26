import { CurrencyPipe, DatePipe, NgClass } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  CompanyExpense,
  CompanyExpenseCalendar,
  CompanyExpenseCategory,
  CompanyExpensePaymentMethod,
  CompanyExpenseStatus,
} from '../../services/admin-api.service';

export const EXPENSE_CATEGORY_OPTIONS: Array<{ value: CompanyExpenseCategory; label: string }> = [
  { value: 'salary', label: 'Salary' },
  { value: 'rent', label: 'Rent' },
  { value: 'electric_bill', label: 'Electric Bill' },
  { value: 'water_bill', label: 'Water Bill' },
  { value: 'internet_bill', label: 'Internet Bill' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'maintenance', label: 'Maintenance' },
];

export const EXPENSE_PAYMENT_OPTIONS: Array<{ value: CompanyExpensePaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

@Component({
  selector: 'app-company-expenses-page',
  imports: [CurrencyPipe, DatePipe, FormsModule, NgClass],
  templateUrl: './company-expenses-page.component.html',
})
export class CompanyExpensesPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly month = signal(this.currentMonth());
  readonly selectedDate = signal(this.todayIso());
  readonly calendar = signal<CompanyExpenseCalendar | null>(null);
  readonly formOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly title = signal('');
  readonly amount = signal<number | null>(null);
  readonly expenseDate = signal(this.todayIso());
  readonly category = signal<CompanyExpenseCategory>('salary');
  readonly vendor = signal('');
  readonly paymentMethod = signal<CompanyExpensePaymentMethod>('cash');
  readonly status = signal<CompanyExpenseStatus>('paid');
  readonly notes = signal('');

  readonly categoryOptions = EXPENSE_CATEGORY_OPTIONS;
  readonly paymentOptions = EXPENSE_PAYMENT_OPTIONS;

  readonly monthLabel = computed(() => {
    const [year, mon] = this.month().split('-').map(Number);
    return new Date(year, mon - 1, 1).toLocaleDateString('en-PH', {
      month: 'long',
      year: 'numeric',
    });
  });

  readonly calendarDays = computed(() => this.buildCalendar(this.month(), this.calendar()));

  readonly selectedDayExpenses = computed(() => {
    const date = this.selectedDate();
    return (this.calendar()?.items ?? []).filter((item) => item.expenseDate === date);
  });

  readonly selectedDayTotal = computed(() =>
    this.selectedDayExpenses().reduce((sum, item) => sum + item.amount, 0),
  );

  readonly isEditing = computed(() => this.editingId() !== null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const { from, to } = this.monthBounds(this.month());
    try {
      const response = await firstValueFrom(
        this.adminApi.listCompanyExpenses({ from, to }),
      );
      this.calendar.set(response.data);
    } catch {
      this.calendar.set(null);
      this.error.set('Unable to load company expenses.');
    } finally {
      this.loading.set(false);
    }
  }

  changeMonth(delta: number): void {
    const [year, mon] = this.month().split('-').map(Number);
    const next = new Date(year, mon - 1 + delta, 1);
    this.month.set(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
    const selected = this.selectedDate();
    if (!selected.startsWith(this.month())) {
      this.selectedDate.set(`${this.month()}-01`);
    }
    void this.load();
  }

  goToToday(): void {
    const today = this.todayIso();
    this.month.set(today.slice(0, 7));
    this.selectedDate.set(today);
    void this.load();
  }

  selectDate(isoDate: string): void {
    this.selectedDate.set(isoDate);
  }

  openCreate(date = this.selectedDate()): void {
    this.editingId.set(null);
    this.formError.set('');
    this.title.set('');
    this.amount.set(null);
    this.expenseDate.set(date);
    this.category.set('salary');
    this.vendor.set('');
    this.paymentMethod.set('cash');
    this.status.set('paid');
    this.notes.set('');
    this.formOpen.set(true);
  }

  openEdit(item: CompanyExpense): void {
    this.editingId.set(item.id);
    this.formError.set('');
    this.title.set(item.title);
    this.amount.set(item.amount);
    this.expenseDate.set(item.expenseDate);
    this.category.set(item.category);
    this.vendor.set(item.vendor ?? '');
    this.paymentMethod.set(item.paymentMethod);
    this.status.set(item.status);
    this.notes.set(item.notes ?? '');
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.formError.set('');
  }

  async save(): Promise<void> {
    const title = this.title().trim();
    const amount = Number(this.amount());
    const expenseDate = this.expenseDate();
    if (!title) {
      this.formError.set('Enter an expense title.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      this.formError.set('Enter a valid amount.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      this.formError.set('Choose an expense date.');
      return;
    }

    this.saving.set(true);
    this.formError.set('');
    const payload = {
      title,
      amount,
      expenseDate,
      category: this.category(),
      vendor: this.vendor().trim(),
      paymentMethod: this.paymentMethod(),
      status: this.status(),
      notes: this.notes().trim(),
    };

    try {
      const editingId = this.editingId();
      if (editingId != null) {
        await firstValueFrom(this.adminApi.updateCompanyExpense(editingId, payload));
      } else {
        await firstValueFrom(this.adminApi.createCompanyExpense(payload));
      }
      this.selectedDate.set(expenseDate);
      this.month.set(expenseDate.slice(0, 7));
      this.closeForm();
      await this.load();
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'error' in error
          ? (error as { error?: { message?: string } }).error?.message
          : null;
      this.formError.set(message || 'Unable to save this expense.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(item: CompanyExpense): Promise<void> {
    if (!confirm(`Remove “${item.title}”? This cannot be undone.`)) {
      return;
    }
    this.deletingId.set(item.id);
    this.error.set('');
    try {
      await firstValueFrom(this.adminApi.deleteCompanyExpense(item.id));
      await this.load();
    } catch {
      this.error.set('Unable to remove this expense.');
    } finally {
      this.deletingId.set(null);
    }
  }

  formatCompact(value: number): string {
    if (value >= 1000) {
      return `₱${Math.round(value).toLocaleString('en-PH')}`;
    }
    return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  private currentMonth(): string {
    return this.todayIso().slice(0, 7);
  }

  private todayIso(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  }

  private monthBounds(month: string): { from: string; to: string } {
    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    return {
      from: `${month}-01`,
      to: `${month}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private buildCalendar(
    month: string,
    data: CompanyExpenseCalendar | null,
  ): Array<{
    isoDate: string;
    day: number;
    inMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    total: number;
    count: number;
    colors: string[];
  }> {
    const [year, mon] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, mon - 1, 1));
    const startWeekday = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const today = this.todayIso();
    const selected = this.selectedDate();
    const byDate = new Map<string, CompanyExpense[]>();
    for (const item of data?.items ?? []) {
      const list = byDate.get(item.expenseDate) ?? [];
      list.push(item);
      byDate.set(item.expenseDate, list);
    }

    const colorByCategory = new Map(
      (data?.categories ?? []).map((item) => [item.key, item.color] as const),
    );

    const cells: Array<{
      isoDate: string;
      day: number;
      inMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      total: number;
      count: number;
      colors: string[];
    }> = [];

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startWeekday + 1;
      const date = new Date(Date.UTC(year, mon - 1, dayNum));
      const isoDate = date.toISOString().slice(0, 10);
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
      const dayItems = inMonth ? (byDate.get(isoDate) ?? []) : [];
      const colors = [...new Set(dayItems.map((item) => colorByCategory.get(item.category) ?? '#94a3b8'))].slice(
        0,
        3,
      );
      cells.push({
        isoDate,
        day: date.getUTCDate(),
        inMonth,
        isToday: isoDate === today,
        isSelected: isoDate === selected,
        total: dayItems.reduce((sum, item) => sum + item.amount, 0),
        count: dayItems.length,
        colors,
      });
    }

    return cells;
  }
}
