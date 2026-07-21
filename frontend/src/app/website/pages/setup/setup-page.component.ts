import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import {
  SetupApiService,
  SetupMigrations,
  SetupProgress,
  SetupStatus,
} from '../../../core/services/setup-api.service';

@Component({
  selector: 'app-setup-page',
  imports: [PageHeroComponent, DecimalPipe],
  templateUrl: './setup-page.component.html',
})
export class SetupPageComponent implements OnInit, OnDestroy {
  private readonly setupApi = inject(SetupApiService);
  private progressTimer?: ReturnType<typeof setInterval>;

  readonly loading = signal(true);
  readonly actionLoading = signal(false);
  readonly error = signal('');
  readonly actionMessage = signal('');
  readonly setupKey = signal(this.setupApi.getStoredSetupKey());
  readonly forceMigration = signal(false);
  readonly uploadForceMigration = signal(true);
  readonly disableForeignKeyChecks = signal(true);
  readonly selectedFile = signal<File | null>(null);
  readonly selectedFileName = signal('');
  readonly uploadPhase = signal('');
  readonly migrationRunning = signal(false);

  readonly status = signal<SetupStatus | null>(null);
  readonly migrations = signal<SetupMigrations | null>(null);
  readonly progress = signal<SetupProgress | null>(null);

  ngOnInit(): void {
    void this.refresh();
  }

  ngOnDestroy(): void {
    this.stopProgressPolling();
  }

  saveSetupKey(): void {
    this.setupApi.saveSetupKey(this.setupKey());
    this.actionMessage.set('Setup key saved for this browser session.');
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const [statusResponse, migrationsResponse, progressResponse] = await Promise.all([
        firstValueFrom(this.setupApi.getStatus()),
        firstValueFrom(this.setupApi.getMigrations()),
        firstValueFrom(this.setupApi.getProgress()),
      ]);

      this.status.set(statusResponse.data);
      this.migrations.set(migrationsResponse.data);
      this.progress.set(progressResponse.data);
    } catch (error) {
      this.error.set(this.extractErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  async runBundledMigrations(): Promise<void> {
    this.actionLoading.set(true);
    this.error.set('');
    this.actionMessage.set('');
    this.startProgressPolling();

    try {
      const response = await firstValueFrom(
        this.setupApi.runBundledMigrations(this.forceMigration()),
      );
      this.actionMessage.set(response.message ?? 'Bundled migrations completed.');
      await this.refresh();
    } catch (error) {
      this.error.set(this.extractErrorMessage(error));
      await this.pollProgress();
    } finally {
      this.actionLoading.set(false);
      this.stopProgressPolling();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.selectedFileName.set(file?.name ?? '');
  }

  async uploadSelectedFile(): Promise<void> {
    const file = this.selectedFile();

    if (!file) {
      this.error.set('Please choose a .sql file first.');
      return;
    }

    this.actionLoading.set(true);
    this.error.set('');
    this.actionMessage.set('');
    this.uploadPhase.set('Uploading file to server...');
    this.migrationRunning.set(true);
    this.startProgressPolling();

    try {
      const response = await firstValueFrom(
        this.setupApi.uploadMigration(
          file,
          this.uploadForceMigration(),
          this.disableForeignKeyChecks(),
        ),
      );
      this.uploadPhase.set('');
      this.actionMessage.set(response.message ?? 'Upload accepted. Import started.');
      this.selectedFile.set(null);
      this.selectedFileName.set('');
    } catch (error) {
      this.uploadPhase.set('');
      this.migrationRunning.set(false);
      this.error.set(this.extractErrorMessage(error));
      await this.pollProgress();
      this.stopProgressPolling();
    } finally {
      this.actionLoading.set(false);
    }
  }

  progressMessage(migrationProgress: SetupProgress): string {
    if (this.uploadPhase()) {
      return this.uploadPhase();
    }

    if (migrationProgress.message) {
      return migrationProgress.message;
    }

    if (migrationProgress.status === 'running') {
      return 'Processing migration...';
    }

    return migrationProgress.currentLabel || 'Waiting for migration status...';
  }

  showMigrationProgress(): boolean {
    const migrationProgress = this.progress();
    return (
      this.migrationRunning() ||
      this.actionLoading() ||
      migrationProgress?.status === 'running' ||
      migrationProgress?.status === 'done' ||
      migrationProgress?.status === 'error'
    );
  }

  progressPercent(migrationProgress: SetupProgress): number {
    if (migrationProgress.total <= 0) {
      return migrationProgress.status === 'done' ? 100 : 0;
    }

    return Math.min(100, (migrationProgress.progress / migrationProgress.total) * 100);
  }

  formatStatementCount(migrationProgress: SetupProgress): string {
    if (migrationProgress.total <= 0) {
      return migrationProgress.status === 'running' ? 'Preparing...' : '—';
    }

    return `${migrationProgress.progress.toLocaleString()} / ${migrationProgress.total.toLocaleString()}`;
  }

  formatElapsedTime(startedAt: string | null): string {
    if (!startedAt) {
      return '';
    }

    const elapsedMs = Date.now() - new Date(startedAt).getTime();
    if (elapsedMs < 1000) {
      return 'Elapsed: less than 1s';
    }

    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) {
      return `Elapsed: ${seconds}s`;
    }

    return `Elapsed: ${minutes}m ${seconds}s`;
  }

  progressStatusClass(status: SetupProgress['status']): string {
    switch (status) {
      case 'done':
        return 'bg-green-50 text-green-700';
      case 'error':
        return 'bg-red-50 text-red-700';
      case 'running':
        return 'bg-pcmazing-50 text-pcmazing-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  private startProgressPolling(): void {
    this.stopProgressPolling();
    void this.pollProgress();

    this.progressTimer = setInterval(() => {
      void this.pollProgress();
    }, 500);
  }

  private async pollProgress(): Promise<void> {
    try {
      const response = await firstValueFrom(this.setupApi.getProgress());
      this.progress.set(response.data);

      if (response.data.status === 'running') {
        this.migrationRunning.set(true);
        this.uploadPhase.set('');
      }

      if (response.data.status === 'done') {
        this.migrationRunning.set(false);
        this.actionMessage.set(response.data.message || 'Migration completed.');
        this.stopProgressPolling();
        await this.refresh();
      }

      if (response.data.status === 'error') {
        this.migrationRunning.set(false);
        this.error.set(response.data.error || 'Migration failed.');
        this.stopProgressPolling();
        await this.refresh();
      }

      if (
        this.migrationRunning() &&
        response.data.status === 'idle' &&
        !this.actionLoading()
      ) {
        this.migrationRunning.set(false);
        this.error.set(
          'Migration progress was lost. The backend may have restarted during import. Refresh the page and check pgAdmin for partial tables before retrying.',
        );
        this.stopProgressPolling();
      }
    } catch {
      if (!this.actionLoading() && !this.migrationRunning()) {
        this.stopProgressPolling();
      }
    }
  }

  private stopProgressPolling(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = undefined;
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const payload = (error as { error?: { message?: string | string[] } }).error;

      if (Array.isArray(payload?.message)) {
        return payload.message.join(', ');
      }

      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    }

    return 'Unable to reach the setup API. Make sure the backend is running on port 3000.';
  }
}
