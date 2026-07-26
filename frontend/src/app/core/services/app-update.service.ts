import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

interface AppVersionResponse {
  buildId?: string;
}

/**
 * Reloads the tab when a newer production build is detected.
 * Fixes stale SPA shells after deploy without requiring a manual hard refresh.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly currentBuildId = APP_CONFIG.buildId;
  private checking = false;
  private started = false;

  start(): void {
    if (this.started || typeof window === 'undefined') {
      return;
    }

    this.started = true;
    void this.checkForUpdate();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.checkForUpdate();
      }
    });

    window.addEventListener('focus', () => {
      void this.checkForUpdate();
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

      const payload = (await response.json()) as AppVersionResponse;
      const remoteBuildId = payload.buildId?.trim();
      if (remoteBuildId && remoteBuildId !== this.currentBuildId) {
        window.location.reload();
      }
    } catch {
      // Ignore network/parse errors; next focus/visibility check can retry.
    } finally {
      this.checking = false;
    }
  }
}
