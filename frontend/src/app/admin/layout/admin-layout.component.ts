import { DOCUMENT } from '@angular/common';
import { Component, HostListener, OnDestroy, Renderer2, computed, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { filterNavSectionsForRole } from '../data/admin-modules.data';
import { resolveAllowedModules } from '../rbac/admin-permissions';
import {
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
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  readonly themeService = inject(AdminThemeService);

  readonly user = signal(this.adminAuth.getStoredUser());
  readonly sidebarOpen = signal(false);
  readonly profileMenuOpen = signal(false);

  readonly navSections = computed(() => {
    const user = this.user();
    const allowed = resolveAllowedModules({
      role: user?.role,
      permissionKeys: user?.permissionKeys,
      payrollEnabled: Boolean(user?.payrollEnabled),
    });
    return filterNavSectionsForRole(user?.role, allowed, {
      payrollEnabled: Boolean(user?.payrollEnabled),
    });
  });

  readonly homeRoute = computed(() => getRoleHomeRoute(this.user()?.role));
  readonly showAdminDashboardLink = computed(() => isSuperAdmin(this.user()?.role));

  readonly logoSrc = '/images/logo.png';

  ngOnInit(): void {
    this.renderer.addClass(this.document.body, 'admin-shell-active');
    void this.loadProfile();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.user.set(this.adminAuth.getStoredUser());
      this.closeSidebar();
      this.closeProfileMenu();
    });
  }

  ngOnDestroy(): void {
    this.renderer.removeClass(this.document.body, 'admin-shell-active');
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
      this.adminAuth.updateStoredUser(response.data);
    } catch (error: unknown) {
      // Only force logout on auth failure — transient/network/5xx must not wipe the session
      // while child pages are still loading (leaves UI looking signed-in with no token).
      const status =
        error && typeof error === 'object' && 'status' in error
          ? Number((error as { status?: number }).status)
          : 0;
      if (status === 401 || status === 403) {
        const role = this.user()?.role;
        this.adminAuth.logout();
        void this.router.navigateByUrl(getLogoutRoute(role));
      }
    }
  }
}
