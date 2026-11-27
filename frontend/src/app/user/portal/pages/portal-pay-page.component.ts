import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, EmployeePayslipItem } from '../../../admin/services/admin-api.service';
import { cutoffWindow, formatMoney } from '../core/portal-format';
import { portalErrorMessage, PortalWorkspaceService } from '../core/portal-workspace.service';
import { PortalIconComponent } from '../ui/portal-icon.component';
import { PortalPromptComponent } from '../ui/portal-prompt.component';

interface PayEstimate {
  dateFrom: string;
  dateTo: string;
  released: boolean;
  basePay: number;
  overtimePay: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  lines: Array<{
    lineType: 'commission' | 'late_deduction' | 'loan_deduction' | 'manual_deduction';
    label: string;
    amount: number;
  }>;
}

@Component({
  selector: 'app-portal-pay-page',
  standalone: true,
  imports: [RouterLink, PortalIconComponent, PortalPromptComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-pay-page.component.html',
})
export class PortalPayPageComponent implements OnInit {
  protected readonly workspace = inject(PortalWorkspaceService);
  private readonly api = inject(AdminApiService);

  protected readonly formatMoney = formatMoney;
  protected readonly hidden = signal(false);
  protected readonly showGross = signal(false);
  protected readonly showAll = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly downloadingId = signal<string | null>(null);
  protected readonly estimate = signal<PayEstimate | null>(null);

  protected readonly initial = computed(() => this.workspace.firstName().slice(0, 1).toUpperCase());
  protected readonly greeting = computed(() => manilaGreeting(this.workspace.clock()?.serverNow));
  protected readonly periodLabel = computed(() => {
    const estimate = this.estimate();
    if (estimate) {
      return rangeLabel(estimate.dateFrom, estimate.dateTo);
    }
    return cutoffWindow(this.workspace.dashboard()?.workDate)?.label ?? '';
  });
  protected readonly paydayLabel = computed(() => {
    const estimate = this.estimate();
    return estimate ? shortDate(nextPayday(estimate.dateTo)) : '';
  });
  protected readonly shownAmount = computed(() => {
    const estimate = this.estimate();
    if (!estimate) {
      return this.hidden() ? '₱••••' : formatMoney(0);
    }
    if (this.hidden()) {
      return '₱••••';
    }
    return formatMoney(this.showGross() ? estimate.grossPay : estimate.netPay);
  });
  protected readonly amountCaption = computed(() =>
    this.showGross() ? 'Earnings before deductions' : 'Take-home estimate after deductions',
  );
  protected readonly earningLines = computed(() => {
    const estimate = this.estimate();
    if (!estimate) {
      return [];
    }
    const lines: Array<{ label: string; amount: number; deduct: boolean }> = [
      { label: 'Gross earnings', amount: estimate.grossPay, deduct: false },
    ];
    for (const line of estimate.lines) {
      if (line.lineType === 'commission') {
        continue;
      }
      lines.push({
        label: line.label || deductionName(line.lineType),
        amount: line.amount,
        deduct: true,
      });
    }
    return lines;
  });
  protected readonly slips = computed(() => this.workspace.dashboard()?.payslips ?? []);
  protected readonly visibleSlips = computed(() =>
    this.showAll() ? this.slips() : this.slips().slice(0, 3),
  );

  ngOnInit(): void {
    void this.load();
  }

  protected money(value: number, deduct = false): string {
    if (this.hidden()) {
      return '₱••••';
    }
    return deduct ? `-${formatMoney(value)}` : formatMoney(value);
  }

  protected slipTitle(slip: EmployeePayslipItem): string {
    return rangeLabel(slip.dateFrom, slip.dateTo);
  }

  protected slipDetail(slip: EmployeePayslipItem): string {
    const paid = shortDate(nextPayday(slip.dateTo));
    const net = this.hidden() ? '₱••••' : formatMoney(slip.estimatedPay);
    return `Paid ${paid} · Net ${net}`;
  }

  protected async download(slip: EmployeePayslipItem, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.downloadingId.set(slip.id);
    try {
      const blob = await firstValueFrom(this.api.downloadEmployeePayslipPdf(slip.id, true));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip-${slip.dateFrom}-${slip.dateTo}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.error.set(portalErrorMessage(error, 'Could not download that payslip.'));
    } finally {
      this.downloadingId.set(null);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.api.getEmployeePayEstimate());
      this.estimate.set(response.data);
    } catch (error) {
      this.error.set(portalErrorMessage(error, 'Could not load this cut-off.'));
    } finally {
      this.loading.set(false);
    }
  }
}

function deductionName(lineType: PayEstimate['lines'][number]['lineType']): string {
  switch (lineType) {
    case 'late_deduction':
      return 'Late deduction';
    case 'loan_deduction':
      return 'Loan';
    case 'manual_deduction':
      return 'Deduction';
    default:
      return 'Commission';
  }
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function rangeLabel(from: string, to: string): string {
  const start = parts(from);
  const end = parts(to);
  if (!start || !end) {
    return `${from} – ${to}`;
  }
  if (start.year === end.year && start.month === end.month) {
    return `${MONTHS[start.month - 1]} ${start.day} – ${end.day}, ${start.year}`;
  }
  if (start.year === end.year) {
    return `${MONTHS[start.month - 1]} ${start.day} – ${MONTHS[end.month - 1]} ${end.day}, ${start.year}`;
  }
  return `${MONTHS[start.month - 1]} ${start.day}, ${start.year} – ${MONTHS[end.month - 1]} ${end.day}, ${end.year}`;
}

function shortDate(iso: string): string {
  const value = parts(iso);
  if (!value) {
    return iso;
  }
  return `${MONTHS[value.month - 1]} ${value.day}`;
}

/** Cut-offs ending on the 15th pay on the 20th. Month-end cut-offs pay on the 5th of the next month. */
function nextPayday(dateTo: string): string {
  const value = parts(dateTo);
  if (!value) {
    return dateTo;
  }
  if (value.day <= 15) {
    return `${value.year}-${pad(value.month)}-20`;
  }
  const month = value.month === 12 ? 1 : value.month + 1;
  const year = value.month === 12 ? value.year + 1 : value.year;
  return `${year}-${pad(month)}-05`;
}

function parts(iso: string): { year: number; month: number; day: number } | null {
  const match = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
