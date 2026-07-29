import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ClientProspectDetail } from '../../services/admin-api.service';
import { AdminAuthService } from '../../services/admin-auth.service';
import {
  buildProgressStatusOptions,
  canUpdateProspect,
  FOLLOW_UP_METHODS,
  followUpsRemaining,
  hasReachedFollowUpLimit,
  isAvailableProspect,
  isAwaitingMeetingOutcome,
  PROSPECT_MEETING_OUTCOME_STATUSES,
  PROSPECT_POST_WIN_STATUSES,
  prospectStatusLabel,
} from './prospect-status.util';
import { formatDealAmount } from './prospect-deal.util';

const MEETING_TYPES = [
  { value: 'face_to_face', label: 'Face to Face' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'gmeet', label: 'Google Meet' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'zoom', label: 'Zoom' },
];

@Component({
  selector: 'app-lead-prospect-update-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './lead-prospect-update-page.component.html',
})
export class LeadProspectUpdatePageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  readonly followUpMethods = FOLLOW_UP_METHODS;
  readonly meetingTypes = MEETING_TYPES;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly conflictMessage = signal('');
  readonly prospect = signal<ClientProspectDetail | null>(null);
  readonly userRole = signal('');
  readonly recordingOutcome = signal(false);
  readonly statusOptions = signal<Array<{ value: string; label: string }>>([]);

  // Chip and menu states
  readonly moduleDetailChip = signal<{ moduleIndex: number; chip: 'menu' | 'features' | 'processFlow' } | null>(null);
  readonly moduleMenuOpen = signal<number | null>(null);

  readonly paymentExceedsDeal = signal(false);

  readonly statusLabel = prospectStatusLabel;
  readonly followUpsRemaining = followUpsRemaining;
  readonly hasReachedFollowUpLimit = hasReachedFollowUpLimit;
  readonly formatDealAmount = formatDealAmount;

  readonly updateForm = this.formBuilder.nonNullable.group({
    status: ['follow_up', [Validators.required]],
    followUpDate: [this.todayIsoDate(), [Validators.required]],
    followUpMethod: ['call', [Validators.required]],
    remarks: [''],
    notes: [''],
    title: ['Client meeting'],
    date: [''],
    startTime: ['09:00'],
    endTime: ['10:00'],
    meetingType: ['face_to_face'],
    locationOrLink: [''],
    returnRemarks: [''],
    projectName: [''],
    projectType: [''],
    signedAt: [''],
    contractRemarks: [''],
    contractNotes: [''],
    contractReviewRemarks: [''],
    responseDate: [''],
    modules: this.formBuilder.array([this.createModuleGroup()]),
    milestones: this.formBuilder.array([this.createMilestoneGroup()]),
    paymentSchedule: this.formBuilder.array([this.createPaymentScheduleGroup()]),
  });

  ngOnInit(): void {
    this.userRole.set(this.adminAuth.getStoredUser()?.role ?? '');
    void this.load();

    // Update validators when status changes
    this.updateForm.controls.status.valueChanges.subscribe((status) => {
      this.updateContractValidators(status === 'contract_signed');
    });
  }

  isFollowUpStatus(): boolean {
    return !this.recordingOutcome() && this.updateForm.controls.status.value === 'follow_up';
  }

  isMeetingStatus(): boolean {
    return !this.recordingOutcome() && this.updateForm.controls.status.value === 'meeting_set';
  }

  isReturnToAvailable(): boolean {
    return this.updateForm.controls.status.value === 'return_to_available';
  }

  isMeetingNoShowOutcome(): boolean {
    return this.recordingOutcome() && this.updateForm.controls.status.value === 'no_response';
  }

  isMeetingPendingDecisionOutcome(): boolean {
    return this.recordingOutcome() && this.updateForm.controls.status.value === 'pending_decision';
  }

  isContractSignedStatus(): boolean {
    return this.updateForm.controls.status.value === 'contract_signed';
  }

  isContractUnderReviewStatus(): boolean {
    return this.updateForm.controls.status.value === 'contract_under_review';
  }

  updateContractValidators(isContractSigned: boolean): void {
    const projectNameControl = this.updateForm.controls.projectName;
    const projectTypeControl = this.updateForm.controls.projectType;
    const signedAtControl = this.updateForm.controls.signedAt;
    const contractRemarksControl = this.updateForm.controls.contractRemarks;
    const contractNotesControl = this.updateForm.controls.contractNotes;

    if (isContractSigned) {
      projectNameControl.setValidators([Validators.required]);
      projectTypeControl.setValidators([Validators.required]);
      signedAtControl.setValidators([Validators.required]);
    } else {
      projectNameControl.clearValidators();
      projectTypeControl.clearValidators();
      signedAtControl.clearValidators();
    }

    projectNameControl.updateValueAndValidity();
    projectTypeControl.updateValueAndValidity();
    signedAtControl.updateValueAndValidity();
    contractRemarksControl.updateValueAndValidity();
    contractNotesControl.updateValueAndValidity();
  }

  get modulesForm(): FormArray {
    return this.updateForm.controls.modules;
  }

  get milestonesForm(): FormArray {
    return this.updateForm.controls.milestones;
  }

  get paymentScheduleForm(): FormArray {
    return this.updateForm.controls.paymentSchedule;
  }

  modulesControls() {
    return this.modulesForm.controls;
  }

  milestonesControls() {
    return this.milestonesForm.controls;
  }

  paymentScheduleControls() {
    return this.paymentScheduleForm.controls;
  }

  // Handle module menus
  toggleModuleMenu(index: number): void {
    this.moduleMenuOpen.update(current => current === index ? null : index);
  }

  openModuleFeatures(index: number): void {
    this.moduleDetailChip.set({ moduleIndex: index, chip: 'features' });
    this.moduleMenuOpen.set(null);
  }

  openModuleProcessFlow(index: number): void {
    this.moduleDetailChip.set({ moduleIndex: index, chip: 'processFlow' });
    this.moduleMenuOpen.set(null);
  }

  toggleModuleDetailChip(moduleIndex: number, chip: 'menu' | 'features' | 'processFlow'): void {
    const current = this.moduleDetailChip();
    if (current?.moduleIndex === moduleIndex && current.chip === chip) {
      this.moduleDetailChip.set(null);
      return;
    }
    this.moduleDetailChip.set({ moduleIndex, chip });
  }

  isModuleDetailChipActive(moduleIndex: number, chip: 'menu' | 'features' | 'processFlow'): boolean {
    const current = this.moduleDetailChip();
    return current?.moduleIndex === moduleIndex && current.chip === chip;
  }

  proposedDealAmount(item: ClientProspectDetail): number {
    return item.estimatedPriceDealPhp || item.proposedPriceDeal || 0;
  }

  paymentTotal(): number {
    return this.paymentScheduleForm.controls.reduce(
      (sum, control) => sum + (Number(control.get('amount')?.value) || 0),
      0,
    );
  }

  checkPaymentTotal(): void {
    const prospect = this.prospect();
    if (!prospect) {
      this.paymentExceedsDeal.set(false);
      return;
    }

    const proposedDeal = prospect.estimatedPriceDealPhp || prospect.proposedPriceDeal || 0;
    const totalPayments = this.paymentScheduleForm.controls.reduce(
      (sum, control) => sum + (Number(control.get('amount')?.value) || 0),
      0,
    );
    this.paymentExceedsDeal.set(totalPayments > proposedDeal);
  }

  addModule(): void {
    this.modulesForm.push(this.createModuleGroup());
  }

  removeModule(index: number): void {
    if (this.modulesForm.length > 1) {
      this.modulesForm.removeAt(index);
    }
  }

  addMilestone(): void {
    this.milestonesForm.push(this.createMilestoneGroup());
  }

  removeMilestone(index: number): void {
    if (this.milestonesForm.length > 1) {
      this.milestonesForm.removeAt(index);
    }
  }

  addPaymentSchedule(): void {
    this.paymentScheduleForm.push(this.createPaymentScheduleGroup());
  }

  removePaymentSchedule(index: number): void {
    if (this.paymentScheduleForm.length > 1) {
      this.paymentScheduleForm.removeAt(index);
    }
  }

  private todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private refreshStatusOptions(item: ClientProspectDetail): void {
    if (this.recordingOutcome()) {
      this.statusOptions.set([...PROSPECT_MEETING_OUTCOME_STATUSES]);
      return;
    }
    if (item.status === 'closed_won') {
      this.statusOptions.set([...PROSPECT_POST_WIN_STATUSES]);
      return;
    }
    if (item.status === 'contract_under_review') {
      this.statusOptions.set([{ value: 'contract_signed', label: 'Contract Signed' }]);
      return;
    }
    this.statusOptions.set(buildProgressStatusOptions(item.followUpCount, item.maxFollowUps));
  }

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.getClientProspect(id));
      const item = response.data;
      this.prospect.set(item);
      this.recordingOutcome.set(isAwaitingMeetingOutcome(item.status));
      this.refreshStatusOptions(item);

      if (isAvailableProspect(item.status)) {
        this.error.set('Pick up this prospect before updating progress.');
      } else if (!canUpdateProspect(item.status, this.userRole())) {
        if (isAwaitingMeetingOutcome(item.status)) {
          this.error.set('Meeting is scheduled. View this prospect and wait for an admin to record the meeting outcome.');
        } else if (item.status === 'contract_signed') {
          this.error.set('This contract is already signed.');
        } else {
          this.error.set('This prospect cannot be updated.');
        }
      } else if (this.recordingOutcome()) {
        this.updateForm.patchValue({ status: 'closed_won' });
      } else if (item.status === 'closed_won') {
        this.updateForm.patchValue({
          status: 'contract_signed',
          projectName: item.contract?.projectName ?? '',
          projectType: item.contract?.projectType ?? '',
          signedAt: item.contract?.signedAt ?? this.todayIsoDate(),
          contractRemarks: item.contract?.remarks ?? '',
        });
        this.resetContractArrays(item);
        this.checkPaymentTotal();
      } else if (item.status === 'contract_under_review') {
        this.updateForm.patchValue({
          status: 'contract_signed',
          projectName: item.contract?.projectName ?? '',
          projectType: item.contract?.projectType ?? '',
          signedAt: item.contract?.signedAt ?? this.todayIsoDate(),
          contractRemarks: item.contract?.remarks ?? '',
        });
        this.resetContractArrays(item);
        this.checkPaymentTotal();
      } else if (!hasReachedFollowUpLimit(item.followUpCount, item.maxFollowUps)) {
        this.updateForm.patchValue({ status: 'follow_up' });
      }
    } catch {
      this.error.set('Unable to load client prospect.');
    } finally {
      this.loading.set(false);
    }
  }

  async checkConflicts(): Promise<void> {
    if (!this.isMeetingStatus()) {
      this.conflictMessage.set('');
      return;
    }

    const value = this.updateForm.getRawValue();
    if (!value.date || !value.startTime || !value.endTime) {
      this.conflictMessage.set('');
      return;
    }

    const startsAt = this.toIso(value.date, value.startTime);
    const endsAt = this.toIso(value.date, value.endTime);
    try {
      const response = await firstValueFrom(this.adminApi.checkAppointmentConflicts(startsAt, endsAt));
      this.conflictMessage.set(
        response.data.length > 0
          ? 'Time conflict detected with an existing appointment.'
          : 'No time conflicts for this slot.',
      );
    } catch {
      this.conflictMessage.set('');
    }
  }

  async submit(): Promise<void> {
    const item = this.prospect();
    if (!item || this.updateForm.invalid || !canUpdateProspect(item.status, this.userRole())) {
      this.updateForm.markAllAsTouched();
      return;
    }

    const value = this.updateForm.getRawValue();

    if (value.status === 'follow_up') {
      if (!value.followUpDate || !value.followUpMethod) {
        this.error.set('Follow-up date and method are required.');
        return;
      }
    }

    if (value.status === 'return_to_available' && !value.returnRemarks.trim()) {
      this.error.set('Remarks are required when returning a prospect to Available.');
      return;
    }

    if (value.status === 'meeting_set' && (!value.date || !value.title.trim())) {
      this.error.set('Meeting title and date are required.');
      return;
    }

    if (value.status === 'contract_signed' && !this.isContractFormValid()) {
      this.updateForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');
    try {
      const payload: Parameters<AdminApiService['updateClientProspectStatus']>[1] = {
        status: value.status,
      };

      if (value.status === 'follow_up') {
        payload.followUpDate = value.followUpDate;
        payload.followUpMethod = value.followUpMethod;
        payload.remarks = value.remarks || undefined;
        payload.notes = value.notes || undefined;
      } else if (value.status === 'return_to_available') {
        payload.notes = value.returnRemarks;
      } else {
        payload.notes = value.notes || undefined;
      }

      if (value.status === 'meeting_set') {
        payload.title = value.title;
        payload.startsAt = this.toIso(value.date, value.startTime);
        payload.endsAt = this.toIso(value.date, value.endTime);
        payload.meetingType = value.meetingType;
        payload.locationOrLink = value.locationOrLink || undefined;
      } else if (value.status === 'contract_under_review') {
        payload.contractReviewRemarks = value.contractReviewRemarks || undefined;
        payload.responseDate = value.responseDate || undefined;
      } else if (value.status === 'contract_signed') {
        payload.contract = {
          projectName: value.projectName.trim(),
          projectType: value.projectType.trim(),
          signedAt: value.signedAt || undefined,
          remarks: value.contractRemarks || undefined,
          modules: this.modulesForm.controls.map((control) => ({
            name: String(control.get('name')?.value ?? '').trim(),
            description: this.optionalText(control.get('description')?.value),
            features: this.optionalText(control.get('features')?.value),
            processFlow: this.optionalText(control.get('processFlow')?.value),
          })),
          milestones: this.milestonesForm.controls.map((control) => ({
            title: String(control.get('title')?.value ?? '').trim(),
            description: this.optionalText(control.get('description')?.value),
            dueDate: this.optionalText(control.get('dueDate')?.value),
            connectedModuleId: this.optionalText(control.get('connectedModuleId')?.value),
          })),
          paymentSchedule: this.paymentScheduleForm.controls.map((control) => ({
            label: String(control.get('label')?.value ?? '').trim(),
            amount: Number(control.get('amount')?.value),
            dueDate: this.optionalText(control.get('dueDate')?.value),
            notes: this.optionalText(control.get('notes')?.value),
            connectedMilestoneId: this.optionalText(control.get('connectedMilestoneId')?.value),
          })),
        };
      }

      await firstValueFrom(this.adminApi.updateClientProspectStatus(item.id, payload));

      if (value.status === 'return_to_available') {
        await this.router.navigate(['/admin/lead-generation']);
        return;
      }

      await this.router.navigate(['/admin/lead-generation', item.id, 'view']);
    } catch {
      this.error.set('Unable to update prospect progress. Check follow-up limits and required fields.');
    } finally {
      this.saving.set(false);
    }
  }

  private toIso(date: string, time: string): string {
    return new Date(`${date}T${time}:00`).toISOString();
  }

  private createModuleGroup(value?: {
    name?: string;
    description?: string | null;
    features?: string | null;
    processFlow?: string | null;
  }) {
    return this.formBuilder.group({
      name: [value?.name ?? '', [Validators.required]],
      description: [value?.description ?? ''],
      features: [value?.features ?? ''],
      processFlow: [value?.processFlow ?? ''],
    });
  }

  private createMilestoneGroup(value?: {
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    connectedModuleId?: string | null;
  }) {
    return this.formBuilder.group({
      title: [value?.title ?? '', [Validators.required]],
      description: [value?.description ?? ''],
      dueDate: [value?.dueDate ?? ''],
      connectedModuleId: [value?.connectedModuleId ?? ''],
    });
  }

  private createPaymentScheduleGroup(value?: {
    label?: string;
    amount?: number | null;
    dueDate?: string | null;
    notes?: string | null;
    connectedMilestoneId?: string | null;
  }) {
    return this.formBuilder.group({
      label: [value?.label ?? '', [Validators.required]],
      amount: [value?.amount != null ? String(value.amount) : '', [Validators.required]],
      dueDate: [value?.dueDate ?? ''],
      notes: [value?.notes ?? ''],
      connectedMilestoneId: [value?.connectedMilestoneId ?? ''],
    });
  }

  private resetContractArrays(item: ClientProspectDetail): void {
    this.modulesForm.clear();
    this.milestonesForm.clear();
    this.paymentScheduleForm.clear();

    const contract = item.contract;
    const modules = contract?.modules?.length ? contract.modules : [undefined];
    const milestones = contract?.milestones?.length ? contract.milestones : [undefined];
    const paymentSchedule = contract?.paymentSchedule?.length ? contract.paymentSchedule : [undefined];

    for (const module of modules) {
      this.modulesForm.push(this.createModuleGroup(module));
    }
    for (const milestone of milestones) {
      this.milestonesForm.push(this.createMilestoneGroup(milestone));
    }
    for (const payment of paymentSchedule) {
      this.paymentScheduleForm.push(this.createPaymentScheduleGroup(payment));
    }
  }

  private isContractFormValid(): boolean {
    const value = this.updateForm.getRawValue();

    if (!value.projectName.trim() || !value.projectType.trim()) {
      this.error.set('Project name and project type are required.');
      return false;
    }

    if (!value.signedAt) {
      this.error.set('Signed date is required.');
      return false;
    }

    if (
      this.modulesForm.length === 0
      || this.milestonesForm.length === 0
      || this.paymentScheduleForm.length === 0
    ) {
      this.error.set('Add at least one module, milestone, and payment schedule item.');
      return false;
    }

    for (const control of this.modulesForm.controls) {
      const name = String(control.get('name')?.value ?? '').trim();
      if (!name) {
        this.error.set('Each module needs a name.');
        return false;
      }
    }

    for (const control of this.milestonesForm.controls) {
      const title = String(control.get('title')?.value ?? '').trim();
      if (!title) {
        this.error.set('Each milestone needs a title.');
        return false;
      }
    }

    for (const control of this.paymentScheduleForm.controls) {
      const label = String(control.get('label')?.value ?? '').trim();
      const amount = this.parseOptionalNumber(control.get('amount')?.value);
      if (!label || amount === null) {
        this.error.set('Each payment schedule row needs a label and amount.');
        return false;
      }
    }

    if (this.paymentExceedsDeal()) {
      this.error.set('Total payments exceed proposed deal amount.');
      return false;
    }

    return true;
  }

  private isNumericOrEmpty(value: unknown): boolean {
    if (value === '' || value === null || value === undefined) {
      return true;
    }
    return Number.isFinite(Number(value));
  }

  private parseOptionalNumber(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private optionalText(value: unknown): string | undefined {
    const text = String(value ?? '').trim();
    return text ? text : undefined;
  }
}
