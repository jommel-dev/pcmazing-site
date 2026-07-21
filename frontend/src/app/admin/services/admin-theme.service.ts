import { Injectable, signal } from '@angular/core';

export type AdminTheme = 'light' | 'dark';

const STORAGE_KEY = 'pcmazing-admin-theme';

@Injectable({ providedIn: 'root' })
export class AdminThemeService {
  readonly theme = signal<AdminTheme>(this.readStoredTheme());

  isDark(): boolean {
    return this.theme() === 'dark';
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: AdminTheme): void {
    this.theme.set(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  private readStoredTheme(): AdminTheme {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  }
}
