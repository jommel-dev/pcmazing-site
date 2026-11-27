import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AdminApiService } from '../../../admin/services/admin-api.service';
import { formatManilaTime } from '../core/portal-format';
import { portalErrorMessage, PortalWorkspaceService } from '../core/portal-workspace.service';
import { PortalIconComponent } from '../ui/portal-icon.component';
import { PortalPromptComponent } from '../ui/portal-prompt.component';

@Component({
  selector: 'app-portal-adjust-page',
  standalone: true,
  imports: [FormsModule, RouterLink, PortalIconComponent, PortalPromptComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-adjust-page.component.html',
  styles: `
    .portal-time::-webkit-calendar-picker-indicator {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
      opacity: 0;
    }
  `,
})
export class PortalAdjustPageComponent {
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);
  protected readonly workspace = inject(PortalWorkspaceService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private seededFor: string | null = null;

  protected readonly timeIn = signal('');
  protected readonly timeOut = signal('');
  protected readonly reason = signal('');
  protected readonly error = signal('');

  protected readonly workDate = computed(
    () => this.params()?.get('workDate') || this.params()?.get('date') || '',
  );
  private readonly routeAttendanceId = computed(() => Number(this.params()?.get('attendanceId')));
  protected readonly initial = computed(() => this.workspace.firstName().slice(0, 1).toUpperCase());
  protected readonly greeting = computed(() => manilaGreeting(this.workspace.clock()?.serverNow));
  protected readonly dateLabel = computed(() => formatCorrectionDate(this.workDate(), true));
  protected readonly day = computed(() => {
    const date = this.workDate().slice(0, 10);
    const id = this.routeAttendanceId();
    const rows = this.workspace.dashboard()?.attendanceDays ?? [];
    if (Number.isFinite(id) && id > 0) {
      const match = rows.find((row) => row.id === id);
      if (match) {
        return match;
      }
    }
    return rows.find((row) => row.workDate.slice(0, 10) === date) ?? null;
  });
  protected readonly issueTitle = computed(() => {
    const date = formatCorrectionDate(this.workDate(), false);
    const day = this.day();
    if (!day?.timeIn && day?.timeOut) {
      return `${date} · missing time in`;
    }
    if (day?.timeIn && day.timeOut) {
      return `${date} · incorrect punch`;
    }
    return `${date} · missing time out`;
  });
  protected readonly issueDetail = computed(() => {
    const day = this.day();
    if (!this.workspace.dashboard()) {
      return 'Checking the punch on file.';
    }
    if (!day) {
      return 'Neither time in nor time out was captured.';
    }
    const timeIn = formatManilaTime(day.timeIn);
    const timeOut = formatManilaTime(day.timeOut);
    if (day.timeIn && !day.timeOut) {
      return `Time in ${timeIn} is on file. Time out was not captured.`;
    }
    if (!day.timeIn && day.timeOut) {
      return `Time out ${timeOut} is on file. Time in was not captured.`;
    }
    if (day.timeIn && day.timeOut) {
      return `Time in ${timeIn} and time out ${timeOut} are on file.`;
    }
    return 'Neither time in nor time out was captured.';
  });

  constructor() {
    effect(() => {
      const date = this.workDate().slice(0, 10);
      const day = this.day();
      if (!date || !this.workspace.dashboard() || this.seededFor === date) {
        return;
      }
      this.seededFor = date;
      this.timeIn.set(manilaTimeValue(day?.timeIn));
      this.timeOut.set(manilaTimeValue(day?.timeOut));
      this.reason.set('');
      this.error.set('');
    });
  }

  protected back(): void {
    void this.router.navigate(['/user/attendance']);
  }

  protected async submit(): Promise<void> {
    const id = this.day()?.id ?? this.routeAttendanceId();
    const date = this.workDate().slice(0, 10);
    const timeIn = this.timeIn().trim();
    const timeOut = this.timeOut().trim();
    const reason = this.reason().trim();

    this.error.set('');
    if (!Number.isFinite(id) || id <= 0 || !date) {
      this.error.set('This day has no attendance record to correct.');
      return;
    }
    if (!timeOut) {
      this.error.set('Enter the correct time out.');
      return;
    }
    if (reason.length < 8) {
      this.error.set('Explain the correction in at least 8 characters.');
      return;
    }

    const detail = [
      timeIn ? `Correct time in ${formatClock(timeIn)}` : '',
      `Correct time out ${formatClock(timeOut)}`,
      reason,
    ]
      .filter(Boolean)
      .join('. ')
      .slice(0, 255);

    this.workspace.busy.set(true);
    try {
      const response = await firstValueFrom(
        this.api.requestEmployeeTimeOutAdjustment(id, null, `${date}T${timeOut}`, detail, 'other'),
      );
      this.workspace.notice.set(response.data?.message || response.message || 'Correction submitted.');
      await this.workspace.reloadDashboard().catch(() => undefined);
      void this.router.navigate(['/user/attendance']);
    } catch (error) {
      this.error.set(portalErrorMessage(error, 'Could not submit the correction.'));
    } finally {
      this.workspace.busy.set(false);
    }
  }
}

function formatCorrectionDate(iso: string, withYear: boolean): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) {
    return '—';
  }
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

function formatClock(value: string): string {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value;
  }
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function manilaTimeValue(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  return hour && minute ? `${hour}:${minute}` : '';
}

function manilaGreeting(serverNow: string | null | undefined): string {
  const date = serverNow ? new Date(serverNow) : new Date();
  const hour =
    Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(Number.isNaN(date.getTime()) ? new Date() : date),
    ) % 24;
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}
