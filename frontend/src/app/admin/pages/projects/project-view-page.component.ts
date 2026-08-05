import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  ProjectDetail,
  ProspectContractMilestone,
  ProspectContractModule,
  ProspectContractPaymentSchedule,
} from '../../services/admin-api.service';
import { formatDealAmount } from '../marketing/prospect-deal.util';

const PAYMENT_METHODS = ['Cash', 'Check', 'Bank Transfer', 'Wise', 'PayPal'] as const;

@Component({
  selector: 'app-project-view-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './project-view-page.component.html',
})
export class ProjectViewPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly paymentMethods = PAYMENT_METHODS;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly project = signal<ProjectDetail | null>(null);
  readonly settlingPaymentId = signal<number | null>(null);
  readonly paymentActionError = signal('');

  readonly settleModalOpen = signal(false);
  readonly settleTarget = signal<ProspectContractPaymentSchedule | null>(null);
  readonly settleDate = signal('');
  readonly settlePaymentMethod = signal('');
  readonly settleSettlementType = signal<'partial' | 'full'>('full');
  readonly settleAmount = signal('');
  readonly settleReferenceNumber = signal('');
  readonly settleCheckNumber = signal('');
  readonly settleCheckDate = signal('');
  readonly settleFormError = signal('');
  readonly settleSaving = signal(false);

  readonly milestones = computed(
    () => this.project()?.contract?.milestones ?? [],
  );
  readonly paymentSchedule = computed(
    () => this.project()?.contract?.paymentSchedule ?? [],
  );
  readonly paymentTotal = computed(() =>
    this.paymentSchedule().reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
  );
  readonly settledTotal = computed(() =>
    this.paymentSchedule().reduce(
      (sum, payment) => sum + (Number(payment.amountPaid) || 0),
      0,
    ),
  );
  readonly currency = computed(
    () => (this.project()?.currency || 'PHP').trim().toUpperCase() || 'PHP',
  );

  readonly settleRemainingBefore = computed(() => {
    const payment = this.settleTarget();
    if (!payment) {
      return 0;
    }
    return this.roundMoney(
      payment.remainingBalance ??
        Math.max(0, Number(payment.amount) - Number(payment.amountPaid || 0)),
    );
  });

  readonly settleAmountValue = computed(() => {
    if (this.settleSettlementType() === 'full') {
      return this.settleRemainingBefore();
    }
    const parsed = Number(this.settleAmount());
    return Number.isFinite(parsed) ? this.roundMoney(parsed) : 0;
  });

  readonly settleRemainingAfter = computed(() =>
    Math.max(0, this.roundMoney(this.settleRemainingBefore() - this.settleAmountValue())),
  );

  readonly formatDealAmount = formatDealAmount;

  ngOnInit(): void {
    void this.load();
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  milestoneLabel(milestone: ProspectContractMilestone, index: number): string {
    const title = milestone.title?.trim();
    return title ? `Phase ${index + 1}: ${title}` : `Phase ${index + 1}`;
  }

  linkedModuleNames(
    modules: ProspectContractModule[],
    connectedModuleId: string | null | undefined,
  ): string {
    if (!connectedModuleId) {
      return '—';
    }

    const names = connectedModuleId
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((index) => Number.isInteger(index) && index >= 0 && index < modules.length)
      .map((index) => modules[index]?.name || `Module ${index + 1}`);

    return names.length ? names.join(', ') : '—';
  }

  paymentMilestoneLabel(
    payment: ProspectContractPaymentSchedule,
    milestones: ProspectContractMilestone[],
  ): string {
    const linked = String(payment.connectedMilestoneId ?? '').trim();
    if (!linked) {
      return 'No milestone linked';
    }
    const milestoneIndex = Number(linked);
    if (!Number.isInteger(milestoneIndex) || milestoneIndex < 0 || milestoneIndex >= milestones.length) {
      return 'No milestone linked';
    }
    return this.milestoneLabel(milestones[milestoneIndex], milestoneIndex);
  }

  paymentForMilestone(milestoneIndex: number): ProspectContractPaymentSchedule | null {
    const payments = this.paymentSchedule();
    if (!payments.length) {
      return null;
    }

    const linked = payments.find((payment) => {
      const linkedIndex = Number(String(payment.connectedMilestoneId ?? '').trim());
      return Number.isInteger(linkedIndex) && linkedIndex === milestoneIndex;
    });
    if (linked) {
      return linked;
    }

    return payments[milestoneIndex] ?? null;
  }

  paymentAmountPaid(payment: ProspectContractPaymentSchedule): number {
    return this.roundMoney(Number(payment.amountPaid) || 0);
  }

  paymentRemaining(payment: ProspectContractPaymentSchedule): number {
    if (payment.remainingBalance != null) {
      return this.roundMoney(Number(payment.remainingBalance));
    }
    return Math.max(0, this.roundMoney(Number(payment.amount) - this.paymentAmountPaid(payment)));
  }

  paymentStatusBadge(payment: ProspectContractPaymentSchedule): {
    label: string;
    className: string;
  } {
    if (payment.status === 'paid' || this.paymentRemaining(payment) <= 0) {
      return { label: 'Settled', className: 'bg-emerald-50 text-emerald-700' };
    }
    if (payment.status === 'overdue') {
      return { label: 'Overdue', className: 'bg-red-50 text-red-700' };
    }
    if (this.paymentAmountPaid(payment) > 0) {
      return { label: 'Partial', className: 'bg-amber-50 text-amber-800' };
    }
    if (!payment.dueDate) {
      return { label: 'Pending', className: 'bg-slate-100 text-slate-700' };
    }
    const due = new Date(`${payment.dueDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!Number.isNaN(due.getTime())) {
      const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
      if (diffDays < 0) {
        return { label: 'Overdue', className: 'bg-red-50 text-red-700' };
      }
      if (diffDays <= 7) {
        return { label: 'Due soon', className: 'bg-amber-50 text-amber-800' };
      }
    }
    return { label: 'Pending', className: 'bg-sky-50 text-sky-700' };
  }

  canSettlePayment(payment: ProspectContractPaymentSchedule | null): boolean {
    return Boolean(payment && this.paymentRemaining(payment) > 0 && payment.status !== 'paid');
  }

  milestoneInvoiceNumber(milestoneIndex: number): string {
    return String(milestoneIndex + 1).padStart(3, '0');
  }

  canShowMilestoneBillingInvoice(milestoneIndex: number): boolean {
    if (!this.project()?.contract) {
      return false;
    }
    const payment = this.paymentForMilestone(milestoneIndex);
    if (!payment) {
      return true;
    }
    return payment.status !== 'paid' && this.paymentRemaining(payment) > 0;
  }

  onSettlePaymentMethodChange(method: string): void {
    this.settlePaymentMethod.set(method);
    this.settleFormError.set('');
    if (method === 'Cash') {
      this.settleReferenceNumber.set('');
      this.settleCheckNumber.set('');
      this.settleCheckDate.set('');
    } else if (method === 'Check') {
      this.settleReferenceNumber.set('');
    } else {
      this.settleCheckNumber.set('');
      this.settleCheckDate.set('');
    }
  }

  onSettleSettlementTypeChange(type: 'partial' | 'full'): void {
    this.settleSettlementType.set(type);
    this.settleFormError.set('');
    if (type === 'full') {
      this.settleAmount.set(String(this.settleRemainingBefore()));
    } else if (!this.settleAmount().trim()) {
      this.settleAmount.set('');
    }
  }

  openSettleModal(payment: ProspectContractPaymentSchedule): void {
    if (!this.canSettlePayment(payment)) {
      return;
    }
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const remaining = this.paymentRemaining(payment);
    this.settleTarget.set(payment);
    this.settleDate.set(`${yyyy}-${mm}-${dd}`);
    this.settlePaymentMethod.set('');
    this.settleSettlementType.set('full');
    this.settleAmount.set(String(remaining));
    this.settleReferenceNumber.set('');
    this.settleCheckNumber.set('');
    this.settleCheckDate.set('');
    this.settleFormError.set('');
    this.paymentActionError.set('');
    this.settleModalOpen.set(true);
  }

  closeSettleModal(): void {
    if (this.settleSaving()) {
      return;
    }
    this.settleModalOpen.set(false);
    this.settleTarget.set(null);
    this.settleFormError.set('');
  }

  async submitSettleModal(): Promise<void> {
    const project = this.project();
    const payment = this.settleTarget();
    if (!project || !payment) {
      return;
    }

    const date = this.settleDate().trim();
    const paymentMethod = this.settlePaymentMethod().trim();
    const settlementType = this.settleSettlementType();
    const referenceNumber = this.settleReferenceNumber().trim();
    const checkNumber = this.settleCheckNumber().trim();
    const checkDate = this.settleCheckDate().trim();
    const amount = this.settleAmountValue();

    if (!date || !paymentMethod) {
      this.settleFormError.set('Please fill out Date and Payment Method.');
      return;
    }
    if (!(this.paymentMethods as readonly string[]).includes(paymentMethod)) {
      this.settleFormError.set('Select a valid payment method.');
      return;
    }
    if (settlementType === 'partial') {
      if (!Number.isFinite(amount) || amount <= 0) {
        this.settleFormError.set('Enter a valid payment amount.');
        return;
      }
      if (amount > this.settleRemainingBefore()) {
        this.settleFormError.set('Amount cannot exceed the remaining balance.');
        return;
      }
    }
    if (paymentMethod === 'Check') {
      if (!checkNumber || !checkDate) {
        this.settleFormError.set('Please fill out Check Number and Check Date.');
        return;
      }
    } else if (paymentMethod !== 'Cash' && !referenceNumber) {
      this.settleFormError.set('Please fill out Reference Number.');
      return;
    }

    const payload: {
      date: string;
      paymentMethod: string;
      settlementType: 'partial' | 'full';
      amount?: number;
      referenceNumber?: string;
      checkNumber?: string;
      checkDate?: string;
    } = { date, paymentMethod, settlementType };

    if (settlementType === 'partial') {
      payload.amount = amount;
    }

    if (paymentMethod === 'Check') {
      payload.checkNumber = checkNumber;
      payload.checkDate = checkDate;
    } else if (paymentMethod !== 'Cash') {
      payload.referenceNumber = referenceNumber;
    }

    this.settleFormError.set('');
    this.settleSaving.set(true);
    this.settlingPaymentId.set(Number(payment.id));
    try {
      const response = await firstValueFrom(
        this.adminApi.settleProjectPayment(project.id, Number(payment.id), payload),
      );
      this.settleModalOpen.set(false);
      this.settleTarget.set(null);
      await this.load(false);
      await this.router.navigate([
        '/admin/projects',
        project.id,
        'receipts',
        response.data.settlement.id,
      ]);
    } catch (err) {
      const message =
        err instanceof HttpErrorResponse
          ? String(err.error?.message || err.message || '')
          : '';
      this.settleFormError.set(message.trim() || 'Unable to settle this payment.');
    } finally {
      this.settleSaving.set(false);
      this.settlingPaymentId.set(null);
    }
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private async load(showPageLoading = true): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (showPageLoading) {
      this.loading.set(true);
    }
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.getProject(id));
      this.project.set(response.data);
    } catch {
      this.error.set('Unable to load project details.');
    } finally {
      if (showPageLoading) {
        this.loading.set(false);
      }
    }
  }
}
