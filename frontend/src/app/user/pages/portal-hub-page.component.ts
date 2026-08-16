import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { getRoleHomeRoute } from '../../admin/rbac/admin-roles';
import { AdminAuthService } from '../../admin/services/admin-auth.service';

export type PortalHubAppId = 'admin' | 'people' | 'time-clock';

@Component({
  selector: 'app-portal-hub-page',
  imports: [RouterLink],
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
      description: 'Team sign-in for Marketing, Sales, and Development.',
      path: '/user/login',
    },
    {
      id: 'time-clock',
      title: 'Time Clock',
      description: 'Clock in and out with attendance selfies.',
      path: '/time-clock',
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
    void this.router.navigateByUrl(getRoleHomeRoute(this.adminAuth.getStoredUser()?.role));
  }
}
