import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  isClosedProspect,
  PROSPECT_MEETING_OUTCOME_STATUSES,
  prospectStatusLabel,
} from './prospect-status.util';

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

  readonly statusLabel = prospectStatusLabel;
  readonly followUpsRemaining = followUpsRemaining;
  readonly hasReachedFollowUpLimit = hasReachedFollowUpLimit;

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
  });

  ngOnInit(): void {
    this.userRole.set(this.adminAuth.getStoredUser()?.role ?? '');
    void this.load();
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

  private todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private refreshStatusOptions(item: ClientProspectDetail): void {
    if (this.recordingOutcome()) {
      this.statusOptions.set([...PROSPECT_MEETING_OUTCOME_STATUSES]);
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
      } else if (isClosedProspect(item.status)) {
        this.error.set('This prospect is already closed.');
      } else if (!canUpdateProspect(item.status, this.userRole())) {
        if (isAwaitingMeetingOutcome(item.status)) {
          this.error.set('Meeting is scheduled. View this prospect and wait for an admin to record the meeting outcome.');
        } else {
          this.error.set('This prospect cannot be updated.');
        }
      } else if (this.recordingOutcome()) {
        this.updateForm.patchValue({ status: 'closed_won' });
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
}
