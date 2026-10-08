import { NgClass } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  EmployeeActivityItem,
  EmployeeDayOffItem,
  EmployeePayslipDetail,
  EmployeeTodoItem,
  EmployeeWorkspaceDashboard,
} from '../../services/admin-api.service';

/** full = employee home (calendar, payslips, notices). notices = missed time-out / OT alerts only. */
export type EmployeeDashboardVariant = 'full' | 'notices';

@Component({
  selector: 'app-sales-employee-dashboard',
  imports: [FormsModule, NgClass],
  templateUrl: './sales-employee-dashboard.component.html',
})
export class SalesEmployeeDashboardComponent implements OnInit, OnDestroy {
  private readonly adminApi = inject(AdminApiService);
  private readonly adjustmentVideoRef = viewChild<ElementRef<HTMLVideoElement>>('adjustmentCameraVideo');

  readonly variant = input<EmployeeDashboardVariant>('full');

  readonly loading = signal(true);
  readonly error = signal('');
  readonly month = signal(this.currentMonth());
  readonly selectedDate = signal(this.todayIso());
  readonly dashboard = signal<EmployeeWorkspaceDashboard | null>(null);
  readonly dayOffModalOpen = signal(false);

  readonly todoTitle = signal('');
  readonly dayOffReason = signal('');
  readonly saving = signal(false);
  readonly requestingOvertimeId = signal<number | null>(null);
  readonly overtimeMessage = signal('');
  readonly requestingAdjustmentId = signal<number | null>(null);
  readonly adjustmentMessage = signal('');
  readonly adjustmentPhoto = signal<File | null>(null);
  readonly adjustmentPhotoPreview = signal<string | null>(null);
  readonly adjustmentCameraStarting = signal(false);
  readonly adjustmentCameraReady = signal(false);
  readonly adjustmentCameraError = signal('');
  readonly requestedTimeOut = signal('');
  readonly adjustmentNote = signal('');
  readonly undertimeCategory = signal<'emergency' | 'appointment' | 'event' | 'other'>('emergency');
  private adjustmentMediaStream: MediaStream | null = null;
  private adjustmentCameraRequestId = 0;
  readonly undertimeCategoryOptions: Array<{ value: 'emergency' | 'appointment' | 'event' | 'other'; label: string }> = [
    { value: 'emergency', label: 'Emergency' },
    { value: 'appointment', label: 'Scheduled appointment' },
    { value: 'event', label: 'Important event' },
    { value: 'other', label: 'Other' },
  ];
  readonly openingPayslipId = signal<string | null>(null);
  readonly payslipDetail = signal<EmployeePayslipDetail | null>(null);
  readonly payslipDetailOpen = signal(false);
  readonly payslipDetailLoading = signal(false);
  readonly downloadingPayslip = signal(false);
  readonly includePayslipRemarks = signal(false);

  readonly calendarDays = computed(() => this.buildCalendar(this.month(), this.dashboard()));

  readonly overtimeEligibleDays = computed(() =>
    (this.dashboard()?.attendanceDays ?? []).filter((day) => day.canRequestOvertime),
  );

  readonly incompletePunchDays = computed(() =>
    (this.dashboard()?.attendanceDays ?? []).filter((day) => day.canRequestTimeOutAdjustment),
  );

  readonly hasNoticeContent = computed(() => {
    const data = this.dashboard();
    if (!data) return false;
    return Boolean(
      data.adjustmentNotice?.message ||
        data.overtimeNotice?.message ||
        this.adjustmentMessage() ||
        this.overtimeMessage() ||
        this.error(),
    );
  });

  readonly selectedDayTodos = computed(() => {
    const date = this.selectedDate();
    return (this.dashboard()?.todos ?? []).filter((todo) => todo.dueDate === date);
  });

  readonly selectedDayOff = computed(() => {
    const date = this.selectedDate();
    return (this.dashboard()?.dayOffs ?? []).find((item) => item.dayOffDate === date) ?? null;
  });

  readonly selectedAttendance = computed(() => {
    const date = this.selectedDate();
    return (this.dashboard()?.attendanceDays ?? []).find((item) => item.workDate === date) ?? null;
  });

