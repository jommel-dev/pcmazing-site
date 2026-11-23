import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '../../../core/config/app-config';

@Component({
  selector: 'app-downloads-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './app-downloads-page.component.html',
})
export class AppDownloadsPageComponent {
  private readonly http = inject(HttpClient);

  readonly serial = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  download(): void {
    const serial = this.serial().trim();
    if (!serial || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.http
      .post(`${APP_CONFIG.apiUrl}/downloads/apk`, { app: 'portal', serial }, {
        observe: 'response',
        responseType: 'blob',
      })
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (!blob) {
            this.error.set('Download failed.');
            this.busy.set(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filenameFrom(response.headers.get('content-disposition')) ?? 'MyPeoplePortal.apk';
          link.click();
          URL.revokeObjectURL(url);
          this.busy.set(false);
        },
        error: (error: unknown) => {
          void this.readError(error);
        },
      });
  }

  private async readError(error: unknown): Promise<void> {
    const status = (error as { status?: number } | null)?.status;
    if (status !== 400 && status !== 404) {
      this.error.set('Could not reach the download service. Try again in a moment.');
      this.busy.set(false);
      return;
    }
    const body = (error as { error?: unknown } | null)?.error;
    if (body instanceof Blob) {
      const text = await body.text();
      try {
        const parsed = JSON.parse(text) as { message?: string | string[] };
        const message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
        this.error.set(message?.trim() || 'That serial code is not valid.');
      } catch {
        this.error.set('That serial code is not valid.');
      }
    } else {
      this.error.set('That serial code is not valid.');
    }
    this.busy.set(false);
  }
}

function filenameFrom(header: string | null): string | null {
  const match = /filename="([^"]+)"/.exec(header ?? '');
  return match?.[1] ?? null;
}
