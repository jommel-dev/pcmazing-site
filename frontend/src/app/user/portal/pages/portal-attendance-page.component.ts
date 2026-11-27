import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApiService, EmployeeWorkspaceDashboard } from '../../../admin/services/admin-api.service';
import {
  cutoffWindow,
  daysInMonth,
  formatCoordinates,
  formatHoursShort,
  formatManilaDateTime,
  formatManilaTime,
  monthTitle,
  shortPlace,
  weekdaySunday0,
} from '../core/portal-format';
import { PortalWorkspaceService } from '../core/portal-workspace.service';
import { PortalIconComponent } from '../ui/portal-icon.component';
import { PortalPromptComponent } from '../ui/portal-prompt.component';

type AttendanceDay = EmployeeWorkspaceDashboard['attendanceDays'][number];

interface CalendarCell {
  day: number | null;
  iso: string | null;
  kind: 'off' | 'present' | 'absent' | 'none';
}

@Component({
  selector: 'app-portal-attendance-page',
  standalone: true,
  imports: [RouterLink, PortalIconComponent, PortalPromptComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-attendance-page.component.html',
})
export class PortalAttendancePageComponent {
  protected readonly workspace = inject(PortalWorkspaceService);
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);

  protected readonly formatTime = formatManilaTime;
  protected readonly formatDateTime = formatManilaDateTime;
  protected readonly monthTitle = monthTitle;
  protected readonly weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  protected readonly showAll = signal(false);

  protected readonly initial = computed(() => this.workspace.firstName().slice(0, 1).toUpperCase());
  protected readonly todayKey = computed(() => this.workspace.dashboard()?.workDate?.slice(0, 10) ?? '');
  protected readonly today = computed(() => this.workspace.dashboard()?.today ?? null);
  protected readonly records = computed(() =>
    [...(this.workspace.dashboard()?.attendanceDays ?? [])].sort((a, b) =>
      b.workDate.localeCompare(a.workDate),
    ),
  );
  protected readonly visible = computed(() =>
    this.showAll() ? this.records() : this.records().slice(0, 4),
  );
  protected readonly missing = computed(
    () =>
      this.records().filter(
        (row) => row.timeIn && !row.timeOut && row.workDate.slice(0, 10) !== this.todayKey(),
      ).length,
  );
  protected readonly clockedIn = computed(() => {
    const today = this.today();
    return Boolean(today?.timeIn) && !today?.timeOut;
  });
  protected readonly clockedOut = computed(() => Boolean(this.today()?.timeOut));
  protected readonly place = computed(() => locationLabel(this.workspace.clock()?.expectedLocation));
  protected readonly greeting = computed(() => manilaGreeting(this.workspace.clock()?.serverNow));
  protected readonly viewingCurrentMonth = computed(() => {
    const workMonth = this.workspace.dashboard()?.workDate?.slice(0, 7);
    return Boolean(workMonth) && workMonth === this.workspace.month();
  });
  protected readonly periodLabel = computed(() => {
    if (this.viewingCurrentMonth()) {
      return cutoffWindow(this.workspace.dashboard()?.workDate)?.label ?? monthTitle(this.workspace.month());
    }
    return monthTitle(this.workspace.month());
  });
  protected readonly daysPresent = computed(() => this.periodRows().filter((row) => row.timeIn).length);
  protected readonly daysAbsent = computed(() => this.countAbsent());
  protected readonly lateArrivals = computed(() => this.periodRows().filter((row) => row.late).length);
  protected readonly timeInLines = computed(() => this.punchLines('in'));
  protected readonly timeOutLines = computed(() => this.punchLines('out'));
  protected readonly timeInSelfie = computed(() =>
    this.api.resolveAttendanceSelfieUrl(this.today()?.timeInSelfieUrl),
  );
  protected readonly timeOutSelfie = computed(() =>
    this.api.resolveAttendanceSelfieUrl(this.today()?.timeOutSelfieUrl),
  );
  protected readonly actionLabel = computed(() => {
    const today = this.today();
    if (!today?.timeIn) {
      return 'Take selfie to time in';
    }
    if (!today.timeOut) {
      return 'Take selfie to time out';
    }
    return 'Review time clock';
  });
  protected readonly weeks = computed(() => this.buildWeeks());

  protected hoursLabel(value: number | null | undefined): string {
    return formatHoursShort(value);
  }

  protected recordBadge(row: AttendanceDay): 'Clocked in' | 'Incomplete' | 'Present' {
    const open =
      row.workDate.slice(0, 10) === this.todayKey() && Boolean(row.timeIn) && !row.timeOut;
    if (open) {
      return 'Clocked in';
    }
    if (!row.timeOut) {
      return 'Incomplete';
    }
    return 'Present';
  }

  protected recordDetail(row: AttendanceDay): string {
    const open = row.workDate.slice(0, 10) === this.todayKey() && Boolean(row.timeIn) && !row.timeOut;
    if (open && row.timeIn) {
      const bits = [formatManilaTime(row.timeIn)];
      if (row.hasTimeInSelfie) {
        bits.push('Selfie');
      }
      const place = shortPlace(row.locationLabel);
      if (place) {
        bits.push(place);
      }
      return bits.join(' · ');
    }
    if (row.timeIn && row.timeOut) {
      return `${formatManilaTime(row.timeIn)} – ${formatManilaTime(row.timeOut)}`;
    }
    if (row.timeIn) {
      return formatManilaTime(row.timeIn);
    }
    return 'No punch';
  }

  protected cellClass(kind: CalendarCell['kind']): string {
    switch (kind) {
      case 'present':
        return 'bg-portal-green-wash font-semibold text-portal-green';
      case 'absent':
        return 'bg-[#fff1f2] font-semibold text-portal-danger';
      case 'off':
        return 'bg-portal-amber-wash font-semibold text-portal-amber';
      default:
        return 'text-portal-ink';
    }
  }

  protected dayLabel(iso: string): string {
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  protected requestCorrection(): void {
    const fix =
      this.records().find((row) => row.canRequestTimeOutAdjustment) ??
      this.records().find((row) => row.timeIn && !row.timeOut);
    const date = fix?.workDate.slice(0, 10) || this.todayKey() || `${this.workspace.month()}-01`;
    void this.router.navigate(['/user/correction', date]);
  }

  protected openCorrection(iso: string): void {
    void this.router.navigate(['/user/correction', iso]);
  }

  private punchLines(kind: 'in' | 'out'): { value: string; detail: string; address: string } {
    const today = this.today();
    const punched = kind === 'in' ? today?.timeIn : today?.timeOut;
    if (!punched) {
      return {
        value: 'Selfie required',
        detail:
          kind === 'in' ? 'Coordinates are saved with the selfie' : 'New coordinates when you time out',
        address: 'Address is saved with that selfie',
      };
    }
    const clock = this.workspace.clock();
    const coords =
      kind === 'in'
        ? formatCoordinates(clock?.locationLat ?? today?.locationLat, clock?.locationLng ?? today?.locationLng)
        : formatCoordinates(
            clock?.timeOutLocationLat ?? today?.timeOutLocationLat,
            clock?.timeOutLocationLng ?? today?.timeOutLocationLng,
          );
    const label =
      kind === 'in'
        ? clock?.locationLabel || today?.locationLabel
        : clock?.timeOutLocationLabel || today?.timeOutLocationLabel;
    return {
      value: formatManilaTime(punched),
      detail: coords || 'Selfie on file',
      address: label?.trim() || this.place(),
    };
  }

  private periodRows(): AttendanceDay[] {
    const rows = this.records();
    const data = this.workspace.dashboard();
    if (!data || !this.viewingCurrentMonth()) {
      return rows;
    }
    const window = cutoffWindow(data.workDate);
    if (!window) {
      return rows;
    }
    return rows.filter((row) => {
      const day = row.workDate.slice(0, 10);
      return day >= window.from && day <= window.to;
    });
  }

  private countAbsent(): number {
    const data = this.workspace.dashboard();
    if (!data?.workDate) {
      return 0;
    }
    const today = data.workDate.slice(0, 10);
    const window = this.viewingCurrentMonth() ? cutoffWindow(data.workDate) : null;
    const month = this.workspace.month();
    const from = window?.from ?? `${month}-01`;
    const to = window?.to ?? `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
    const present = new Set(
      this.records()
        .filter((row) => row.timeIn)
        .map((row) => row.workDate.slice(0, 10)),
    );
    const off = new Set((data.dayOffs ?? []).map((row) => row.dayOffDate.slice(0, 10)));
    const workWeek = data.workWeek ?? 'mon_fri';
    let absent = 0;
    const [year, mon] = from.split('-').map(Number);
    const startDay = Number(from.slice(8, 10));
    const endDay = Number(to.slice(8, 10));
    for (let day = startDay; day <= endDay; day += 1) {
      const iso = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (iso >= today || !isScheduledWorkday(iso, workWeek) || off.has(iso) || present.has(iso)) {
        continue;
      }
      absent += 1;
    }
    return absent;
  }

  private buildWeeks(): CalendarCell[][] {
    const month = this.workspace.month();
    const [year, mon] = month.split('-').map(Number);
    if (!year || !mon) {
      return [];
    }
    const data = this.workspace.dashboard();
    const todayKey = data?.workDate?.slice(0, 10) ?? '';
    const present = new Set(
      (data?.attendanceDays ?? [])
        .filter((row) => row.timeIn)
        .map((row) => row.workDate.slice(0, 10)),
    );
    const off = new Set((data?.dayOffs ?? []).map((row) => row.dayOffDate.slice(0, 10)));
    const cells: Array<number | null> = [
      ...Array.from({ length: weekdaySunday0(month, 1) }, () => null),
      ...Array.from({ length: daysInMonth(month) }, (_, index) => index + 1),
    ];
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    const weeks: CalendarCell[][] = [];
    for (let index = 0; index < cells.length; index += 7) {
      weeks.push(
        cells.slice(index, index + 7).map((day) => {
          const iso = day == null ? null : `${month}-${String(day).padStart(2, '0')}`;
          const weekday = day == null ? 0 : new Date(year, mon - 1, day).getDay();
          const workday = weekday >= 1 && weekday <= 5;
          const kind: CalendarCell['kind'] =
            iso && off.has(iso)
              ? 'off'
              : iso && present.has(iso)
                ? 'present'
                : iso && todayKey && iso < todayKey && workday
                  ? 'absent'
                  : 'none';
          return { day, iso, kind };
        }),
      );
    }
    return weeks;
  }
}

function locationLabel(value: string | null | undefined): string {
  switch (value) {
    case 'wfh':
      return 'Work from home';
    case 'off':
      return 'Day off';
    case 'office':
      return 'Head office';
    default:
      return value?.trim() || 'Workplace';
  }
}

function manilaGreeting(serverNow: string | null | undefined): string {
  const date = serverNow ? new Date(serverNow) : new Date();
  const hour = Number(
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

function isScheduledWorkday(iso: string, workWeek: string): boolean {
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = new Date(year, (month || 1) - 1, day || 1).getDay();
  if (workWeek === 'mon_sat') {
    return weekday >= 1 && weekday <= 6;
  }
  return weekday >= 1 && weekday <= 5;
}
