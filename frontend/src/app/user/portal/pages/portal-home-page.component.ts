import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatManilaTime, formatMoney, HOURS_TARGET, trimHours } from '../core/portal-format';
import { PortalWorkspaceService } from '../core/portal-workspace.service';
import { PortalIconComponent } from '../ui/portal-icon.component';
import { PortalPromptComponent } from '../ui/portal-prompt.component';

interface HomeRequest {
  label: string;
  link: string;
}

@Component({
  selector: 'app-portal-home-page',
  standalone: true,
  imports: [RouterLink, PortalIconComponent, PortalPromptComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-home-page.component.html',
})
export class PortalHomePageComponent {
  protected readonly workspace = inject(PortalWorkspaceService);
  protected readonly target = HOURS_TARGET;
  protected readonly hidden = signal(false);

  protected readonly formatTime = formatManilaTime;
  protected readonly trimHours = trimHours;

  protected readonly initial = computed(() => this.workspace.firstName().slice(0, 1).toUpperCase());
  protected readonly hours = computed(() => this.workspace.dashboard()?.monthSummary.totalHours ?? 0);
  protected readonly ratio = computed(() => Math.min(1, Math.max(0, this.hours() / this.target)));
  protected readonly percent = computed(() => Math.floor(this.ratio() * 100));
  protected readonly daysPresent = computed(
    () => this.workspace.dashboard()?.monthSummary.daysPresent ?? 0,
  );

  protected readonly latestPay = computed(() => {
    const pay = this.workspace.dashboard()?.payslips?.[0]?.estimatedPay;
    return pay == null ? '—' : formatMoney(pay);
  });
  protected readonly payText = computed(() => (this.hidden() ? '₱••••' : this.latestPay()));

  protected readonly timedIn = computed(() => !!this.workspace.dashboard()?.today.timeIn);
  protected readonly todayLabel = computed(() => {
    const message = this.workspace.clock()?.message?.trim();
    return message || (this.timedIn() ? 'Timed in' : 'No punch yet');
  });
  protected readonly canTimeOut = computed(() => this.workspace.clock()?.canTimeOut === true);

  protected readonly requests = computed<HomeRequest[]>(() => {
    const data = this.workspace.dashboard();
    const list: HomeRequest[] = [];
    if (data?.overtimeNotice?.message) {
      list.push({ label: data.overtimeNotice.message, link: '/user/attendance' });
    }
    if (data?.adjustmentNotice?.message) {
      list.push({ label: data.adjustmentNotice.message, link: '/user/attendance' });
    }
    const memos = this.workspace.pendingMemoCount();
    if (memos > 0) {
      list.push({
        label: `${memos} memo${memos === 1 ? '' : 's'} waiting for acknowledgement`,
        link: '/user/memos',
      });
    }
    const offs = data?.monthSummary.dayOffCount ?? 0;
    if (offs > 0) {
      list.push({ label: `${offs} day off${offs === 1 ? '' : 's'} this month`, link: '/user/attendance' });
    }
    return list;
  });

  protected readonly quickActions = [
    { label: 'Time clock', icon: 'clock', link: '/user/clock' },
    { label: 'Payslips', icon: 'payslip', link: '/user/pay' },
    { label: 'Attendance', icon: 'calendar', link: '/user/attendance' },
    { label: 'Timesheet', icon: 'timesheet', link: '/user/timesheet' },
  ] as const;

  protected toggleHidden(): void {
    this.hidden.update((value) => !value);
  }

  protected retry(): void {
    void this.workspace.refresh();
  }
}