  constructor() {
    effect(() => {
      const video = this.adjustmentVideoRef()?.nativeElement;
      if (!video || !this.adjustmentMediaStream || this.adjustmentPhotoPreview()) {
        return;
      }
      if (video.srcObject !== this.adjustmentMediaStream) {
        video.srcObject = this.adjustmentMediaStream;
        video.onloadedmetadata = () => {
          void video
            .play()
            .then(() => {
              this.adjustmentCameraReady.set(true);
              this.adjustmentCameraStarting.set(false);
            })
            .catch(() => {
              this.adjustmentCameraReady.set(true);
              this.adjustmentCameraStarting.set(false);
            });
        };
      }
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(options?: { quiet?: boolean }): Promise<void> {
    const quiet = options?.quiet === true && this.dashboard() != null;
    if (!quiet) {
      this.loading.set(true);
    }
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.getEmployeeWorkspaceDashboard(this.month()),
      );
      this.dashboard.set(response.data);
      if (!this.selectedDate()) {
        this.selectedDate.set(response.data.workDate);
      }
    } catch {
      this.error.set('Unable to load your employee dashboard.');
    } finally {
      if (!quiet) {
        this.loading.set(false);
      }
    }
  }

  async requestOvertime(attendanceId: number | null | undefined): Promise<void> {
    if (attendanceId == null || this.requestingOvertimeId() != null) {
      return;
    }

    this.requestingOvertimeId.set(attendanceId);
    this.overtimeMessage.set('');
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.requestEmployeeOvertime(attendanceId));
      this.overtimeMessage.set(response.data.message || response.message || 'Overtime request submitted.');
      await this.load();
    } catch {
      this.error.set('Unable to submit overtime request. Please try again.');
    } finally {
      this.requestingOvertimeId.set(null);
    }
  }

  async requestTimeOutAdjustment(attendanceId: number | null | undefined): Promise<void> {
    const photo = this.adjustmentPhoto();
    const requestedTimeOut = this.requestedTimeOut().trim();
    if (attendanceId == null || this.requestingAdjustmentId() != null) {
      return;
    }
    if (!photo) {
      this.error.set('Capture a time-out photo first.');
      return;
    }
    if (!requestedTimeOut) {
      this.error.set('Enter the time you actually left.');
      return;
    }
    if (this.adjustmentNote().trim().length < 8) {
      this.error.set('Explain why you missed clocking out (at least 8 characters).');
      return;
    }

    this.requestingAdjustmentId.set(attendanceId);
    this.adjustmentMessage.set('');
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.requestEmployeeTimeOutAdjustment(
          attendanceId,
          photo,
          requestedTimeOut,
          this.adjustmentNote(),
          this.undertimeCategory(),
        ),
      );
      this.adjustmentMessage.set(
        response.data.message || response.message || 'Time-out adjustment submitted.',
      );
      this.clearAdjustmentForm();
      this.stopAdjustmentCamera();
      this.closeDayOffModal();
      await this.load();
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'error' in error
          ? (error as { error?: { message?: string } }).error?.message
          : null;
      this.error.set(message || 'Unable to submit time-out adjustment. Please try again.');
    } finally {
      this.requestingAdjustmentId.set(null);
    }
  }

  async startAdjustmentCamera(): Promise<void> {
    this.adjustmentCameraError.set('');
    this.adjustmentCameraReady.set(false);
    this.adjustmentCameraStarting.set(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      this.adjustmentCameraError.set('Camera is not supported on this device/browser.');
      this.adjustmentCameraStarting.set(false);
      return;
    }

    if (this.adjustmentMediaStream?.active) {
      this.adjustmentCameraStarting.set(false);
      this.adjustmentCameraReady.set(true);
      return;
    }

    this.stopAdjustmentCameraTracksOnly();
    const requestId = ++this.adjustmentCameraRequestId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
      });

      if (requestId !== this.adjustmentCameraRequestId) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      this.adjustmentMediaStream = stream;
      const video = this.adjustmentVideoRef()?.nativeElement;
      if (video) {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          void video.play().finally(() => {
            this.adjustmentCameraReady.set(true);
            this.adjustmentCameraStarting.set(false);
          });
        };
      }
    } catch {
      if (requestId !== this.adjustmentCameraRequestId) {
        return;
      }
      this.adjustmentCameraError.set('Unable to access camera. Allow camera permission and try again.');
      this.adjustmentMediaStream = null;
      this.adjustmentCameraStarting.set(false);
      this.adjustmentCameraReady.set(false);
    }
  }

  stopAdjustmentCamera(): void {
    this.adjustmentCameraRequestId += 1;
    this.adjustmentCameraStarting.set(false);
    this.adjustmentCameraReady.set(false);
    this.stopAdjustmentCameraTracksOnly();
    const video = this.adjustmentVideoRef()?.nativeElement;
    if (video) {
      video.srcObject = null;
      video.onloadedmetadata = null;
    }
  }

  private stopAdjustmentCameraTracksOnly(): void {
    if (this.adjustmentMediaStream) {
      for (const track of this.adjustmentMediaStream.getTracks()) {
        track.stop();
      }
      this.adjustmentMediaStream = null;
    }
  }

  async captureAdjustmentPhoto(): Promise<void> {
    const video = this.adjustmentVideoRef()?.nativeElement;
    if (!video || !this.adjustmentCameraReady()) {
      this.error.set('Camera is not ready yet.');
      return;
    }

    const width = video.videoWidth || 480;
    const height = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      this.error.set('Unable to capture photo.');
      return;
    }

    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.8);
    });
    if (!blob) {
      this.error.set('Unable to capture photo.');
      return;
    }

    const previous = this.adjustmentPhotoPreview();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    const file = new File([blob], 'time-out-selfie.jpg', { type: 'image/jpeg' });
    this.adjustmentPhoto.set(file);
    this.adjustmentPhotoPreview.set(URL.createObjectURL(blob));
    this.error.set('');
  }

  retakeAdjustmentPhoto(): void {
    const previous = this.adjustmentPhotoPreview();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    this.adjustmentPhoto.set(null);
    this.adjustmentPhotoPreview.set(null);
    if (this.adjustmentMediaStream?.active) {
      this.adjustmentCameraReady.set(true);
      this.adjustmentCameraStarting.set(false);
      return;
    }
    void this.startAdjustmentCamera();
  }

  private clearAdjustmentForm(): void {
    const previous = this.adjustmentPhotoPreview();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    this.adjustmentPhoto.set(null);
    this.adjustmentPhotoPreview.set(null);
    this.adjustmentNote.set('');
    this.undertimeCategory.set('emergency');
    this.adjustmentCameraError.set('');
  }

  ngOnDestroy(): void {
    this.stopAdjustmentCamera();
    this.clearAdjustmentForm();
  }

  async viewPayslipPdf(payslipId: string): Promise<void> {
    if (this.openingPayslipId() != null) {
      return;
    }

    this.openingPayslipId.set(payslipId);
    this.payslipDetailLoading.set(true);
    this.payslipDetailOpen.set(true);
    this.payslipDetail.set(null);
    this.includePayslipRemarks.set(false);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.getEmployeePayslipDetail(payslipId));
      this.payslipDetail.set(response.data);
    } catch {
      this.error.set('Unable to load payslip details.');
      this.payslipDetailOpen.set(false);
    } finally {
      this.payslipDetailLoading.set(false);
      this.openingPayslipId.set(null);
    }
  }

  closePayslipDetail(): void {
    this.payslipDetailOpen.set(false);
    this.payslipDetail.set(null);
    this.includePayslipRemarks.set(false);
  }

  async downloadPayslipPdf(payslipId: string): Promise<void> {
    if (this.downloadingPayslip()) {
      return;
    }

    this.downloadingPayslip.set(true);
    this.error.set('');
    try {
      const blob = await firstValueFrom(
        this.adminApi.downloadEmployeePayslipPdf(
          payslipId,
          true,
          this.includePayslipRemarks(),
        ),
      );
      const detail = this.payslipDetail();
      const filename = detail
        ? `payslip-${detail.dateFrom}_${detail.dateTo}.pdf`
        : `payslip-${payslipId}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      this.error.set('Unable to download payslip PDF.');
    } finally {
      this.downloadingPayslip.set(false);
    }
  }

  closeDayOffModal(): void {
    this.stopAdjustmentCamera();
    this.dayOffModalOpen.set(false);
  }

  async changeMonth(delta: number): Promise<void> {
    const [year, mon] = this.month().split('-').map(Number);
    const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
    this.month.set(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
    await this.load();
  }

  selectDate(isoDate: string): void {
    this.selectedDate.set(isoDate);
    this.dayOffReason.set('');
    this.clearAdjustmentForm();
    const punch = (this.dashboard()?.attendanceDays ?? []).find((item) => item.workDate === isoDate);
    this.requestedTimeOut.set(punch ? this.defaultRequestedTimeOut(punch.workDate, punch.timeIn) : `${isoDate}T18:00`);
    this.dayOffModalOpen.set(true);
    if (punch?.canRequestTimeOutAdjustment) {
      void this.startAdjustmentCamera();
    }
  }

  private defaultRequestedTimeOut(workDate: string, timeIn: string | null): string {
    // Always use the missed work date (the day without time-out).
    if (!timeIn) {
      return `${workDate}T18:00`;
    }

    const start = new Date(timeIn).getTime();
    const guessed = new Date(start + 9 * 60 * 60 * 1000);
    const guessedDate = guessed.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const guessedTime = guessed.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Manila',
    });

    // If time-in + 9h stays on the work date, use that time; otherwise default to 6:00 PM that day.
    if (guessedDate === workDate) {
      return `${workDate}T${guessedTime}`;
    }
    return `${workDate}T18:00`;
  }

  formatPunch(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    });
  }

  formatHours(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    return `${value.toFixed(2)} h`;
  }

  formatMoney(value: number | null | undefined): string {
    if (value == null) {
      return '₱0';
    }
    return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
  }

  formatActivityTime(value: string): string {
    return new Date(value).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });
  }

  async saveDayOff(): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.adminApi.upsertEmployeeDayOff({
          dayOffDate: this.selectedDate(),
          reason: this.dayOffReason().trim() || undefined,
        }),
      );
      this.dayOffReason.set('');
      await this.load();
      this.closeDayOffModal();
    } catch {
      this.error.set('Unable to save day off.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeDayOff(item: EmployeeDayOffItem): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(this.adminApi.deleteEmployeeDayOff(item.id));
      await this.load();
      this.closeDayOffModal();
    } catch {
      this.error.set('Unable to remove day off.');
    } finally {
      this.saving.set(false);
    }
  }

  async addTodo(): Promise<void> {
    const title = this.todoTitle().trim();
    if (!title) {
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.adminApi.createEmployeeTodo({
          title,
          dueDate: this.selectedDate(),
        }),
      );
      this.todoTitle.set('');
      await this.load();
    } catch {
      this.error.set('Unable to add todo.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleTodo(todo: EmployeeTodoItem): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.adminApi.updateEmployeeTodo(todo.id, { isDone: !todo.isDone }),
      );
      await this.load();
    } catch {
      this.error.set('Unable to update todo.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeTodo(todo: EmployeeTodoItem): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(this.adminApi.deleteEmployeeTodo(todo.id));
      await this.load();
    } catch {
      this.error.set('Unable to delete todo.');
    } finally {
      this.saving.set(false);
    }
  }

  activityLabel(item: EmployeeActivityItem): string {
    switch (item.actionType) {
      case 'time_in':
        return 'Time in';
      case 'time_out':
        return 'Time out';
      case 'day_off_plotted':
        return 'Day off';
      case 'day_off_removed':
        return 'Day off removed';
      case 'overtime_requested':
        return 'Overtime request';
      case 'time_out_adjustment_requested':
        return 'Time-out adjustment';
      case 'todo_created':
        return 'To-do added';
      case 'todo_completed':
        return 'To-do done';
      case 'todo_reopened':
        return 'To-do reopened';
      case 'todo_deleted':
        return 'To-do deleted';
      case 'job_order_created':
        return 'Job order created';
      case 'job_order_completed':
        return 'Job order completed';
      case 'print':
        return 'Print';
      case 'cleaning':
        return 'Cleaning';
      case 'note':
        return 'Note';
      default:
        return item.actionType.replace(/_/g, ' ');
    }
  }

  private currentMonth(): string {
    return this.todayIso().slice(0, 7);
  }

  private todayIso(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  }

  private buildCalendar(
    month: string,
    data: EmployeeWorkspaceDashboard | null,
  ): Array<{
    isoDate: string;
    day: number;
    inMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    hasAttendance: boolean;
    hasIncompletePunch: boolean;
    hasDayOff: boolean;
    hasTodo: boolean;
  }> {
    const [year, mon] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, mon - 1, 1));
    const startWeekday = (first.getUTCDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const today = data?.workDate ?? this.todayIso();
    const selected = this.selectedDate();
    const attendanceSet = new Set((data?.attendanceDays ?? []).map((item) => item.workDate));
    const incompleteSet = new Set(
      (data?.attendanceDays ?? [])
        .filter((item) => item.timeIn && !item.timeOut)
        .map((item) => item.workDate),
    );
    const dayOffSet = new Set((data?.dayOffs ?? []).map((item) => item.dayOffDate));
    const todoSet = new Set((data?.todos ?? []).map((item) => item.dueDate));

    const cells: Array<{
      isoDate: string;
      day: number;
      inMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasAttendance: boolean;
      hasIncompletePunch: boolean;
      hasDayOff: boolean;
      hasTodo: boolean;
    }> = [];

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startWeekday + 1;
      const date = new Date(Date.UTC(year, mon - 1, dayNum));
      const isoDate = date.toISOString().slice(0, 10);
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
      cells.push({
        isoDate,
        day: date.getUTCDate(),
        inMonth,
        isToday: isoDate === today,
        isSelected: isoDate === selected,
        hasAttendance: attendanceSet.has(isoDate),
        hasIncompletePunch: incompleteSet.has(isoDate),
        hasDayOff: dayOffSet.has(isoDate),
        hasTodo: todoSet.has(isoDate),
      });
    }

    return cells;
  }
}
