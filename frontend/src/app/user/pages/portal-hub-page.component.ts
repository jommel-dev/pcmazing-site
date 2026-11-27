import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { getRoleHomeRoute, isSuperAdmin } from '../../admin/rbac/admin-roles';
import { AdminAuthService } from '../../admin/services/admin-auth.service';
import { PORTAL_HOME_ROUTE } from '../portal-post-login-route';
import { PortalIconComponent } from '../portal/ui/portal-icon.component';

export type PortalHubAppId = 'admin' | 'people';

@Component({
  selector: 'app-portal-hub-page',
  imports: [RouterLink, PortalIconComponent],
  templateUrl: './portal-hub-page.component.html',
})
export class PortalHubPageComponent implements OnInit, OnDestroy {
  private readonly adminAuth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private stopAuthWatch: (() => void) | null = null;

  readonly apps: Array<{
    id: PortalHubAppId;
    title: string;
    description: string;
    path: string;
  }> = [
    {
      id: 'admin',
      title: 'Admin Portal',
      description: 'Staff access and administrative tools.',
      path: '/admin/access',
    },
    {
      id: 'people',
      title: 'MyPeoplePortal',
      description: 'Your pay, attendance, time clock and workspace.',
      path: '/user/login',
    },
  ];

  ngOnInit(): void {
    this.redirectIfAuthenticated();
    this.stopAuthWatch = this.adminAuth.onAuthStorageChange(() => this.redirectIfAuthenticated());
  }

  ngOnDestroy(): void {
    this.stopAuthWatch?.();
  }

  private redirectIfAuthenticated(): void {
    if (!this.adminAuth.isAuthenticated()) {
      return;
    }
    const role = this.adminAuth.getStoredUser()?.role;
    void this.router.navigateByUrl(isSuperAdmin(role) ? getRoleHomeRoute(role) : PORTAL_HOME_ROUTE);
  }
}
