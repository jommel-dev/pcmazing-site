import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isDeveloperOrPm, isSuperAdmin } from '../../rbac/admin-roles';
import { AdminApiService, ProjectListItem } from '../../services/admin-api.service';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-projects-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './projects-page.component.html',
})
export class ProjectsPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly projects = signal<ProjectListItem[]>([]);
  readonly search = signal('');

  readonly isMyProjects = computed(() => {
    const role = this.adminAuth.getStoredUser()?.role;
    return isDeveloperOrPm(role) && !isSuperAdmin(role);
  });

  ngOnInit(): void {
    void this.load();
  }

  filteredProjects(): ProjectListItem[] {
    const query = this.search().trim().toLowerCase();
    if (!query) {
      return this.projects();
    }

    return this.projects().filter((project) => {
      const haystack = [
        project.name,
        project.projectType ?? '',
        project.clientName,
        project.company ?? '',
        project.projectManager?.fullName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.listProjects());
      this.projects.set(response.data.items);
    } catch {
      this.error.set('Unable to load projects.');
    } finally {
      this.loading.set(false);
    }
  }
}
