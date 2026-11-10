import { Injectable, signal } from '@angular/core';

export type AdminAlertType = 'success' | 'error' | 'info';

export interface AdminAlertState {
  open: boolean;
  type: AdminAlertType;
  title: string;
  message: string;
  confirmLabel: string;
}

const DEFAULT_TITLES: Record<AdminAlertType, string> = {
  success: 'Success',
  error: 'Something went wrong',
  info: 'Notice',
};

@Injectable({ providedIn: 'root' })
export class AdminAlertService {
  private readonly state = signal<AdminAlertState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmLabel: 'OK',
  });

  readonly alert = this.state.asReadonly();

  success(message: string, title = DEFAULT_TITLES.success): void {
    this.show({ type: 'success', title, message });
  }

  error(message: string, title = DEFAULT_TITLES.error): void {
    this.show({ type: 'error', title, message });
  }

  info(message: string, title = DEFAULT_TITLES.info): void {
    this.show({ type: 'info', title, message });
  }

  show(options: {
    type: AdminAlertType;
    message: string;
    title?: string;
    confirmLabel?: string;
  }): void {
    const message = String(options.message ?? '').trim();
    if (!message) {
      return;
    }
    this.state.set({
      open: true,
      type: options.type,
      title: String(options.title ?? DEFAULT_TITLES[options.type]).trim() || DEFAULT_TITLES[options.type],
      message,
      confirmLabel: String(options.confirmLabel ?? 'OK').trim() || 'OK',
    });
  }

  close(): void {
    this.state.update((current) => ({ ...current, open: false }));
  }
}
