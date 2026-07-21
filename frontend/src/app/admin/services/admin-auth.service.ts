import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_CONFIG } from '../../core/config/app-config';

export interface AdminAuthUser {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
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

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);

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

    const payload = this.decodeStaffGatePayload(token);
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
    return sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
  }

  getStoredUser(): AdminAuthUser | null {
    const raw = sessionStorage.getItem(ADMIN_USER_KEY) ?? localStorage.getItem(ADMIN_USER_KEY);
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
    return Boolean(this.getAccessToken());
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

  getProfile() {
    return this.http.get<ApiResponse<AdminAuthUser>>(`${APP_CONFIG.apiUrl}/auth/me`, {
      headers: this.buildAuthHeaders(),
    });
  }

  saveSession(accessToken: string, user: AdminAuthUser, rememberMe: boolean): void {
    const storage = rememberMe ? localStorage : sessionStorage;
    const other = rememberMe ? sessionStorage : localStorage;

    other.removeItem(ACCESS_TOKEN_KEY);
    other.removeItem(ADMIN_USER_KEY);

    storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    storage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  }

  logout(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    this.clearStaffGateAccess();
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

  private decodeStaffGatePayload(token: string): { type?: string; exp?: number } | null {
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
}
