import { isDevMode, Injectable } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

interface AppVersionResponse {
  buildId?: string;
}

const RELOAD_GUARD_KEY = 'pcmazing-app-update-reload';

/**
 * Reloads the tab when a newer production build is detected.
 * Disabled in development to avoid reload loops with ng serve.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly currentBuildId = APP_CONFIG.buildId;
  private checking = false;
  private started = false;

  start(): void {
    if (this.started || typeof window === 'undefined' || isDevMode()) {
      return;
    }

    this.started = true;
    void this.checkForUpdate();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.checkForUpdate();
      }
    });
  }

  private async checkForUpdate(): Promise<void> {
    if (this.checking || !this.currentBuildId) {
      return;
    }

    this.checking = true;
    try {
      const response = await fetch(`/app-version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        return;
      }

      const payload = (await response.json()) as AppVersionResponse;
      const remoteBuildId = payload.buildId?.trim();
      if (!remoteBuildId || remoteBuildId === this.currentBuildId) {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
        return;
      }

      // Prevent infinite reload if version file and bundle stay out of sync.
      if (sessionStorage.getItem(RELOAD_GUARD_KEY) === remoteBuildId) {
        return;
      }

      sessionStorage.setItem(RELOAD_GUARD_KEY, remoteBuildId);
      window.location.reload();
    } catch {
      // Ignore network/parse errors; next visibility check can retry.
    } finally {
      this.checking = false;
    }
  }
}
