import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

export interface SetupStatus {
  connected: boolean;
  schema: string;
  mode: string;
  dbHost: string;
  dbName: string;
  isBlank: boolean;
  setupAvailable: boolean;
  tableCount: number;
  appliedMigrations: number;
  pendingBundledMigrations: number;
  connectionError?: string;
}

export interface MigrationRecord {
  id: number;
  filename: string;
  applied_at: string;
  checksum: string;
  source: string;
}

export interface SetupMigrations {
  bundled: string[];
  applied: MigrationRecord[];
  pending: string[];
}

export interface SetupProgress {
  status: 'idle' | 'running' | 'done' | 'error';
  progress: number;
  total: number;
  currentFile: string;
  message: string;
  error: string;
  startedAt: string | null;
  currentLabel: string;
  statementPreview: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface MigrationActionResponse {
  success: boolean;
  message: string;
  applied?: string[];
  filename?: string;
}

const SETUP_KEY_STORAGE = 'pcmazing-setup-key';

@Injectable({ providedIn: 'root' })
export class SetupApiService {
  private readonly http = inject(HttpClient);

  getStoredSetupKey(): string {
    return sessionStorage.getItem(SETUP_KEY_STORAGE) ?? '';
  }

  saveSetupKey(key: string): void {
    const trimmed = key.trim();
    if (trimmed) {
      sessionStorage.setItem(SETUP_KEY_STORAGE, trimmed);
      return;
    }

    sessionStorage.removeItem(SETUP_KEY_STORAGE);
  }

  getStatus() {
    return this.http.get<ApiResponse<SetupStatus>>(`${APP_CONFIG.apiUrl}/setup/status`, {
      headers: this.buildHeaders(),
    });
  }

  getMigrations() {
    return this.http.get<ApiResponse<SetupMigrations>>(`${APP_CONFIG.apiUrl}/setup/migrations`, {
      headers: this.buildHeaders(),
    });
  }

  getProgress() {
    return this.http.get<ApiResponse<SetupProgress>>(`${APP_CONFIG.apiUrl}/setup/migrate/progress`, {
      headers: this.buildHeaders(),
    });
  }

  runBundledMigrations(force = false) {
    return this.http.post<MigrationActionResponse>(
      `${APP_CONFIG.apiUrl}/setup/migrate`,
      {},
      {
        headers: this.buildHeaders(),
        params: force ? { force: 'true' } : {},
      },
    );
  }

  uploadMigration(file: File, force = false, disableForeignKeyChecks = true) {
    const formData = new FormData();
    formData.append('file', file);

    const params: Record<string, string> = {};
    if (force) {
      params['force'] = 'true';
    }
    if (!disableForeignKeyChecks) {
      params['disableFkChecks'] = 'false';
    }

    return this.http.post<MigrationActionResponse>(
      `${APP_CONFIG.apiUrl}/setup/migrate/upload`,
      formData,
      {
        headers: this.buildHeaders(),
        params,
      },
    );
  }

  private buildHeaders(): HttpHeaders {
    const setupKey = this.getStoredSetupKey();
    return setupKey ? new HttpHeaders({ 'x-setup-key': setupKey }) : new HttpHeaders();
  }
}
