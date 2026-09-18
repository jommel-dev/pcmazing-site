import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';

export interface AdminAuthUser {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  profileImageUrl?: string | null;
  source: 'tblusers' | 'pcmazing_admin_users';
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

const STAFF_GATE_KEY = 'pcmazing-staff-gate-token';
const ACCESS_TOKEN_KEY = 'pcmazing-admin-access-token';
const ADMIN_USER_KEY = 'pcmazing-admin-user';
const SESSION_REFRESH_WHEN_REMAINING_MS = 15 * 60 * 1000;
const SESSION_REFRESH_THROTTLE_MS = 20 * 1000;

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);
  private keepaliveStarted = false;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRefreshAt = 0;
  private refreshInFlight: Promise<void> | null = null;

  constructor() {
    this.startSessionKeepalive();
  }

  getStaffGateToken(): string {
    return sessionStorage.getItem(STAFF_GATE_KEY)?.trim() ?? '';
  }

  hasStaffGateAccess(): boolean {
    return this.isStaffGateTokenValid();
  }

  isStaffGateTokenValid(): boolean {
    const token = this.getStaffGateToken();
    if (!token) {
      return false;
    }

    const payload = this.decodeJwtPayload(token);
    if (!payload || payload.type !== 'staff_gate') {
      this.clearStaffGateAccess();
      return false;
    }

    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      this.clearStaffGateAccess();
      return false;
    }

    return true;
  }

  saveStaffGateToken(token: string): void {
    sessionStorage.setItem(STAFF_GATE_KEY, token.trim());
  }

  clearStaffGateAccess(): void {
    sessionStorage.removeItem(STAFF_GATE_KEY);
  }

  getAccessToken(): string {
    this.promoteSessionToSharedStorage();
    return localStorage.getItem(ACCESS_TOKEN_KEY) ?? sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
  }

  getStoredUser(): AdminAuthUser | null {
    this.promoteSessionToSharedStorage();
    const raw = localStorage.getItem(ADMIN_USER_KEY) ?? sessionStorage.getItem(ADMIN_USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AdminAuthUser;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    if (!this.isAccessTokenValid()) {
      this.clearLoginSession();
      return false;
    }
    return true;
  }

  verifyStaffPasscode(passcode: string) {
    return this.http.post<ApiResponse<{ staffGateToken: string; expiresIn: string }>>(
      `${APP_CONFIG.apiUrl}/auth/staff-access`,
      { passcode },
    );
  }

  login(username: string, password: string, rememberMe = false) {
    return this.http.post<ApiResponse<{ accessToken: string; user: AdminAuthUser }>>(
      `${APP_CONFIG.apiUrl}/auth/login`,
      { username, password },
      { headers: this.buildStaffGateHeaders() },
    );
  }

  portalLogin(username: string, password: string, rememberMe = false) {
    return this.http.post<ApiResponse<{ accessToken: string; user: AdminAuthUser }>>(
      `${APP_CONFIG.apiUrl}/auth/portal-login`,
      { username, password },
    );
  }

  refreshSession() {
    return this.http.post<ApiResponse<{ accessToken: string; user: AdminAuthUser }>>(
      `${APP_CONFIG.apiUrl}/auth/refresh`,
      {},
      { headers: this.buildAuthHeaders() },
    );
  }

  getProfile() {
    return this.http.get<ApiResponse<AdminAuthUser>>(`${APP_CONFIG.apiUrl}/auth/me`, {
      headers: this.buildAuthHeaders(),
    });
  }

  updateProfile(payload: { fullName?: string; email?: string }) {
    return this.http.patch<ApiResponse<AdminAuthUser>>(`${APP_CONFIG.apiUrl}/auth/me`, payload, {
      headers: this.buildAuthHeaders(),
    });
  }

  changeMyPassword(password: string) {
    return this.http.patch<ApiResponse<AdminAuthUser>>(
      `${APP_CONFIG.apiUrl}/auth/me/password`,
      { password },
      { headers: this.buildAuthHeaders() },
    );
  }

  uploadMyProfileImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ApiResponse<AdminAuthUser>>(
      `${APP_CONFIG.apiUrl}/auth/me/profile-image`,
      formData,
      { headers: this.buildAuthHeaders() },
    );
  }

  removeMyProfileImage() {
    return this.http.delete<ApiResponse<AdminAuthUser>>(`${APP_CONFIG.apiUrl}/auth/me/profile-image`, {
      headers: this.buildAuthHeaders(),
    });
  }

  usesRememberMe(): boolean {
    return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));
  }

  saveSession(accessToken: string, user: AdminAuthUser, _rememberMe = false): void {
    // Always persist in localStorage so other tabs can reuse the same session.
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
    this.scheduleExpiryWatch();
  }

  updateStoredUser(user: AdminAuthUser, _rememberMe = false): void {
    const raw = JSON.stringify(user);
    localStorage.setItem(ADMIN_USER_KEY, raw);
    sessionStorage.setItem(ADMIN_USER_KEY, raw);
  }

  logout(): void {
    this.clearLoginSession();
    this.clearStaffGateAccess();
  }

  private clearLoginSession(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    this.clearExpiryWatch();
  }

  /** Copy a tab-only session into localStorage so other tabs can see it. */
  private promoteSessionToSharedStorage(): void {
    const sessionToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const sessionUser = sessionStorage.getItem(ADMIN_USER_KEY);
    if (sessionToken && !localStorage.getItem(ACCESS_TOKEN_KEY)) {
      localStorage.setItem(ACCESS_TOKEN_KEY, sessionToken);
    }
    if (sessionUser && !localStorage.getItem(ADMIN_USER_KEY)) {
      localStorage.setItem(ADMIN_USER_KEY, sessionUser);
    }
  }

  onAuthStorageChange(callback: () => void): () => void {
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    const handler = (event: StorageEvent) => {
      if (event.key === ACCESS_TOKEN_KEY || event.key === ADMIN_USER_KEY) {
        callback();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  buildAuthHeaders(): HttpHeaders {
    const token = this.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private buildStaffGateHeaders(): HttpHeaders {
    const token = this.getStaffGateToken();
    return token ? new HttpHeaders({ 'x-staff-gate': token }) : new HttpHeaders();
  }

  isStaffGateAuthError(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('status' in error)) {
      return false;
    }

    const status = (error as { status?: number }).status;
    if (status !== 403) {
      return false;
    }

    const payload = (error as { error?: { message?: string | string[] } }).error;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(' ')
      : payload?.message ?? '';

    return /staff access verification/i.test(message);
  }

  private decodeJwtPayload(token: string): { type?: string; exp?: number } | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      return JSON.parse(atob(padded)) as { type?: string; exp?: number };
    } catch {
      return null;
    }
  }

  private isAccessTokenValid(): boolean {
    const token = this.getAccessToken();
    if (!token) {
      return false;
    }

    const remaining = this.getAccessTokenRemainingMs(token);
    return remaining > 0;
  }

  private getAccessTokenRemainingMs(token = this.getAccessToken()): number {
    const payload = this.decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') {
      return token ? Number.POSITIVE_INFINITY : 0;
    }
    return payload.exp * 1000 - Date.now();
  }

  private startSessionKeepalive(): void {
    if (this.keepaliveStarted || typeof window === 'undefined') {
      return;
    }

    this.keepaliveStarted = true;
    const bump = () => {
      void this.extendSessionIfNeeded();
    };
    window.addEventListener('click', bump, true);
    window.addEventListener('keydown', bump, true);
    window.addEventListener('touchstart', bump, true);
    window.addEventListener('mousemove', bump, true);
    this.scheduleExpiryWatch();
  }

  private async extendSessionIfNeeded(): Promise<void> {
    if (!this.getAccessToken()) {
      return;
    }

    const remaining = this.getAccessTokenRemainingMs();
    if (remaining <= 0) {
      this.clearLoginSession();
      return;
    }

    if (remaining > SESSION_REFRESH_WHEN_REMAINING_MS) {
      return;
    }

    if (this.refreshInFlight || Date.now() - this.lastRefreshAt < SESSION_REFRESH_THROTTLE_MS) {
      return;
    }

    this.refreshInFlight = firstValueFrom(this.refreshSession())
      .then((response) => {
        this.saveSession(response.data.accessToken, response.data.user);
        this.lastRefreshAt = Date.now();
      })
      .catch(() => {
        if (this.getAccessTokenRemainingMs() <= 0) {
          this.clearLoginSession();
        }
      })
      .finally(() => {
        this.refreshInFlight = null;
      });

    await this.refreshInFlight;
  }

  private scheduleExpiryWatch(): void {
    this.clearExpiryWatch();
    const remaining = this.getAccessTokenRemainingMs();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      return;
    }

    this.expiryTimer = setTimeout(() => {
      if (this.getAccessTokenRemainingMs() <= 0) {
        this.clearLoginSession();
      }
    }, remaining + 250);
  }

  private clearExpiryWatch(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
