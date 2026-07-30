import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ProjectListItem } from '../../services/admin-api.service';
import { AdminAuthService } from '../../services/admin-auth.service';
import { isMarketingLead } from '../../rbac/admin-roles';
import { SalesEmployeeDashboardComponent } from './sales-employee-dashboard.component';
import { SalesReportingDashboardComponent } from './sales-reporting-dashboard.component';

type RoleHomeKind = 'marketing' | 'sales' | 'developers';

@Component({
  selector: 'app-role-home-dashboard-page',
  imports: [RouterLink, SalesEmployeeDashboardComponent, SalesReportingDashboardComponent],
  templateUrl: './role-home-dashboard-page.component.html',
})
export class RoleHomeDashboardPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly adminApi = inject(AdminApiService);

  readonly kind = signal<RoleHomeKind>('marketing');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly projectCount = signal(0);
  readonly projects = signal<ProjectListItem[]>([]);

  readonly title = computed(() => {
    if (this.kind() === 'sales') {
      const name = this.adminAuth.getStoredUser()?.fullName?.trim().split(/\s+/)[0];
      return name ? `Hi ${name}` : 'Hi';
    }
    switch (this.kind()) {
      case 'developers':
        return 'Developers Dashboard';
      default:
        return 'Marketing Dashboard';
    }
  });

  readonly showOrgLink = computed(
    () => this.kind() === 'marketing' && isMarketingLead(this.adminAuth.getStoredUser()?.role),
  );

  ngOnInit(): void {
    const kind = (this.route.snapshot.data['roleHome'] ?? 'marketing') as RoleHomeKind;
    this.kind.set(kind);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      if (this.kind() === 'developers') {
        const response = await firstValueFrom(this.adminApi.listProjects());
        const items = response.data.items;
        this.projects.set(items.slice(0, 5));
        this.projectCount.set(items.length);
      }
    } catch {
      this.error.set('Unable to load dashboard data.');
    } finally {
      this.loading.set(false);
    }
  }
}
