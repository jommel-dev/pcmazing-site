import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  ClientAppointmentItem,
  ClientProspectListItem,
  PaginationMeta,
  ProspectDealSummary,
  ProspectImportPreview,
} from '../../services/admin-api.service';
import { AdminAuthService } from '../../services/admin-auth.service';
import {
  canEditProspectDetails,
  canUpdateProspect,
  hasSuperAdminAccess,
  isAvailableProspect,
  isClosedProspect,
  PROSPECT_STATUS_TABS,
  prospectStatusClass,
  prospectStatusLabel,
} from './prospect-status.util';
import { ProspectDealFieldsComponent } from './prospect-deal-fields.component';
import { clientTypeLabel, formatDealAmount, parseProposedPriceDeal } from './prospect-deal.util';
import { downloadProspectImportTemplate } from './prospect-import.util';

@Component({
  selector: 'app-lead-generation-page',
  imports: [FormsModule, ReactiveFormsModule, RouterLink, ProspectDealFieldsComponent],
  templateUrl: './lead-generation-page.component.html',
})
export class LeadGenerationPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly formBuilder = inject(FormBuilder);

  readonly statusTabs = PROSPECT_STATUS_TABS;
  readonly statusLabel = prospectStatusLabel;
  readonly statusClass = prospectStatusClass;
  readonly isAvailable = isAvailableProspect;
  readonly isClosed = isClosedProspect;
  readonly userRole = signal('');
  readonly formatDealAmount = formatDealAmount;
  readonly canEditProspect = canEditProspectDetails;
  readonly clientTypeLabel = clientTypeLabel;

  readonly view = signal<'list' | 'calendar'>('list');
  readonly dealSummary = signal<ProspectDealSummary | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly actionMessage = signal('');
  readonly search = signal('');
  readonly status = signal('');
  readonly page = signal(1);
  readonly items = signal<ClientProspectListItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly fullAccess = signal(true);
  readonly appointments = signal<ClientAppointmentItem[]>([]);
  readonly createOpen = signal(false);
  readonly importOpen = signal(false);
  readonly importPreview = signal<ProspectImportPreview | null>(null);
  readonly importFile = signal<File | null>(null);
  readonly importLoading = signal(false);
  readonly importMessage = signal('');

  readonly createForm = this.formBuilder.nonNullable.group({
    clientName: ['', [Validators.required, Validators.minLength(2)]],
    company: [''],
    email: ['', [Validators.email]],
    phone: [''],
    address: [''],
    notes: [''],
    clientType: ['local'],
    currency: ['PHP'],
    proposedPriceDeal: [''],
  });

  ngOnInit(): void {
    this.userRole.set(this.adminAuth.getStoredUser()?.role ?? '');
    void this.load();
    if (hasSuperAdminAccess(this.userRole())) {
      void this.loadDealSummary();
    }
  }

  isSuperAdminUser(): boolean {
    return hasSuperAdminAccess(this.userRole());
  }

  canEditItem(item: ClientProspectListItem): boolean {
    return canEditProspectDetails(item.status, this.userRole());
  }

  private async loadDealSummary(): Promise<void> {
    try {
      const response = await firstValueFrom(this.adminApi.getProspectDealSummary());
      this.dealSummary.set(response.data);
    } catch {
      this.dealSummary.set(null);
    }
  }

  canUpdateItem(item: ClientProspectListItem): boolean {
    return canUpdateProspect(item.status, this.userRole());
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.listClientProspects(this.page(), 20, this.search(), this.status()),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
      this.fullAccess.set(response.fullAccess ?? true);
      if (hasSuperAdminAccess(this.userRole())) {
        void this.loadDealSummary();
      }
    } catch {
      this.error.set('Unable to load client prospects.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadCalendar(): Promise<void> {
    this.loading.set(true);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const response = await firstValueFrom(this.adminApi.listClientAppointments(start, end));
      this.appointments.set(response.data);
    } catch {
      this.error.set('Unable to load appointment calendar.');
    } finally {
      this.loading.set(false);
    }
  }

  async setView(next: 'list' | 'calendar'): Promise<void> {
    this.view.set(next);
    if (next === 'calendar') {
      await this.loadCalendar();
    } else {
      await this.load();
    }
  }

  async setStatus(tab: string): Promise<void> {
    this.status.set(tab);
    this.page.set(1);
    await this.load();
  }

  async searchProspects(): Promise<void> {
    this.page.set(1);
    await this.load();
  }

  async goToPage(nextPage: number): Promise<void> {
    this.page.set(nextPage);
    await this.load();
  }

  async pickup(item: ClientProspectListItem): Promise<void> {
    const confirmed = confirm(
      `Pick up ${item.clientName}? Consultation will be assigned to you and marked as in progress.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await firstValueFrom(this.adminApi.pickupClientProspect(item.id));
      this.actionMessage.set(`${item.clientName} picked up. Consultation is now in progress.`);
      await this.load();
    } catch {
      this.error.set('Unable to pick up this prospect.');
    }
  }

  openCreate(): void {
    this.createOpen.set(true);
    this.createForm.reset();
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  async submitCreate(): Promise<void> {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.createForm.getRawValue();
    try {
      await firstValueFrom(
        this.adminApi.createClientProspect({
          clientName: value.clientName,
          company: value.company || undefined,
          email: value.email || undefined,
          phone: value.phone || undefined,
          address: value.address || undefined,
          notes: value.notes || undefined,
          clientType: value.clientType,
          currency: value.currency,
          proposedPriceDeal: parseProposedPriceDeal(value.proposedPriceDeal),
          status: 'available',
        }),
      );
      this.closeCreate();
      this.actionMessage.set('Client prospect created with status Available.');
      await this.load();
    } catch {
      this.error.set('Unable to create client prospect.');
    } finally {
      this.saving.set(false);
    }
  }

  downloadImportTemplate(): void {
    downloadProspectImportTemplate();
  }

  async onImportSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.importLoading.set(true);
    this.error.set('');
    this.importMessage.set('');
    try {
      const response = await firstValueFrom(this.adminApi.previewImportClientProspects(file));
      this.importFile.set(file);
      this.importPreview.set(response.data);
      this.importOpen.set(true);
    } catch {
      this.error.set('Unable to read the import file. Download the template and check your columns.');
    } finally {
      this.importLoading.set(false);
    }
  }

  closeImport(): void {
    this.importOpen.set(false);
    this.importPreview.set(null);
    this.importFile.set(null);
  }

  async confirmImport(): Promise<void> {
    const file = this.importFile();
    if (!file || this.importLoading()) {
      return;
    }

    this.importLoading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.importClientProspects(file));
      this.closeImport();
      this.importMessage.set(`${response.data.imported} client(s) imported as Available.`);
      await this.load();
    } catch {
      this.error.set('Import failed. Fix the file and try again.');
    } finally {
      this.importLoading.set(false);
    }
  }

  tabLabel(tab: string): string {
    if (!tab) return 'All';
    return prospectStatusLabel(tab);
  }

  meetingTypeLabel(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  formatDateTime(value: string): string {
    return new Date(value).toLocaleString();
  }
}
