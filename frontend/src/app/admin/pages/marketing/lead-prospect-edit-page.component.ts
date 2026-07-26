import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ClientProspectDetail } from '../../services/admin-api.service';
import { canEditProspectDetails, isInProgressProspect, prospectStatusLabel } from './prospect-status.util';
import { ProspectDealFieldsComponent } from './prospect-deal-fields.component';
import { parseCommissionPercent, parseProposedPriceDeal } from './prospect-deal.util';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-lead-prospect-edit-page',
  imports: [ReactiveFormsModule, RouterLink, ProspectDealFieldsComponent],
  templateUrl: './lead-prospect-edit-page.component.html',
})
export class LeadProspectEditPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly prospect = signal<ClientProspectDetail | null>(null);
  readonly userRole = signal('');
  readonly statusLabel = prospectStatusLabel;
  readonly isClosedWon = (status: string) => status === 'closed_won';
  readonly isInProgress = isInProgressProspect;

  readonly editForm = this.formBuilder.nonNullable.group({
    clientName: ['', [Validators.required, Validators.minLength(2)]],
    company: [''],
    email: ['', [Validators.email]],
    phone: [''],
    address: [''],
    notes: [''],
    clientType: ['local'],
    currency: ['PHP'],
    proposedPriceDeal: [''],
    commissionPercent: [''],
  });

  ngOnInit(): void {
    this.userRole.set(this.adminAuth.getStoredUser()?.role ?? '');
    void this.load();
  }

  showCommissionedField(): boolean {
    return this.prospect()?.status === 'closed_won';
  }

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.getClientProspect(id));
      const item = response.data;
      if (!canEditProspectDetails(item.status, this.userRole())) {
        this.error.set(
          item.status === 'closed_won'
            ? 'Only Super Admin can edit closed won prospects.'
            : item.status === 'meeting_set'
              ? 'Meeting is scheduled. Edit client details after the meeting outcome is recorded.'
              : 'This prospect cannot be edited.',
        );
        this.prospect.set(item);
        return;
      }
      this.prospect.set(item);
      this.editForm.patchValue({
        clientName: item.clientName,
        company: item.company ?? '',
        email: item.email ?? '',
        phone: item.phone ?? '',
        address: item.address ?? '',
        notes: item.notes ?? '',
        clientType: item.clientType ?? 'local',
        currency: item.currency ?? 'PHP',
        proposedPriceDeal: item.proposedPriceDeal != null ? String(item.proposedPriceDeal) : '',
        commissionPercent: item.commissionPercent != null ? String(item.commissionPercent) : '',
      });
    } catch {
      this.error.set('Unable to load client prospect.');
    } finally {
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    const item = this.prospect();
    if (!item || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');
    const value = this.editForm.getRawValue();
    try {
      await firstValueFrom(
        this.adminApi.updateClientProspect(item.id, {
          clientName: value.clientName,
          company: value.company || undefined,
          email: value.email || undefined,
          phone: value.phone || undefined,
          address: value.address || undefined,
          notes: value.notes || undefined,
          clientType: value.clientType,
          currency: value.currency,
          proposedPriceDeal: parseProposedPriceDeal(value.proposedPriceDeal),
          commissionPercent: item.status === 'closed_won' ? parseCommissionPercent(value.commissionPercent) : undefined,
        }),
      );
      await this.router.navigate(['/admin/lead-generation', item.id, 'view']);
    } catch {
      this.error.set('Unable to save client details.');
    } finally {
      this.saving.set(false);
    }
  }
}
