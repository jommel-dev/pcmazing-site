import { Component, HostListener, inject } from '@angular/core';
import { AdminAlertService } from '../../services/admin-alert.service';

@Component({
  selector: 'app-admin-alert-host',
  standalone: true,
  template: `
    @if (alertService.alert(); as alert) {
      @if (alert.open) {
        <div
          class="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/50 p-4"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          [attr.aria-describedby]="messageId"
          (click)="alertService.close()"
        >
          <div
            class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/20"
            (click)="$event.stopPropagation()"
          >
            <div class="flex flex-col items-center text-center">
              <div
                class="flex size-14 items-center justify-center rounded-full ring-1"
                [class.bg-emerald-50]="alert.type === 'success'"
                [class.text-emerald-600]="alert.type === 'success'"
                [class.ring-emerald-100]="alert.type === 'success'"
                [class.bg-red-50]="alert.type === 'error'"
                [class.text-red-600]="alert.type === 'error'"
                [class.ring-red-100]="alert.type === 'error'"
                [class.bg-sky-50]="alert.type === 'info'"
                [class.text-sky-600]="alert.type === 'info'"
                [class.ring-sky-100]="alert.type === 'info'"
              >
                @if (alert.type === 'success') {
                  <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                } @else if (alert.type === 'error') {
                  <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                } @else {
                  <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25h.008v.008H11.25v-.008Zm.75-6.75v7.5m9-3.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                }
              </div>

              <h2 [id]="titleId" class="mt-4 text-lg font-bold text-slate-900">{{ alert.title }}</h2>
              <p [id]="messageId" class="mt-2 text-sm leading-relaxed text-slate-600">{{ alert.message }}</p>

              <button
                type="button"
                class="mt-6 min-w-28 rounded-xl px-5 py-2.5 text-sm font-bold text-white hover:opacity-95"
                [class.bg-pcmazing-500]="alert.type === 'success' || alert.type === 'info'"
                [class.hover:bg-pcmazing-600]="alert.type === 'success' || alert.type === 'info'"
                [class.bg-red-600]="alert.type === 'error'"
                [class.hover:bg-red-700]="alert.type === 'error'"
                (click)="alertService.close()"
              >
                {{ alert.confirmLabel }}
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class AdminAlertHostComponent {
  readonly alertService = inject(AdminAlertService);
  readonly titleId = 'admin-alert-title';
  readonly messageId = 'admin-alert-message';

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.alertService.alert().open) {
      this.alertService.close();
    }
  }
}
