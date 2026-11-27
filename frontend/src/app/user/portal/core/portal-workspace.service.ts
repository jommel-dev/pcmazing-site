import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  EmployeeMemoListItem,
  EmployeeTimesheetMine,
  EmployeeTimesheetRecord,
  EmployeeWorkspaceDashboard,
} from '../../../admin/services/admin-api.service';
import { AdminAuthService, AdminAuthUser } from '../../../admin/services/admin-auth.service';
import { TimeClockStatus } from '../../../core/services/time-clock-api.service';
import { currentMonth, shiftMonth } from './portal-format';
import { buildPortalNotices } from './portal-notices';
import { workTrack, workTrackLabel } from './portal-role';

const READ_NOTICES_KEY = 'pcmazing-portal-read-notices';

/** Pull a readable message out of an HttpErrorResponse-like value. */
export function portalErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'error' in error) {
    const payload = (error as { error?: { message?: string | string[] } }).error;
    if (Array.isArray(payload?.message) && payload.message.length) {
      return payload.message.join(', ');
    }
    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
  }
  return fallback;
}

function httpStatus(error: unknown): number {
  return error && typeof error === 'object' && 'status' in error
    ? Number((error as { status?: number }).status)
    : 0;
}

/**
 * Signal state for the employee portal, mirroring the MyPeoplePortal app's PortalController.
 * Provided at root; the shell calls start() and every screen reads from here.
 */
@Injectable({ providedIn: 'root' })
export class PortalWorkspaceService {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private startedFor: number | null = null;

  readonly user = signal<AdminAuthUser | null>(this.auth.getStoredUser());
  readonly dashboard = signal<EmployeeWorkspaceDashboard | null>(null);
  readonly clock = signal<TimeClockStatus | null>(null);
  readonly memos = signal<EmployeeMemoListItem[]>([]);
  readonly timesheet = signal<EmployeeTimesheetMine | null>(null);
  readonly reviewQueue = signal<EmployeeTimesheetRecord[]>([]);
  readonly finalizeQueue = signal<EmployeeTimesheetRecord[]>([]);
  readonly month = signal(currentMonth());
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  private readonly readNotices = signal<ReadonlySet<string>>(new Set());

  readonly role = computed(() => this.user()?.role ?? null);
  readonly displayName = computed(() => {
    const u = this.user();
    return (u?.fullName?.trim() || u?.username || 'there').trim();
  });
  readonly firstName = computed(() => this.displayName().split(/\s+/)[0] ?? 'there');
  readonly avatarUrl = computed(() => this.api.resolveProfileImageUrl(this.user()?.profileImageUrl));
  readonly workLabel = computed(() => workTrackLabel(this.role()));
  readonly track = computed(() => workTrack(this.role()));

  readonly notices = computed(() =>
    buildPortalNotices({
      dashboard: this.dashboard(),
      memos: this.memos(),
      timesheet: this.timesheet(),
    }),
  );
  readonly hasUnread = computed(() => this.notices().some((n) => !this.readNotices().has(n.id)));
  readonly pendingMemoCount = computed(
    () => this.memos().filter((m) => !m.acknowledgedAt).length,
  );

  isRead(id: string): boolean {
    return this.readNotices().has(id);
  }

  markNoticesRead(ids: string[]): void {
    const next = new Set(this.readNotices());
    ids.forEach((id) => next.add(id));
    this.readNotices.set(next);
    this.persistReadNotices();
  }

  /** Loads everything the shell needs. Safe to call repeatedly; reloads only after a user change. */
  async start(force = false): Promise<void> {
    const stored = this.auth.getStoredUser();
    this.user.set(stored);
    if (!stored) {
      return;
    }
    if (!force && this.startedFor === stored.id) {
      return;
    }
    this.startedFor = stored.id;
    this.loadReadNotices(stored.id);
    await Promise.all([this.refreshProfile(), this.refresh()]);
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.reloadDashboard();
      const [clock] = await Promise.all([
        firstValueFrom(this.api.getPortalTimeClockStatus()),
        this.loadMemos(),
      ]);
      this.clock.set(clock.data);
    } catch (error) {
      this.fail(error, 'Could not load your workspace.');
    } finally {
      this.loading.set(false);
    }
  }

  async reloadDashboard(): Promise<void> {
    const response = await firstValueFrom(this.api.getEmployeeWorkspaceDashboard(this.month()));
    this.dashboard.set(response.data);
    if (!this.month()) {
      this.month.set(response.data.month || currentMonth());
    }
  }

  async shiftMonth(delta: number): Promise<void> {
    this.month.set(shiftMonth(this.month(), delta));
    try {
      await this.reloadDashboard();
    } catch (error) {
      this.fail(error, 'Could not load that month.');
    }
  }

  async loadTimesheet(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const month = this.month() || currentMonth();
      const mine = (await firstValueFrom(this.api.getEmployeeTimesheet(month))).data;
      this.timesheet.set(mine);
      if (mine.canReview) {
        this.reviewQueue.set((await firstValueFrom(this.api.listTimesheetsForReview())).data);
      }
      if (mine.canFinalize) {
        this.finalizeQueue.set((await firstValueFrom(this.api.listTimesheetsForFinalize())).data);
      }
    } catch (error) {
      this.fail(error, 'Could not load the timesheet.');
    } finally {
      this.loading.set(false);
    }
  }

  async refreshProfile(): Promise<void> {
    try {
      const profile = (await firstValueFrom(this.auth.getProfile())).data;
      this.auth.updateStoredUser(profile);
      this.user.set(profile);
    } catch (error) {
      if (this.isAuthFailure(error)) {
        this.signOut();
      }
    }
  }

  setUser(user: AdminAuthUser): void {
    this.auth.updateStoredUser(user);
    this.user.set(user);
  }

  signOut(): void {
    this.auth.logout();
    this.reset();
    void this.router.navigateByUrl('/user/login');
  }

  fail(error: unknown, fallback: string): void {
    if (this.isAuthFailure(error)) {
      this.signOut();
      return;
    }
    this.error.set(portalErrorMessage(error, fallback));
  }

  private isAuthFailure(error: unknown): boolean {
    // Only an expired/invalid token ends the session; a 403 just means this screen is off-limits.
    return httpStatus(error) === 401;
  }

  private async loadMemos(): Promise<void> {
    try {
      this.memos.set((await firstValueFrom(this.api.listMyEmployeeMemos())).data);
    } catch {
      // Memos stay optional when that table is not ready.
    }
  }

  private reset(): void {
    this.startedFor = null;
    this.user.set(null);
    this.dashboard.set(null);
    this.clock.set(null);
    this.memos.set([]);
    this.timesheet.set(null);
    this.reviewQueue.set([]);
    this.finalizeQueue.set([]);
    this.month.set(currentMonth());
    this.error.set(null);
    this.notice.set(null);
    this.readNotices.set(new Set());
  }

  private loadReadNotices(userId: number): void {
    try {
      const raw = localStorage.getItem(`${READ_NOTICES_KEY}:${userId}`);
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      this.readNotices.set(new Set(Array.isArray(ids) ? ids : []));
    } catch {
      this.readNotices.set(new Set());
    }
  }

  private persistReadNotices(): void {
    const userId = this.user()?.id;
    if (userId == null) {
      return;
    }
    try {
      localStorage.setItem(
        `${READ_NOTICES_KEY}:${userId}`,
        JSON.stringify([...this.readNotices()].slice(-200)),
      );
    } catch {
      // Storage may be unavailable (private mode); unread dots just reset next visit.
    }
  }
}
