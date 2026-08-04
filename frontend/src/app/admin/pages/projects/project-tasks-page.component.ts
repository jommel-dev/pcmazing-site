import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  ProjectBoardStatus,
  ProjectDetail,
  ProjectEpicItem,
  ProjectPhaseItem,
  ProjectTaskAttachmentItem,
  ProjectTaskDetail,
  ProjectTaskItem,
  ProjectTaskPriority,
  ProjectTaskStatus,
  ProjectUserSummary,
} from '../../services/admin-api.service';

type DragPayload =
  | { kind: 'epic'; id: number }
  | { kind: 'task'; id: number };

@Component({
  selector: 'app-project-tasks-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './project-tasks-page.component.html',
  host: {
    class: 'block h-full',
  },
})
export class ProjectTasksPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly project = signal<ProjectDetail | null>(null);
  readonly columns = signal<Array<{ key: ProjectBoardStatus; label: string }>>([]);
  readonly phases = signal<ProjectPhaseItem[]>([]);
  readonly epics = signal<ProjectEpicItem[]>([]);
  readonly tasks = signal<ProjectTaskItem[]>([]);
  readonly currentPhaseId = signal<number | null>(null);
  readonly selectedPhaseId = signal<number | null>(null);
  readonly assignees = signal<ProjectUserSummary[]>([]);

  readonly modalOpen = signal(false);
  readonly editingTaskId = signal<number | null>(null);
  readonly modalError = signal('');
  readonly draftEpicId = signal<number | null>(null);
  readonly draftTitle = signal('');
  readonly draftDescription = signal('');
  readonly draftStatus = signal<ProjectTaskStatus>('todo');
  readonly draftPriority = signal<ProjectTaskPriority>('medium');
  readonly draftAssigneeKey = signal('');
  readonly draftDueDate = signal('');

  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detailSaving = signal(false);
  readonly detailError = signal('');
  readonly detailTask = signal<ProjectTaskDetail | null>(null);
  readonly commentDraft = signal('');

  readonly dragging = signal<DragPayload | null>(null);
  readonly priorities: ProjectTaskPriority[] = ['low', 'medium', 'high', 'urgent'];
  readonly taskStatuses: ProjectTaskStatus[] = [
    'todo',
    'in_progress',
    'in_review',
    'testing',
    'done',
  ];
  readonly projectId = computed(() => Number(this.route.snapshot.paramMap.get('id')));

  selectedPhase(): ProjectPhaseItem | null {
    const id = this.selectedPhaseId();
    return this.phases().find((phase) => phase.id === id) ?? null;
  }

  ngOnInit(): void {
    void this.load();
  }

  epicsForColumn(status: ProjectBoardStatus): ProjectEpicItem[] {
    if (status !== 'epics') {
      return [];
    }
    return this.epics()
      .filter((epic) => epic.boardStatus === 'epics')
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }

  tasksForColumn(status: ProjectBoardStatus): ProjectTaskItem[] {
    if (status === 'epics') {
      return [];
    }
    return this.tasks()
      .filter((task) => task.status === status)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }

  priorityClass(priority: ProjectTaskPriority): string {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'low':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-sky-100 text-sky-700';
    }
  }

  statusLabel(status: ProjectBoardStatus): string {
    return this.columns().find((column) => column.key === status)?.label ?? status;
  }

  attachmentUrl(fileUrl: string): string | null {
    return this.adminApi.resolveProjectUploadUrl(fileUrl);
  }

  isImageAttachment(item: ProjectTaskAttachmentItem): boolean {
    return item.kind === 'screenshot' || item.mimeType.startsWith('image/');
  }

  async selectPhase(phaseId: number): Promise<void> {
    if (this.selectedPhaseId() === phaseId) {
      return;
    }
    this.selectedPhaseId.set(phaseId);
    await this.reloadBoard(phaseId);
  }

  async setAsCurrentPhase(phaseId: number): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.adminApi.setProjectCurrentPhase(this.projectId(), phaseId),
      );
      this.currentPhaseId.set(response.data.currentPhaseId);
      this.phases.set(response.data.phases);
      this.epics.set(response.data.epics);
      this.selectedPhaseId.set(phaseId);
      await this.reloadBoard(phaseId);
    } catch {
      this.error.set('Unable to switch current phase.');
    }
  }

  openCreateModal(epicId?: number, status: ProjectTaskStatus = 'todo'): void {
    const targetEpicId = epicId ?? this.epics()[0]?.id ?? null;
    if (!targetEpicId) {
      this.error.set('No epic available in this phase.');
      return;
    }
    this.editingTaskId.set(null);
    this.draftEpicId.set(targetEpicId);
    this.draftTitle.set('');
    this.draftDescription.set('');
    this.draftStatus.set(status);
    this.draftPriority.set('medium');
    this.draftAssigneeKey.set('');
    this.draftDueDate.set('');
    this.modalError.set('');
    this.modalOpen.set(true);
  }

  openEditModal(task: ProjectTaskItem): void {
    this.editingTaskId.set(task.id);
    this.draftEpicId.set(task.epicId);
    this.draftTitle.set(task.title);
    this.draftDescription.set(task.description ?? '');
    this.draftStatus.set(task.status);
    this.draftPriority.set(task.priority);
    this.draftAssigneeKey.set(
      task.assignee ? `${task.assignee.source}:${task.assignee.id}` : '',
    );
    this.draftDueDate.set(task.dueDate ?? '');
    this.modalError.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.modalError.set('');
  }

  setDraftEpicId(value: number | string | null): void {
    const parsed = value == null || value === '' ? null : Number(value);
    this.draftEpicId.set(Number.isFinite(parsed) ? parsed : null);
  }

  async saveTask(): Promise<void> {
    const title = this.draftTitle().trim();
    if (!title) {
      this.modalError.set('Task title is required.');
      return;
    }

    const epicId = this.draftEpicId();
    if (this.editingTaskId() == null && !epicId) {
      this.modalError.set('Select an epic for this task.');
      return;
    }

    const assigneeKey = this.draftAssigneeKey();
    const assignee = assigneeKey
      ? (() => {
          const [source, idRaw] = assigneeKey.split(':');
          return {
            source: source as 'pcmazing_admin_users' | 'tblusers',
            id: Number(idRaw),
          };
        })()
      : null;

    this.saving.set(true);
    this.modalError.set('');
    try {
      const editId = this.editingTaskId();
      if (editId == null) {
        await firstValueFrom(
          this.adminApi.createProjectTask(this.projectId(), {
            title,
            description: this.draftDescription().trim() || undefined,
            status: this.draftStatus(),
            priority: this.draftPriority(),
            epicId: epicId!,
            assignee,
            dueDate: this.draftDueDate() || undefined,
          }),
        );
      } else {
        await firstValueFrom(
          this.adminApi.updateProjectTask(this.projectId(), editId, {
            title,
            description: this.draftDescription().trim() || '',
            status: this.draftStatus(),
            priority: this.draftPriority(),
            assignee,
            dueDate: this.draftDueDate() || null,
          }),
        );
      }
      this.closeModal();
      await this.reloadBoard(this.selectedPhaseId());
      if (this.detailOpen() && editId != null) {
        await this.openTaskDetail(editId);
      }
    } catch {
      this.modalError.set('Unable to save task.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteTask(task: ProjectTaskItem): Promise<void> {
    if (!confirm(`Delete task "${task.title}"?`)) {
      return;
    }
    try {
      await firstValueFrom(this.adminApi.deleteProjectTask(this.projectId(), task.id));
      if (this.detailTask()?.id === task.id) {
        this.closeDetail();
      }
      await this.reloadBoard(this.selectedPhaseId());
    } catch {
      this.error.set('Unable to delete task.');
    }
  }

  async openTaskDetail(taskId: number): Promise<void> {
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.commentDraft.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.getProjectTaskDetail(this.projectId(), taskId),
      );
      this.detailTask.set(response.data);
    } catch {
      this.detailError.set('Unable to load task details.');
      this.detailTask.set(null);
    } finally {
      this.detailLoading.set(false);
    }
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.detailTask.set(null);
    this.detailError.set('');
    this.commentDraft.set('');
  }

  async addComment(): Promise<void> {
    const task = this.detailTask();
    const body = this.commentDraft().trim();
    if (!task || !body) {
      return;
    }
    this.detailSaving.set(true);
    this.detailError.set('');
    try {
      await firstValueFrom(
        this.adminApi.addProjectTaskComment(this.projectId(), task.id, body),
      );
      this.commentDraft.set('');
      await this.openTaskDetail(task.id);
      await this.reloadBoard(this.selectedPhaseId());
    } catch {
      this.detailError.set('Unable to add comment.');
    } finally {
      this.detailSaving.set(false);
    }
  }

  async onAttachmentSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const task = this.detailTask();
    input.value = '';
    if (!file || !task) {
      return;
    }

    this.detailSaving.set(true);
    this.detailError.set('');
    try {
      await firstValueFrom(
        this.adminApi.uploadProjectTaskAttachment(this.projectId(), task.id, file),
      );
      await this.openTaskDetail(task.id);
      await this.reloadBoard(this.selectedPhaseId());
    } catch {
      this.detailError.set('Unable to upload attachment.');
    } finally {
      this.detailSaving.set(false);
    }
  }

  async deleteAttachment(attachment: ProjectTaskAttachmentItem): Promise<void> {
    const task = this.detailTask();
    if (!task || !confirm(`Delete "${attachment.fileName}"?`)) {
      return;
    }
    this.detailSaving.set(true);
    try {
      await firstValueFrom(
        this.adminApi.deleteProjectTaskAttachment(
          this.projectId(),
          task.id,
          attachment.id,
        ),
      );
      await this.openTaskDetail(task.id);
      await this.reloadBoard(this.selectedPhaseId());
    } catch {
      this.detailError.set('Unable to delete attachment.');
    } finally {
      this.detailSaving.set(false);
    }
  }

  onDragStart(kind: 'epic' | 'task', id: number, event: DragEvent): void {
    const payload: DragPayload = { kind, id };
    this.dragging.set(payload);
    event.dataTransfer?.setData('text/plain', JSON.stringify(payload));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  async onDrop(
    status: ProjectBoardStatus,
    event: DragEvent,
    options?: { epicIndex?: number; taskIndex?: number },
  ): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    let payload = this.dragging();
    const raw = event.dataTransfer?.getData('text/plain');
    if (raw) {
      try {
        payload = JSON.parse(raw) as DragPayload;
      } catch {
        // keep signal payload
      }
    }
    this.dragging.set(null);
    if (!payload) {
      return;
    }

    if (payload.kind === 'epic') {
      if (status !== 'epics') {
        return;
      }
      await this.moveEpicCard(payload.id, status, options?.epicIndex);
      return;
    }
    if (status === 'epics') {
      return;
    }
    await this.moveTaskCard(payload.id, status, options?.taskIndex);
  }

  private async moveEpicCard(
    epicId: number,
    status: 'epics',
    insertIndex?: number,
  ): Promise<void> {
    const epic = this.epics().find((item) => item.id === epicId);
    if (!epic) {
      return;
    }

    const columnEpics = this.epicsForColumn(status).filter((item) => item.id !== epicId);
    const sortOrder =
      insertIndex === undefined
        ? columnEpics.length
        : Math.max(0, Math.min(insertIndex, columnEpics.length));

    if (epic.boardStatus === 'epics' && epic.sortOrder === sortOrder) {
      return;
    }

    try {
      await firstValueFrom(
        this.adminApi.moveProjectEpic(this.projectId(), epicId, { status, sortOrder }),
      );
      this.error.set('');
      await this.reloadBoard(this.selectedPhaseId());
    } catch (err) {
      this.error.set(this.readError(err, 'Unable to move epic.'));
      await this.reloadBoard(this.selectedPhaseId());
    }
  }

  private async moveTaskCard(
    taskId: number,
    status: ProjectTaskStatus,
    insertIndex?: number,
  ): Promise<void> {
    const task = this.tasks().find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    const columnTasks = this.tasksForColumn(status).filter((item) => item.id !== taskId);
    const sortOrder =
      insertIndex === undefined
        ? columnTasks.length
        : Math.max(0, Math.min(insertIndex, columnTasks.length));

    if (task.status === status && task.sortOrder === sortOrder) {
      return;
    }

    // Optimistic UI
    const nextTasks = this.tasks()
      .filter((item) => item.id !== taskId)
      .map((item) => {
        if (item.status === task.status && item.sortOrder > task.sortOrder) {
          return { ...item, sortOrder: item.sortOrder - 1 };
        }
        return item;
      })
      .map((item) => {
        if (item.status === status && item.sortOrder >= sortOrder) {
          return { ...item, sortOrder: item.sortOrder + 1 };
        }
        return item;
      });
    this.tasks.set([...nextTasks, { ...task, status, sortOrder }]);

    try {
      await firstValueFrom(
        this.adminApi.moveProjectTask(this.projectId(), taskId, { status, sortOrder }),
      );
      this.error.set('');
      await this.reloadBoard(this.selectedPhaseId());
    } catch (err) {
      this.error.set(this.readError(err, 'Unable to move task.'));
      await this.reloadBoard(this.selectedPhaseId());
    }
  }

  private readError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const message = err.error?.message;
      if (Array.isArray(message)) {
        return message.join(' ');
      }
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
    return fallback;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [projectResponse, boardResponse] = await Promise.all([
        firstValueFrom(this.adminApi.getProject(this.projectId())),
        firstValueFrom(this.adminApi.listProjectTasks(this.projectId())),
      ]);
      this.project.set(projectResponse.data);
      this.applyBoard(boardResponse.data);

      const project = projectResponse.data;
      const allowed = new Map<string, ProjectUserSummary>();
      if (project.projectManager) {
        allowed.set(
          `${project.projectManager.source}:${project.projectManager.id}`,
          project.projectManager,
        );
      }
      for (const member of project.teamMembers) {
        allowed.set(`${member.source}:${member.id}`, member);
      }
      this.assignees.set([...allowed.values()]);
    } catch {
      this.error.set('Unable to load project tasks.');
    } finally {
      this.loading.set(false);
    }
  }

  private async reloadBoard(phaseId?: number | null): Promise<void> {
    const boardResponse = await firstValueFrom(
      this.adminApi.listProjectTasks(this.projectId(), {
        phaseId: phaseId ?? undefined,
      }),
    );
    this.applyBoard(boardResponse.data);
  }

  private applyBoard(board: {
    columns: Array<{ key: ProjectBoardStatus; label: string }>;
    phases: ProjectPhaseItem[];
    epics: ProjectEpicItem[];
    tasks: ProjectTaskItem[];
    currentPhaseId: number | null;
    selectedPhaseId: number | null;
  }): void {
    this.columns.set(board.columns);
    this.phases.set(board.phases);
    this.epics.set(board.epics);
    this.tasks.set(board.tasks);
    this.currentPhaseId.set(board.currentPhaseId);
    this.selectedPhaseId.set(board.selectedPhaseId);
  }
}
