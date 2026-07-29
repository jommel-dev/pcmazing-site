import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  ClientProspectDetail,
  ProjectUserSummary,
} from '../../services/admin-api.service';
import { AdminAuthService } from '../../services/admin-auth.service';
import {
  canUpdateProspect,
  canEditProspectDetails,
  commissionOutcomeMessage,
  followUpProgressLabel,
  formatFollowUpDate,
  followUpMethodLabel,
  hasPreviousLossRemarks,
  hasAdminMeetingOutcomeAccess,
  hasSuperAdminAccess,
  isAvailableProspect,
  isAwaitingMeetingOutcome,
  isClosedProspect,
  prospectStatusClass,
  prospectStatusLabel,
} from './prospect-status.util';
import {
  clientTypeLabel,
  commissionAmountFromPercent,
  formatCommissionPercent,
  formatDealAmount,
  isPhpCurrency,
  netProjectDealAfterCommission,
  projectDealPhp,
} from './prospect-deal.util';

@Component({
  selector: 'app-lead-prospect-view-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './lead-prospect-view-page.component.html',
})
export class LeadProspectViewPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly prospect = signal<ClientProspectDetail | null>(null);
  readonly userRole = signal('');
  readonly existingProjectId = signal<number | null>(null);

  readonly createProjectOpen = signal(false);
  readonly createProjectLoading = signal(false);
  readonly createProjectSaving = signal(false);
  readonly createProjectError = signal('');
  readonly managers = signal<ProjectUserSummary[]>([]);
  readonly developers = signal<ProjectUserSummary[]>([]);
  readonly selectedManagerKey = signal('');
  readonly selectedDeveloperKeys = signal<string[]>([]);

  readonly statusLabel = prospectStatusLabel;
  readonly statusClass = prospectStatusClass;
  readonly isAvailable = isAvailableProspect;
  readonly isAwaitingMeeting = isAwaitingMeetingOutcome;
  readonly isClosed = isClosedProspect;
  readonly commissionMessage = commissionOutcomeMessage;
  readonly isAdmin = hasAdminMeetingOutcomeAccess;
  readonly followUpProgressLabel = followUpProgressLabel;
  readonly hasPreviousLossRemarks = hasPreviousLossRemarks;
  readonly formatFollowUpDate = formatFollowUpDate;
  readonly followUpMethodLabel = followUpMethodLabel;
  readonly clientTypeLabel = clientTypeLabel;
  readonly formatDealAmount = formatDealAmount;
  readonly isPhpCurrency = isPhpCurrency;
  readonly projectDealPhp = projectDealPhp;
  readonly formatCommissionPercent = formatCommissionPercent;
  readonly commissionAmountFromPercent = commissionAmountFromPercent;
  readonly netProjectDealAfterCommission = netProjectDealAfterCommission;
  readonly canEditProspect = canEditProspectDetails;
  readonly isSuperAdmin = hasSuperAdminAccess;

  ngOnInit(): void {
    this.userRole.set(this.adminAuth.getStoredUser()?.role ?? '');
    void this.load();
  }

  canUpdateStatus(status: string): boolean {
    return canUpdateProspect(status, this.userRole());
  }

  canEditDetails(status: string): boolean {
    return canEditProspectDetails(status, this.userRole());
  }

  canCreateProject(item: ClientProspectDetail): boolean {
    return item.status === 'contract_signed' && Boolean(item.contract) && !this.existingProjectId();
  }

  userKey(user: ProjectUserSummary): string {
    return `${user.source}:${user.id}`;
  }

  isDeveloperSelected(user: ProjectUserSummary): boolean {
    return this.selectedDeveloperKeys().includes(this.userKey(user));
  }

  toggleDeveloper(user: ProjectUserSummary): void {
    const key = this.userKey(user);
    const current = [...this.selectedDeveloperKeys()];
    const index = current.indexOf(key);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(key);
    }
    this.selectedDeveloperKeys.set(current);
  }

  async openCreateProjectModal(): Promise<void> {
    this.createProjectError.set('');
    this.selectedManagerKey.set('');
    this.selectedDeveloperKeys.set([]);
    this.createProjectOpen.set(true);
    this.createProjectLoading.set(true);

    try {
      const [managersResponse, developersResponse] = await Promise.all([
        firstValueFrom(this.adminApi.listProjectAssignees()),
        firstValueFrom(this.adminApi.listProjectAssignees('developer')),
      ]);
      this.managers.set(managersResponse.data);
      this.developers.set(developersResponse.data);
    } catch {
      this.createProjectError.set('Unable to load users for project assignment.');
    } finally {
      this.createProjectLoading.set(false);
    }
  }

  closeCreateProjectModal(): void {
    this.createProjectOpen.set(false);
    this.createProjectError.set('');
  }

  async submitCreateProject(): Promise<void> {
    const item = this.prospect();
    if (!item) {
      return;
    }

    const managerKey = this.selectedManagerKey();
    const developerKeys = this.selectedDeveloperKeys();
    if (!managerKey) {
      this.createProjectError.set('Select a project manager.');
      return;
    }
    if (!developerKeys.length) {
      this.createProjectError.set('Select at least one developer team member.');
      return;
    }

    const manager = this.parseUserKey(managerKey);
    const teamMembers = developerKeys.map((key) => this.parseUserKey(key));

    this.createProjectSaving.set(true);
    this.createProjectError.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.createProject({
          prospectId: item.id,
          name: item.contract?.projectName,
          projectManager: manager,
          teamMembers,
        }),
      );
      this.existingProjectId.set(response.data.id);
      this.closeCreateProjectModal();
      await this.router.navigate(['/admin/projects']);
    } catch (err: unknown) {
      const message =
        typeof err === 'object'
        && err !== null
        && 'error' in err
        && typeof (err as { error?: { message?: string } }).error?.message === 'string'
          ? (err as { error: { message: string } }).error.message
          : 'Unable to create project.';
      this.createProjectError.set(message);
    } finally {
      this.createProjectSaving.set(false);
    }
  }

  private parseUserKey(key: string): { id: number; source: 'pcmazing_admin_users' | 'tblusers' } {
    const [source, idRaw] = key.split(':');
    return {
      source: source as 'pcmazing_admin_users' | 'tblusers',
      id: Number(idRaw),
    };
  }

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.getClientProspect(id));
      this.prospect.set(response.data);

      if (response.data.status === 'contract_signed') {
        try {
          const projectResponse = await firstValueFrom(this.adminApi.getProjectByProspect(id));
          this.existingProjectId.set(projectResponse.data?.id ?? null);
        } catch {
          this.existingProjectId.set(null);
        }
      } else {
        this.existingProjectId.set(null);
      }
    } catch {
      this.error.set('Unable to load client prospect.');
    } finally {
      this.loading.set(false);
    }
  }

  formatDateTime(value: string): string {
    return new Date(value).toLocaleString();
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  }

  linkedModuleNames(
    modules: Array<{ name: string }>,
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

  meetingTypeLabel(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
