import { Component, HostListener, computed, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { filterNavSectionsForRole } from '../data/admin-modules.data';
import {
  getAllowedModuleKeys,
  getLogoutRoute,
  getRoleHomeRoute,
  isSuperAdmin,
} from '../rbac/admin-roles';
import { AdminApiService } from '../services/admin-api.service';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminThemeService } from '../services/admin-theme.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent implements OnInit {
  private readonly adminAuth = inject(AdminAuthService);
  private readonly adminApi = inject(AdminApiService);
  private readonly router = inject(Router);
  readonly themeService = inject(AdminThemeService);

  readonly user = signal(this.adminAuth.getStoredUser());
  readonly sidebarOpen = signal(false);
  readonly profileMenuOpen = signal(false);

  readonly navSections = computed(() => {
    const role = this.user()?.role;
    return filterNavSectionsForRole(role, getAllowedModuleKeys(role));
  });

  readonly homeRoute = computed(() => getRoleHomeRoute(this.user()?.role));
  readonly showAdminDashboardLink = computed(() => isSuperAdmin(this.user()?.role));

  readonly logoSrc = '/images/logo.png';

  ngOnInit(): void {
    void this.loadProfile();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.user.set(this.adminAuth.getStoredUser());
      this.closeSidebar();
      this.closeProfileMenu();
    });
  }

  toggleSidebar(event: Event): void {
    event.stopPropagation();
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleProfileMenu(event: Event): void {
    event.stopPropagation();
    this.profileMenuOpen.update((open) => !open);
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  openEditProfile(): void {
    this.closeProfileMenu();
    void this.router.navigate(['/admin/profile']);
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

  profileImageUrl(): string | null {
    return this.adminApi.resolveProfileImageUrl(this.user()?.profileImageUrl);
  }

  logout(): void {
    this.closeProfileMenu();
    const role = this.user()?.role;
    this.adminAuth.logout();
    void this.router.navigateByUrl(getLogoutRoute(role));
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeProfileMenu();
    this.closeSidebar();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeProfileMenu();
    this.closeSidebar();
  }

  private async loadProfile(): Promise<void> {
    try {
      const response = await firstValueFrom(this.adminAuth.getProfile());
      this.user.set(response.data);
    } catch {
      const role = this.user()?.role;
      this.adminAuth.logout();
      void this.router.navigateByUrl(getLogoutRoute(role));
    }
  }
}
