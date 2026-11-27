import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { daysInMonth, formatMoney, monthTitle } from '../core/portal-format';
import { workTrack } from '../core/portal-role';
import { PortalWorkspaceService } from '../core/portal-workspace.service';
import { PortalIconComponent } from '../ui/portal-icon.component';

/**
 * Monthly sales quota for the Work tab.
 * Amounts stay at 0 until job orders, shared sales, and incentives are available to the portal.
 */
interface QuotaParts {
  target: number;
  ownSales: number;
  sharedSales: number;
  incentives: number;
}

const MONTHLY_TARGET = 0;

/** One amount that counted toward the month, and where it came from. */
interface QuotaEntry {
  id: string;
  date: string;
  detail: string;
  source: 'own' | 'shared' | 'incentive';
  amount: number;
}

@Component({
  selector: 'app-portal-work-page',
  standalone: true,
  imports: [PortalIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-work-page.component.html',
})
export class PortalWorkPageComponent {
  protected readonly workspace = inject(PortalWorkspaceService);
  protected readonly money = formatMoney;

  protected readonly showAll = signal(false);
  protected readonly track = computed(() => workTrack(this.workspace.role()));
  /** Filled when job orders, shared sales, and incentives are available to the portal. */
  protected readonly entries = computed<QuotaEntry[]>(() => []);
  protected readonly visibleEntries = computed(() =>
    this.showAll() ? this.entries() : this.entries().slice(0, 4),
  );
  protected readonly quota = computed<QuotaParts>(() => {
    const entries = this.entries();
    const sum = (source: QuotaEntry['source']) =>
      entries.filter((entry) => entry.source === source).reduce((total, entry) => total + entry.amount, 0);
    return {
      target: MONTHLY_TARGET,
      ownSales: sum('own'),
      sharedSales: sum('shared'),
      incentives: sum('incentive'),
    };
  });
  protected readonly earned = computed(
    () => this.quota().ownSales + this.quota().sharedSales + this.quota().incentives,
  );
  protected readonly percent = computed(() => {
    const target = this.quota().target;
    if (target <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((this.earned() / target) * 100));
  });
  protected readonly remaining = computed(() => Math.max(0, this.quota().target - this.earned()));
  protected readonly onTrack = computed(() => this.quota().target > 0 && this.percent() >= 80);
  protected readonly periodLabel = computed(() => {
    const month = this.workspace.month();
    const [year] = month.split('-').map(Number);
    const short = monthTitle(month).slice(0, 3);
    return `${short} 1 – ${daysInMonth(month)}, ${year || ''}`.trim();
  });

  protected dayLabel(iso: string): string {
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  /** Width of one slice against the quota, or against the total when it is already over. */
  protected sliceWidth(amount: number): number {
    const target = this.quota().target;
    const earned = this.earned();
    const base = Math.max(target, earned);
    if (base <= 0 || amount <= 0) {
      return 0;
    }
    return (amount / base) * 100;
  }
}
