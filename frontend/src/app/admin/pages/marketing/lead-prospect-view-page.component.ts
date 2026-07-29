import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ClientProspectDetail } from '../../services/admin-api.service';
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
import { clientTypeLabel, commissionAmountFromPercent, formatCommissionPercent, formatDealAmount, isPhpCurrency, netProjectDealAfterCommission, projectDealPhp } from './prospect-deal.util';

@Component({
  selector: 'app-lead-prospect-view-page',
  imports: [RouterLink],
  templateUrl: './lead-prospect-view-page.component.html',
})
export class LeadProspectViewPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly prospect = signal<ClientProspectDetail | null>(null);
  readonly userRole = signal('');

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

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.getClientProspect(id));
      this.prospect.set(response.data);
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

  meetingTypeLabel(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
