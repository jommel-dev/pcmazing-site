import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import {
  AdminApiService,
  PaginationMeta,
  PayrollAttendanceItem,
  PayrollEmployeeItem,
  PayrollOverview,
  PayrollPeriodItem,
  PayrollPeriodMeta,
} from '../../services/admin-api.service';

type PayrollTab = 'overview' | 'attendance' | 'employees' | 'period';

@Component({
  selector: 'app-payroll-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './payroll-page.component.html',
})
export class PayrollPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly selfieModal = signal<{ url: string; label: string } | null>(null);

  readonly tabs: Array<{ key: PayrollTab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'employees', label: 'Employees' },
    { key: 'period', label: 'Period pay' },
  ];

  readonly activeTab = signal<PayrollTab>('overview');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly copyMessage = signal('');

  readonly overview = signal<PayrollOverview | null>(null);
  readonly attendance = signal<PayrollAttendanceItem[]>([]);
  readonly attendanceMeta = signal<PaginationMeta | null>(null);
  readonly workDate = signal('');
  readonly attendancePage = signal(1);

  readonly employees = signal<PayrollEmployeeItem[]>([]);
  readonly employeeSearch = signal('');

  readonly periodItems = signal<PayrollPeriodItem[]>([]);
  readonly periodMeta = signal<PayrollPeriodMeta | null>(null);
  readonly dateFrom = signal('');
  readonly dateTo = signal('');

  readonly timeClockUrl = `${APP_CONFIG.publicSiteUrl.replace(/\/$/, '')}/time-clock`;

  ngOnInit(): void {
    const today = this.manilaToday();
    this.workDate.set(today);
    this.dateTo.set(today);
    this.dateFrom.set(`${today.slice(0, 8)}01`);
    void this.loadActiveTab();
  }

  async setTab(tab: PayrollTab): Promise<void> {
    this.activeTab.set(tab);
    await this.loadActiveTab();
  }

  async loadActiveTab(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      switch (this.activeTab()) {
        case 'overview':
          await this.loadOverview();
          break;
        case 'attendance':
          await this.loadAttendance();
          break;
        case 'employees':
          await this.loadEmployees();
          break;
        case 'period':
          await this.loadPeriod();
          break;
      }
    } catch {
      this.error.set('Unable to load payroll data.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadOverview(): Promise<void> {
    const response = await firstValueFrom(this.adminApi.getPayrollOverview(this.workDate()));
    this.overview.set(response.data);
    this.workDate.set(response.data.workDate);
  }

  private async loadAttendance(): Promise<void> {
    const response = await firstValueFrom(
      this.adminApi.listPayrollAttendance(this.attendancePage(), 50, this.workDate()),
    );
    this.attendance.set(response.data);
    this.attendanceMeta.set(response.meta);
    this.workDate.set(response.workDate);
  }

  private async loadEmployees(): Promise<void> {
    const response = await firstValueFrom(
      this.adminApi.listPayrollEmployees(this.employeeSearch()),
    );
    this.employees.set(response.data);
  }

  private async loadPeriod(): Promise<void> {
    const response = await firstValueFrom(
      this.adminApi.getPayrollPeriod(this.dateFrom(), this.dateTo()),
    );
    this.periodItems.set(response.data);
    this.periodMeta.set(response.meta);
    this.dateFrom.set(response.meta.dateFrom);
    this.dateTo.set(response.meta.dateTo);
  }

  async applyAttendanceFilter(): Promise<void> {
    this.attendancePage.set(1);
    this.loading.set(true);
    this.error.set('');
    try {
      await this.loadAttendance();
    } catch {
      this.error.set('Unable to load attendance.');
    } finally {
      this.loading.set(false);
    }
  }

  async goToAttendancePage(nextPage: number): Promise<void> {
    this.attendancePage.set(nextPage);
    this.loading.set(true);
    try {
      await this.loadAttendance();
    } catch {
      this.error.set('Unable to load attendance.');
    } finally {
      this.loading.set(false);
    }
  }

  async searchEmployees(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.loadEmployees();
    } catch {
      this.error.set('Unable to load employees.');
    } finally {
      this.loading.set(false);
    }
  }

  async applyPeriodFilter(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.loadPeriod();
    } catch {
      this.error.set('Unable to load period summary.');
    } finally {
      this.loading.set(false);
    }
  }

  setSemiMonthlyPeriod(half: 1 | 2): void {
    const base = this.dateTo() || this.manilaToday();
    const yearMonth = base.slice(0, 7);
    if (half === 1) {
      this.dateFrom.set(`${yearMonth}-01`);
      this.dateTo.set(`${yearMonth}-15`);
    } else {
      this.dateFrom.set(`${yearMonth}-16`);
      this.dateTo.set(this.monthEnd(yearMonth));
    }
  }

  async copyTimeClockLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.timeClockUrl);
      this.copyMessage.set('Time clock link copied.');
    } catch {
      this.copyMessage.set(this.timeClockUrl);
    }
  }

  formatPunch(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    return new Date(value).toLocaleTimeString('en-PH', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatMoney(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }

    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value);
  }

  formatHours(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }

    return `${value.toFixed(2)} h`;
  }

  selfieUrl(path: string | null | undefined): string | null {
    return this.adminApi.resolveAttendanceSelfieUrl(path);
  }

  openSelfieModal(url: string, label: string): void {
    this.selfieModal.set({ url, label });
  }

  closeSelfieModal(): void {
    this.selfieModal.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeSelfieModal();
  }

  salaryTypeLabel(value: string): string {
    switch (value) {
      case 'weekly':
        return 'Weekly';
      case 'semi_monthly':
        return 'Semi-Monthly';
      case 'cutoff':
        return 'By Cutoff';
      default:
        return 'Monthly';
    }
  }

  todayStatusLabel(value: PayrollEmployeeItem['todayStatus']): string {
    switch (value) {
      case 'timed_in':
        return 'Timed in';
      case 'completed':
        return 'Completed';
      case 'absent':
        return 'Absent';
      default:
        return 'Not yet in';
    }
  }

  todayStatusClass(value: PayrollEmployeeItem['todayStatus']): string {
    switch (value) {
      case 'timed_in':
        return 'bg-amber-50 text-amber-700';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700';
      case 'absent':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  attendanceStatusLabel(value: PayrollAttendanceItem['status']): string {
    switch (value) {
      case 'timed_in':
        return 'Working';
      case 'completed':
        return 'Done';
      default:
        return 'Incomplete';
    }
  }

  private manilaToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private monthEnd(yearMonth: string): string {
    const [year, month] = yearMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  }
}
