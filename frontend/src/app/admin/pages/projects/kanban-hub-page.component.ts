import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ProjectListItem } from '../../services/admin-api.service';

@Component({
  selector: 'app-kanban-hub-page',
  imports: [RouterLink],
  templateUrl: './kanban-hub-page.component.html',
})
export class KanbanHubPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly projects = signal<ProjectListItem[]>([]);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.listProjects());
      this.projects.set(response.data.items);
    } catch {
      this.error.set('Unable to load projects for Kanban.');
    } finally {
      this.loading.set(false);
    }
  }
}
