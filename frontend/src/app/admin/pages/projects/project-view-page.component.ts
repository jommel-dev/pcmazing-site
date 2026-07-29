import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ProjectDetail } from '../../services/admin-api.service';

@Component({
  selector: 'app-project-view-page',
  imports: [DatePipe, RouterLink],
  templateUrl: './project-view-page.component.html',
})
export class ProjectViewPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly project = signal<ProjectDetail | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.getProject(id));
      this.project.set(response.data);
    } catch {
      this.error.set('Unable to load project details.');
    } finally {
      this.loading.set(false);
    }
  }
}
