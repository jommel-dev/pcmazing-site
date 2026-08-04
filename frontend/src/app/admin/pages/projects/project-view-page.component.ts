import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ProjectDetail, ProjectUserRef, ProjectUserSummary } from '../../services/admin-api.service';

@Component({
  selector: 'app-project-view-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './project-view-page.component.html',
})
export class ProjectViewPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly project = signal<ProjectDetail | null>(null);
  readonly assignees = signal<ProjectUserSummary[]>([]);
  readonly developerCandidates = signal<ProjectUserSummary[]>([]);
  readonly editOpen = signal(false);
  readonly savingAssignments = signal(false);
  readonly assignmentError = signal('');
  readonly assignmentSearch = signal('');
  readonly managerSearch = signal('');
  readonly selectedManagerKey = signal('');
  readonly selectedDeveloperKeys = signal<string[]>([]);

  readonly filteredDeveloperCandidates = computed(() => {
    const query = this.assignmentSearch().trim().toLowerCase();
    if (!query) {
      return this.developerCandidates();
    }

    return this.developerCandidates().filter((user) => {
      const haystack = [user.fullName, user.username, user.role, user.email ?? ''].join(' ').toLowerCase();
      return haystack.includes(query.replace(/^@/, ''));
    });
  });

  readonly filteredManagerCandidates = computed(() => {
    const query = this.managerSearch().trim().toLowerCase();
    if (!query) {
      return this.assignees();
    }

    return this.assignees().filter((user) => {
      const haystack = [user.fullName, user.username, user.role, user.email ?? ''].join(' ').toLowerCase();
      return haystack.includes(query.replace(/^@/, ''));
    });
  });

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
      this.selectedManagerKey.set(this.userKey(response.data.projectManager));
      this.selectedDeveloperKeys.set(response.data.teamMembers.map((member) => this.userKey(member)));
      const [allAssigneesResponse, developerAssigneesResponse] = await Promise.all([
        firstValueFrom(this.adminApi.listProjectAssignees()),
        firstValueFrom(this.adminApi.listProjectAssignees('developer')),
      ]);
      this.assignees.set(allAssigneesResponse.data);
      this.developerCandidates.set(developerAssigneesResponse.data);
    } catch {
      this.error.set('Unable to load project details.');
    } finally {
      this.loading.set(false);
    }
  }

  openEditAssignments(): void {
    const current = this.project();
    if (!current) {
      return;
    }

    this.assignmentError.set('');
    this.assignmentSearch.set('');
    this.managerSearch.set('');
    this.selectedManagerKey.set(this.userKey(current.projectManager));
    this.selectedDeveloperKeys.set(current.teamMembers.map((member) => this.userKey(member)));
    this.editOpen.set(true);
  }

  closeEditAssignments(): void {
    this.editOpen.set(false);
    this.assignmentError.set('');
  }

  isDeveloperSelected(user: ProjectUserSummary): boolean {
    return this.selectedDeveloperKeys().includes(this.userKey(user));
  }

  toggleDeveloper(user: ProjectUserSummary): void {
    const key = this.userKey(user);
    const current = [...this.selectedDeveloperKeys()];
    const index = current.indexOf(key);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(key);
    }
    this.selectedDeveloperKeys.set(current);
    this.assignmentSearch.set('');
  }

  selectManager(user: ProjectUserSummary): void {
    this.selectedManagerKey.set(this.userKey(user));
    this.managerSearch.set('');
  }

  removeSelectedDeveloper(user: ProjectUserSummary): void {
    const key = this.userKey(user);
    const current = this.selectedDeveloperKeys().filter((selectedKey) => selectedKey !== key);
    this.selectedDeveloperKeys.set(current);
  }

  async saveAssignments(): Promise<void> {
    const current = this.project();
    if (!current) {
      return;
    }

    const managerKey = this.selectedManagerKey();
    const developerKeys = this.selectedDeveloperKeys();
    if (!managerKey) {
      this.assignmentError.set('Select a project manager.');
      return;
    }
    if (!developerKeys.length) {
      this.assignmentError.set('Select at least one developer team member.');
      return;
    }

    this.savingAssignments.set(true);
    this.assignmentError.set('');

    try {
      const payload = {
        projectManager: this.parseUserKey(managerKey),
        teamMembers: developerKeys.map((key) => this.parseUserKey(key)),
      };
      const response = await firstValueFrom(this.adminApi.updateProjectAssignments(current.id, payload));
      this.project.set(response.data);
      this.closeEditAssignments();
    } catch {
      this.assignmentError.set('Unable to update project assignments.');
    } finally {
      this.savingAssignments.set(false);
    }
  }

  userKey(user: ProjectUserSummary | null): string {
    if (!user) {
      return '';
    }
    return `${user.source}:${user.id}`;
  }

  private parseUserKey(key: string): ProjectUserRef {
    const [source, idRaw] = key.split(':');
    return { id: Number(idRaw), source: source as ProjectUserRef['source'] };
  }
}
