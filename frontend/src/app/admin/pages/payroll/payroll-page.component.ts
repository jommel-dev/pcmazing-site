import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import {
  AdminApiService,
  EmployeePayslipDetail,
  PaginationMeta,
  PayrollAdjustmentItem,
  PayrollAttendanceItem,
  PayrollEmployeeItem,
  PayrollOverlapItem,
  PayrollOverview,
  PayrollOvertimeItem,
  PayrollOvertimeStatus,
  PayrollPeriodItem,
  PayrollPeriodMeta,
} from '../../services/admin-api.service';

type PayrollTab = 'overview' | 'attendance' | 'employees' | 'period' | 'overtime' | 'adjustments';
type PeriodType = 'weekly' | 'semi_monthly' | 'monthly' | 'cutoff';
type WorkWeek = 'mon_fri' | 'mon_sat' | 'day_off_basis';

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
    { key: 'overtime', label: 'Overtime' },
    { key: 'adjustments', label: 'Adjustments' },
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
  readonly generating = signal(false);
  readonly generateMessage = signal('');
  readonly previewOpen = signal(false);
  readonly previewLoading = signal(false);
  readonly previewItems = signal<EmployeePayslipDetail[]>([]);
  readonly previewIndex = signal(0);
  readonly periodType = signal<PeriodType>('weekly');
  readonly workWeek = signal<WorkWeek>('mon_fri');
  readonly undertimeGraceMinutes = signal(30);
  readonly savingWorkWeek = signal(false);
  readonly overlaps = signal<PayrollOverlapItem[]>([]);
  readonly confirmOverlap = signal(false);
  readonly periodTypeOptions: Array<{ value: PeriodType; label: string }> = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'semi_monthly', label: 'Semi-Monthly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'cutoff', label: 'Custom' },
  ];
  readonly workWeekOptions: Array<{ value: WorkWeek; label: string }> = [
    { value: 'mon_fri', label: 'Mon–Fri' },
    { value: 'mon_sat', label: 'Mon–Sat' },
    { value: 'day_off_basis', label: 'Day-off basis' },
  ];

  readonly overtimeItems = signal<PayrollOvertimeItem[]>([]);
  readonly overtimeMeta = signal<PaginationMeta | null>(null);
  readonly overtimeStatus = signal<PayrollOvertimeStatus>('pending');
  readonly overtimePage = signal(1);
  readonly reviewingOvertimeId = signal<number | null>(null);

  readonly adjustmentItems = signal<PayrollAdjustmentItem[]>([]);
  readonly adjustmentMeta = signal<PaginationMeta | null>(null);
  readonly adjustmentStatus = signal<PayrollOvertimeStatus>('pending');
  readonly adjustmentPage = signal(1);
  readonly reviewingAdjustmentId = signal<number | null>(null);

  readonly timeClockUrl = `${APP_CONFIG.publicSiteUrl.replace(/\/$/, '')}/time-clock`;

  ngOnInit(): void {
    const today = this.manilaToday();
    this.workDate.set(today);
    void this.bootstrapDates(today);
  }

  private async bootstrapDates(today: string): Promise<void> {
    try {
      const settings = await firstValueFrom(this.adminApi.getPayrollSettings());
      this.workWeek.set(settings.data.workWeek);
      this.undertimeGraceMinutes.set(settings.data.undertimeGraceMinutes ?? 30);
    } catch {
      // Keep default Mon–Fri until settings load with Period pay.
    }
    this.snapDatesForPeriodType(today);
    await this.loadActiveTab();
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
        case 'overtime':
          await this.loadOvertime();
          break;
        case 'adjustments':
          await this.loadAdjustments();
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
    const [periodResponse, settingsResponse] = await Promise.all([
      firstValueFrom(
        this.adminApi.getPayrollPeriod(this.dateFrom(), this.dateTo(), this.periodType()),
      ),
      firstValueFrom(this.adminApi.getPayrollSettings()),
    ]);
    this.periodItems.set(periodResponse.data);
    this.periodMeta.set(periodResponse.meta);
    this.dateFrom.set(periodResponse.meta.dateFrom);
    this.dateTo.set(periodResponse.meta.dateTo);
    this.overlaps.set(periodResponse.meta.overlaps ?? []);
    this.workWeek.set(settingsResponse.data.workWeek);
    this.undertimeGraceMinutes.set(settingsResponse.data.undertimeGraceMinutes ?? 30);
  }

  private async loadOvertime(): Promise<void> {
    const response = await firstValueFrom(
      this.adminApi.listPayrollOvertime(this.overtimeStatus(), this.overtimePage(), 50),
    );
    this.overtimeItems.set(response.data);
    this.overtimeMeta.set(response.meta);
    this.overtimeStatus.set(response.status);
  }

  private async loadAdjustments(): Promise<void> {
    const response = await firstValueFrom(
      this.adminApi.listPayrollAdjustments(this.adjustmentStatus(), this.adjustmentPage(), 50),
    );
    this.adjustmentItems.set(response.data);
    this.adjustmentMeta.set(response.meta);
    this.adjustmentStatus.set(response.status);
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
    this.generateMessage.set('');
    this.confirmOverlap.set(false);
    try {
      await this.loadPeriod();
    } catch {
      this.error.set('Unable to load period summary.');
    } finally {
      this.loading.set(false);
    }
  }

  async applyOvertimeFilter(): Promise<void> {
    this.overtimePage.set(1);
    this.loading.set(true);
    this.error.set('');
    try {
      await this.loadOvertime();
    } catch {
      this.error.set('Unable to load overtime requests.');
    } finally {
      this.loading.set(false);
    }
  }

  async goToOvertimePage(nextPage: number): Promise<void> {
    this.overtimePage.set(nextPage);
    this.loading.set(true);
    try {
      await this.loadOvertime();
    } catch {
      this.error.set('Unable to load overtime requests.');
    } finally {
      this.loading.set(false);
    }
  }

  async reviewOvertime(item: PayrollOvertimeItem, status: 'approved' | 'rejected'): Promise<void> {
    if (this.reviewingOvertimeId() != null) {
      return;
    }

    this.reviewingOvertimeId.set(item.id);
    this.error.set('');
    try {
      await firstValueFrom(this.adminApi.reviewPayrollOvertime(item.id, status));
      await this.loadOvertime();
    } catch {
      this.error.set(`Unable to ${status === 'approved' ? 'approve' : 'reject'} overtime.`);
    } finally {
      this.reviewingOvertimeId.set(null);
    }
  }

  async applyAdjustmentFilter(): Promise<void> {
    this.adjustmentPage.set(1);
    this.loading.set(true);
    this.error.set('');
    try {
      await this.loadAdjustments();
    } catch {
      this.error.set('Unable to load time-out adjustments.');
    } finally {
      this.loading.set(false);
    }
  }

  async goToAdjustmentPage(nextPage: number): Promise<void> {
    this.adjustmentPage.set(nextPage);
    this.loading.set(true);
    try {
      await this.loadAdjustments();
    } catch {
      this.error.set('Unable to load time-out adjustments.');
    } finally {
      this.loading.set(false);
    }
  }

  async reviewAdjustment(item: PayrollAdjustmentItem, status: 'approved' | 'rejected'): Promise<void> {
    if (this.reviewingAdjustmentId() != null) {
      return;
    }

    this.reviewingAdjustmentId.set(item.id);
    this.error.set('');
    try {
      await firstValueFrom(this.adminApi.reviewPayrollAdjustment(item.id, status));
      await this.loadAdjustments();
    } catch {
      this.error.set(`Unable to ${status === 'approved' ? 'approve' : 'reject'} time-out adjustment.`);
    } finally {
      this.reviewingAdjustmentId.set(null);
    }
  }

  async generatePayslips(): Promise<void> {
    if (this.generating() || this.periodItems().length === 0) {
      return;
    }

    this.generating.set(true);
    this.error.set('');
    this.generateMessage.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.generatePayrollPeriod(
          this.dateFrom(),
          this.dateTo(),
          this.periodType(),
          this.confirmOverlap() || this.blockingOverlaps().length === 0,
        ),
      );
      const data = response.data;
      this.dateFrom.set(data.dateFrom);
      this.dateTo.set(data.dateTo);
      this.closePayslipPreview();
      await this.loadPeriod();
      this.generateMessage.set(
        data.replaced
          ? `Re-generated ${data.label} for ${data.employeeCount} employee(s). Payslips are now visible on their portal.`
          : `Generated ${data.label} for ${data.employeeCount} employee(s). Payslips are now visible on their portal.`,
      );
    } catch (err) {
      const overlapMessage = this.readOverlapError(err);
      this.error.set(overlapMessage || 'Unable to generate payslips for this cutoff.');
    } finally {
      this.generating.set(false);
    }
  }

  async openPayslipPreview(item?: PayrollPeriodItem): Promise<void> {
    if (this.previewLoading() || this.periodItems().length === 0) {
      return;
    }

    this.previewOpen.set(true);
    this.previewLoading.set(true);
    this.previewItems.set([]);
    this.error.set('');
    this.generateMessage.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.previewPayrollPeriod(this.dateFrom(), this.dateTo(), this.periodType()),
      );
      const items = response.data.items ?? [];
      this.previewItems.set(items);
      this.overlaps.set(response.data.overlaps ?? this.overlaps());
      const startKey = item ? this.employeeKey(item) : '';
      const startIndex = startKey
        ? items.findIndex((slip) => `${slip.userSource}:${slip.userId}` === startKey)
        : 0;
      this.previewIndex.set(startIndex >= 0 ? startIndex : 0);
    } catch {
      this.error.set('Unable to load payslip preview.');
      this.previewOpen.set(false);
    } finally {
      this.previewLoading.set(false);
    }
  }

  closePayslipPreview(): void {
    this.previewOpen.set(false);
    this.previewLoading.set(false);
    this.previewItems.set([]);
    this.previewIndex.set(0);
  }

  previewEmployee(): EmployeePayslipDetail | null {
    return this.previewItems()[this.previewIndex()] ?? null;
  }

  canPreviewPrev(): boolean {
    return this.previewIndex() > 0;
  }

  canPreviewNext(): boolean {
    return this.previewIndex() < this.previewItems().length - 1;
  }

  showPreviousPayslip(): void {
    if (this.canPreviewPrev()) {
      this.previewIndex.update((index) => index - 1);
    }
  }

  showNextPayslip(): void {
    if (this.canPreviewNext()) {
      this.previewIndex.update((index) => index + 1);
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
    if (this.previewOpen()) {
      this.closePayslipPreview();
      return;
    }
    this.closeSelfieModal();
  }

  @HostListener('document:keydown.arrowleft')
  onPreviewPrev(): void {
    if (this.previewOpen() && !this.previewLoading()) {
      this.showPreviousPayslip();
    }
  }

  @HostListener('document:keydown.arrowright')
  onPreviewNext(): void {
    if (this.previewOpen() && !this.previewLoading()) {
      this.showNextPayslip();
    }
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

  payoutMethodLabel(value: string | null | undefined): string {
    return value === 'online' ? 'Online' : 'Cash';
  }

  employeeKey(item: { userId: number; userSource: string }): string {
    return `${item.userSource}:${item.userId}`;
  }

  blockingOverlaps(): PayrollOverlapItem[] {
    return this.overlaps().filter((item) => !item.exactMatch);
  }

  exactOverlaps(): PayrollOverlapItem[] {
    return this.overlaps().filter((item) => item.exactMatch);
  }

  async setPeriodType(type: PeriodType): Promise<void> {
    this.periodType.set(type);
    this.confirmOverlap.set(false);
    this.snapDatesForPeriodType();
    await this.applyPeriodFilter();
  }

  async setWorkWeek(workWeek: WorkWeek): Promise<void> {
    if (this.savingWorkWeek()) {
      return;
    }
    this.savingWorkWeek.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.updatePayrollSettings({
          workWeek,
          undertimeGraceMinutes: this.undertimeGraceMinutes(),
        }),
      );
      this.workWeek.set(response.data.workWeek);
      this.undertimeGraceMinutes.set(response.data.undertimeGraceMinutes ?? this.undertimeGraceMinutes());
      this.snapDatesForPeriodType();
      await this.applyPeriodFilter();
    } catch {
      this.error.set('Unable to save work week.');
    } finally {
      this.savingWorkWeek.set(false);
    }
  }

  async setUndertimeGrace(minutes: number | string): Promise<void> {
    const parsed = Math.min(90, Math.max(0, Math.round(Number(minutes) || 0)));
    this.undertimeGraceMinutes.set(parsed);
    if (this.savingWorkWeek()) {
      return;
    }
    this.savingWorkWeek.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.updatePayrollSettings({
          workWeek: this.workWeek(),
          undertimeGraceMinutes: parsed,
        }),
      );
      this.undertimeGraceMinutes.set(response.data.undertimeGraceMinutes ?? parsed);
      await this.applyPeriodFilter();
    } catch {
      this.error.set('Unable to save undertime grace.');
    } finally {
      this.savingWorkWeek.set(false);
    }
  }

  workWeekLabel(value: WorkWeek): string {
    return this.workWeekOptions.find((option) => option.value === value)?.label ?? value;
  }

  shiftWeekly(weeks: -1 | 0 | 1): void {
    if (weeks === 0) {
      this.snapWeeklyRange(this.manilaToday());
      return;
    }
    const base = this.dateFrom() || this.manilaToday();
    this.snapWeeklyRange(this.shiftIsoDate(base, weeks * 7));
  }

  setMonthlyPeriod(): void {
    const base = this.dateTo() || this.manilaToday();
    const yearMonth = base.slice(0, 7);
    this.dateFrom.set(`${yearMonth}-01`);
    this.dateTo.set(this.monthEnd(yearMonth));
  }

  private snapDatesForPeriodType(ref = this.dateTo() || this.manilaToday()): void {
    switch (this.periodType()) {
      case 'weekly':
        this.snapWeeklyRange(ref);
        break;
      case 'semi_monthly':
        this.setSemiMonthlyPeriod(Number(ref.slice(8, 10)) <= 15 ? 1 : 2);
        break;
      case 'monthly':
        this.setMonthlyPeriod();
        break;
      default:
        break;
    }
  }

  private snapWeeklyRange(ref: string): void {
    const [year, month, day] = ref.split('-').map(Number);
    const utc = Date.UTC(year, month - 1, day);
    const weekday = new Date(utc).getUTCDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    const from = this.shiftIsoDate(ref, mondayOffset);
    const span = this.workWeek() === 'mon_fri' ? 4 : this.workWeek() === 'mon_sat' ? 5 : 6;
    this.dateFrom.set(from);
    this.dateTo.set(this.shiftIsoDate(from, span));
  }

  private shiftIsoDate(value: string, days: number): string {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
  }

  private readOverlapError(err: unknown): string {
    const body = (err as { error?: Record<string, unknown> })?.error;
    if (!body) {
      return '';
    }
    const nested = body['message'];
    const overlaps = Array.isArray(body['overlaps'])
      ? (body['overlaps'] as PayrollOverlapItem[])
      : nested && typeof nested === 'object' && nested !== null && Array.isArray((nested as { overlaps?: unknown }).overlaps)
        ? ((nested as { overlaps: PayrollOverlapItem[] }).overlaps)
        : [];
    if (overlaps.length > 0) {
      this.overlaps.set(overlaps);
      const text =
        (typeof nested === 'string' ? nested : (nested as { message?: string } | null)?.message) ||
        (typeof body['message'] === 'string' ? (body['message'] as string) : '');
      return text || 'These dates overlap existing payslips. Confirm generate to continue.';
    }
    if (typeof nested === 'string' && nested.toLowerCase().includes('overlap')) {
      return nested;
    }
    return '';
  }

  scheduledPayAmount(item: PayrollEmployeeItem): number | null {
    const schedule = item.salaryType;
    const fixedMonthly = item.fixedMonthlySalary;
    if (fixedMonthly != null && fixedMonthly > 0) {
      return this.monthlyToScheduleAmount(fixedMonthly, schedule);
    }

    const amount = item.monthlySalary;
    if (amount == null || amount <= 0) {
      return null;
    }

    switch (schedule) {
      case 'weekly':
      case 'monthly':
      case 'cutoff':
        return this.roundMoney(amount);
      case 'semi_monthly':
        return this.roundMoney(amount * 11);
      default:
        return this.roundMoney(amount);
    }
  }

  scheduledPayLabel(item: PayrollEmployeeItem): string {
    switch (item.salaryType) {
      case 'weekly':
        return 'Daily rate';
      case 'semi_monthly':
        return 'Semi-monthly pay';
      case 'cutoff':
        return 'Cutoff pay';
      default:
        return 'Monthly pay';
    }
  }

  private monthlyToScheduleAmount(
    monthly: number,
    schedule: PayrollEmployeeItem['salaryType'],
  ): number {
    switch (schedule) {
      case 'weekly':
        return this.roundMoney(monthly / 4);
      case 'semi_monthly':
        return this.roundMoney(monthly / 2);
      case 'cutoff':
      case 'monthly':
      default:
        return this.roundMoney(monthly);
    }
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
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

  overtimeStatusLabel(value: PayrollOvertimeStatus | undefined): string {
    switch (value) {
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return '—';
    }
  }

  undertimeCategoryLabel(value?: string | null): string {
    switch (value) {
      case 'emergency':
        return 'Emergency';
      case 'appointment':
        return 'Scheduled appointment';
      case 'event':
        return 'Important event';
      case 'other':
        return 'Other';
      default:
        return value || '';
    }
  }

  overtimeStatusClass(value: PayrollOvertimeStatus | undefined): string {
    switch (value) {
      case 'pending':
        return 'bg-amber-50 text-amber-700';
      case 'approved':
        return 'bg-emerald-50 text-emerald-700';
      case 'rejected':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-slate-100 text-slate-600';
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
