import { CurrencyPipe, NgClass } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, CompanyExpenseCalendar } from '../../services/admin-api.service';

@Component({
  selector: 'app-company-expenses-widget',
  imports: [CurrencyPipe, NgClass, RouterLink],
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">Operating Expenses</h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ monthLabel() }}
            @if (calendar(); as data) {
              · {{ data.totals.amount | currency: 'PHP':'symbol-narrow':'1.0-0' }}
            }
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200"
            (click)="changeMonth(-1)"
          >
            Prev
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200"
            (click)="changeMonth(1)"
          >
            Next
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="flex h-56 items-center justify-center text-sm text-slate-500">Loading calendar...</div>
      } @else if (error()) {
        <div class="flex h-56 items-center justify-center text-sm text-red-600">{{ error() }}</div>
      } @else {
        <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400">
          <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
        </div>
        <div class="mt-1 grid grid-cols-7 gap-1">
          @for (cell of calendarDays(); track cell.isoDate) {
            <div
              class="min-h-9 rounded-lg border px-1 py-0.5 text-left text-[11px]"
              [class.opacity-30]="!cell.inMonth"
              [ngClass]="
                cell.isToday
                  ? 'border-pcmazing-500 bg-pcmazing-50 dark:border-pcmazing-400 dark:bg-pcmazing-500/20'
                  : 'border-slate-200 dark:border-slate-700'
              "
            >
              <span class="font-semibold text-slate-700 dark:text-slate-200">{{ cell.day }}</span>
              @if (cell.count > 0) {
                <span class="mt-0.5 flex gap-0.5">
                  @for (color of cell.colors; track color) {
                    <span class="size-1.5 rounded-full" [style.background]="color"></span>
                  }
                </span>
              }
            </div>
          }
        </div>
        <div class="mt-4 flex items-center justify-between gap-3">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            @if (calendar(); as data) {
              {{ data.totals.count }}
              {{ data.totals.count === 1 ? 'entry' : 'entries' }}
              this month
            }
          </p>
          <a
            routerLink="/admin/company-expenses"
            class="text-xs font-bold text-pcmazing-600 hover:text-pcmazing-700"
          >
            Open calendar
          </a>
        </div>
      }
    </div>
  `,
})
export class CompanyExpensesWidgetComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly month = signal(this.currentMonth());
  readonly calendar = signal<CompanyExpenseCalendar | null>(null);

  readonly monthLabel = computed(() => {
    const [year, mon] = this.month().split('-').map(Number);
    return new Date(year, mon - 1, 1).toLocaleDateString('en-PH', {
      month: 'long',
      year: 'numeric',
    });
  });

  readonly calendarDays = computed(() => this.buildCalendar(this.month(), this.calendar()));

  ngOnInit(): void {
    void this.load();
  }

  changeMonth(delta: number): void {
    const [year, mon] = this.month().split('-').map(Number);
    const next = new Date(year, mon - 1 + delta, 1);
    this.month.set(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const [year, mon] = this.month().split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    try {
      const response = await firstValueFrom(
        this.adminApi.listCompanyExpenses({
          from: `${this.month()}-01`,
          to: `${this.month()}-${String(lastDay).padStart(2, '0')}`,
        }),
      );
      this.calendar.set(response.data);
    } catch {
      this.calendar.set(null);
      this.error.set('Unable to load expenses.');
    } finally {
      this.loading.set(false);
    }
  }

  private currentMonth(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 7);
  }

  private todayIso(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  }

  private buildCalendar(
    month: string,
    data: CompanyExpenseCalendar | null,
  ): Array<{
    isoDate: string;
    day: number;
    inMonth: boolean;
    isToday: boolean;
    count: number;
    colors: string[];
  }> {
    const [year, mon] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, mon - 1, 1));
    const startWeekday = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const today = this.todayIso();
    const byDate = new Map<string, string[]>();
    const colorByCategory = new Map(
      (data?.categories ?? []).map((item) => [item.key, item.color] as const),
    );
    for (const item of data?.items ?? []) {
      const colors = byDate.get(item.expenseDate) ?? [];
      const color = colorByCategory.get(item.category) ?? '#94a3b8';
      if (!colors.includes(color)) {
        colors.push(color);
      }
      byDate.set(item.expenseDate, colors);
    }

    const cells: Array<{
      isoDate: string;
      day: number;
      inMonth: boolean;
      isToday: boolean;
      count: number;
      colors: string[];
    }> = [];
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startWeekday + 1;
      const date = new Date(Date.UTC(year, mon - 1, dayNum));
      const isoDate = date.toISOString().slice(0, 10);
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
      const colors = inMonth ? (byDate.get(isoDate) ?? []).slice(0, 3) : [];
      cells.push({
        isoDate,
        day: date.getUTCDate(),
        inMonth,
        isToday: isoDate === today,
        count: colors.length,
        colors,
      });
    }
    return cells;
  }
}
