import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ADMIN_NAV_MODULES } from '../data/admin-modules.data';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminThemeService } from '../services/admin-theme.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent implements OnInit {
  private readonly adminAuth = inject(AdminAuthService);
  private readonly router = inject(Router);
  readonly themeService = inject(AdminThemeService);

  readonly navModules = ADMIN_NAV_MODULES;
  readonly user = signal(this.adminAuth.getStoredUser());
  readonly sidebarOpen = signal(false);
  readonly profileMenuOpen = signal(false);

  readonly logoSrc = '/images/logo.png';

  ngOnInit(): void {
    void this.loadProfile();
  }

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.profileMenuOpen.update((open) => !open);
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  userInitials(): string {
    const fullName = this.user()?.fullName?.trim();
    if (!fullName) {
      return 'AD';
    }

    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }

  logout(): void {
    this.closeProfileMenu();
    this.adminAuth.logout();
    void this.router.navigateByUrl('/admin/access');
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeProfileMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeProfileMenu();
  }

  private async loadProfile(): Promise<void> {
    try {
      const response = await firstValueFrom(this.adminAuth.getProfile());
      this.user.set(response.data);
    } catch {
      this.adminAuth.logout();
      void this.router.navigateByUrl('/admin/access');
    }
  }
}
