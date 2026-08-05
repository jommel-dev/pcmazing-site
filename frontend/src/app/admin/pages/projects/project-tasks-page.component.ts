import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  PaginationMeta,
  ProjectBoardStatus,
  ProjectDetail,
  ProjectEpicItem,
  ProjectPhaseItem,
  ProjectTaskActivityActionType,
  ProjectTaskActivityItem,
  ProjectTaskAttachmentItem,
  ProjectTaskDetail,
  ProjectTaskItem,
  ProjectTaskPriority,
  ProjectTaskStatus,
  ProjectUserSummary,
} from '../../services/admin-api.service';
import {
  addPendingTaskAttachments,
  dataTransferHasOsFiles,
  extractImageFilesFromClipboard,
  extractImageFilesFromDataTransfer,
  PendingTaskAttachment,
  removePendingTaskAttachment,
  reorderPendingTaskAttachments,
  revokePendingTaskAttachments,
  validateProjectTaskImage,
} from './project-task-attachments.util';

type DragPayload =
  | { kind: 'epic'; id: number }
  | { kind: 'task'; id: number };

type TasksViewMode = 'board' | 'history';
type TaskDetailTab = 'details' | 'history';

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

  readonly viewMode = signal<TasksViewMode>('board');
  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  readonly historyItems = signal<ProjectTaskActivityItem[]>([]);
  readonly historyMeta = signal<PaginationMeta | null>(null);
  readonly historyPage = signal(1);
  private readonly historyLimit = 25;

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
  readonly pendingCreateAttachments = signal<PendingTaskAttachment[]>([]);
  readonly pendingAttachmentError = signal('');
  readonly draggingPendingAttachmentId = signal<string | null>(null);
  readonly pendingAttachmentDropTargetId = signal<string | null>(null);
  readonly imageDropActive = signal(false);
  readonly detailImageDropActive = signal(false);
  readonly detailAttachmentError = signal('');

  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detailSaving = signal(false);
  readonly detailError = signal('');
  readonly detailTask = signal<ProjectTaskDetail | null>(null);
  readonly detailTab = signal<TaskDetailTab>('details');
  readonly commentDraft = signal('');
  readonly detailHistoryLoading = signal(false);
  readonly detailHistoryError = signal('');
  readonly detailHistoryItems = signal<ProjectTaskActivityItem[]>([]);
  readonly detailHistoryMeta = signal<PaginationMeta | null>(null);
  readonly detailHistoryPage = signal(1);
  private readonly detailHistoryLimit = 25;

  readonly dragging = signal<DragPayload | null>(null);
  readonly priorities: ProjectTaskPriority[] = ['low', 'medium', 'high', 'urgent'];
  readonly taskStatuses: ProjectTaskStatus[] = [
    'backlog',
    'todo',
    'in_progress',
    'in_review',
    'testing',
    'done',
  ];
  readonly projectId = computed(() => Number(this.route.snapshot.paramMap.get('id')));

  selectedPhase(): ProjectPhaseItem | null {
    const id = this.selectedPhaseId();
    if (id == null) {
      return null;
    }
    return this.phases().find((phase) => Number(phase.id) === id) ?? null;
  }

  isPhaseSelected(phase: ProjectPhaseItem): boolean {
    return this.selectedPhaseId() === Number(phase.id);
  }

  isCurrentPhase(phase: ProjectPhaseItem): boolean {
    return this.currentPhaseId() === Number(phase.id);
  }

  ngOnInit(): void {
    void this.load();
  }

  async setViewMode(mode: TasksViewMode): Promise<void> {
    if (this.viewMode() === mode) {
      return;
    }
    this.viewMode.set(mode);
    if (mode === 'history') {
      await this.loadHistory(1);
    }
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

  statusLabel(status: ProjectBoardStatus | string): string {
    const fromColumns = this.columns().find((column) => column.key === status)?.label;
    if (fromColumns) {
      return fromColumns;
    }
    switch (status) {
      case 'backlog':
        return 'Backlog';
      case 'todo':
        return 'To Do';
      case 'in_progress':
        return 'In Progress';
      case 'in_review':
        return 'In Review';
      case 'testing':
        return 'Testing';
      case 'done':
        return 'Done';
      case 'epics':
        return 'Epics';
      default:
        return status;
    }
  }

  activityActionLabel(actionType: ProjectTaskActivityActionType): string {
    switch (actionType) {
      case 'created':
        return 'Created';
      case 'edited':
        return 'Edited';
      case 'moved':
        return 'Moved';
      case 'deleted':
        return 'Deleted';
      case 'comment_added':
        return 'Comment';
      case 'attachment_added':
        return 'Attachment added';
      case 'attachment_deleted':
        return 'Attachment removed';
      default:
        return actionType;
    }
  }

  activityActorName(item: ProjectTaskActivityItem): string {
    return item.actor.name?.trim() || 'Unknown actor';
  }

  activityAttachmentName(item: ProjectTaskActivityItem): string | null {
    const fileName = item.meta?.['fileName'];
    return typeof fileName === 'string' && fileName.trim() ? fileName.trim() : null;
  }

  canOpenActivityTask(item: ProjectTaskActivityItem): boolean {
    if (item.taskId == null || item.actionType === 'deleted') {
      return false;
    }
    return this.tasks().some((task) => task.id === item.taskId);
  }

  formatActivityTime(value: string): string {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
      return value;
    }
    return new Date(parsed).toLocaleString();
  }

  attachmentUrl(fileUrl: string): string | null {
    return this.adminApi.resolveProjectUploadUrl(fileUrl);
  }

  isImageAttachment(item: ProjectTaskAttachmentItem): boolean {
    return item.kind === 'screenshot' || item.mimeType.startsWith('image/');
  }

  async selectPhase(phaseId: number): Promise<void> {
    const nextPhaseId = Number(phaseId);
    if (!Number.isFinite(nextPhaseId) || this.selectedPhaseId() === nextPhaseId) {
      return;
    }
    this.selectedPhaseId.set(nextPhaseId);
    await this.reloadBoard(nextPhaseId);
    if (this.viewMode() === 'history') {
      await this.loadHistory(1);
    }
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
      if (this.viewMode() === 'history') {
        await this.loadHistory(1);
      }
    } catch {
      this.error.set('Unable to switch current phase.');
    }
  }

  async goToHistoryPage(page: number): Promise<void> {
    const meta = this.historyMeta();
    if (!meta || page < 1 || page > meta.totalPages || page === this.historyPage()) {
      return;
    }
    await this.loadHistory(page);
  }

  openCreateModal(epicId?: number, status: ProjectTaskStatus = 'todo'): void {
    const targetEpicId = epicId ?? this.epics()[0]?.id ?? null;
    if (!targetEpicId) {
      this.error.set('No epic available in this phase.');
      return;
    }
    this.clearPendingCreateAttachments();
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
    this.clearPendingCreateAttachments();
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
    this.clearPendingCreateAttachments();
    this.modalOpen.set(false);
    this.modalError.set('');
  }

  onCreateAttachmentsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    this.queueCreateAttachments(files);
  }

  onCreateModalPaste(event: ClipboardEvent): void {
    if (this.editingTaskId() != null) {
      return;
    }
    const files = extractImageFilesFromClipboard(event);
    if (!files.length) {
      return;
    }
    event.preventDefault();
    this.queueCreateAttachments(files);
  }

  onImageDropZoneDragOver(event: DragEvent): void {
    if (this.editingTaskId() != null || this.saving()) {
      return;
    }
    // Reordering pending thumbnails uses a different drag payload.
    if (this.draggingPendingAttachmentId()) {
      return;
    }
    // MIME types are often empty during dragover — accept any OS file drag.
    if (!dataTransferHasOsFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.imageDropActive.set(true);
  }

  onImageDropZoneDragLeave(event: DragEvent): void {
    const current = event.currentTarget as HTMLElement | null;
    const related = event.relatedTarget as Node | null;
    if (current && related && current.contains(related)) {
      return;
    }
    this.imageDropActive.set(false);
  }

  onImageDropZoneDrop(event: DragEvent): void {
    if (this.editingTaskId() != null || this.saving()) {
      return;
    }
    if (this.draggingPendingAttachmentId()) {
      return;
    }
    if (!dataTransferHasOsFiles(event.dataTransfer)) {
      this.imageDropActive.set(false);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.imageDropActive.set(false);
    const files = extractImageFilesFromDataTransfer(event.dataTransfer);
    if (!files.length) {
      this.pendingAttachmentError.set('Drop JPEG, PNG, WebP, or GIF images only.');
      return;
    }
    this.queueCreateAttachments(files);
  }

  removePendingCreateAttachment(id: string): void {
    this.pendingCreateAttachments.update((items) =>
      removePendingTaskAttachment(items, id),
    );
  }

  onPendingAttachmentDragStart(id: string, event: DragEvent): void {
    this.draggingPendingAttachmentId.set(id);
    event.dataTransfer?.setData('text/pending-attachment', id);
    event.dataTransfer?.setData('text/plain', `pending-attachment:${id}`);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    event.stopPropagation();
  }

  onPendingAttachmentDragOver(id: string, event: DragEvent): void {
    const draggingId = this.draggingPendingAttachmentId();
    if (!draggingId || draggingId === id) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.pendingAttachmentDropTargetId.set(id);
  }

  onPendingAttachmentDragLeave(id: string): void {
    if (this.pendingAttachmentDropTargetId() === id) {
      this.pendingAttachmentDropTargetId.set(null);
    }
  }

  onPendingAttachmentDrop(id: string, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const fromId =
      this.draggingPendingAttachmentId() ||
      event.dataTransfer?.getData('text/pending-attachment') ||
      null;
    this.draggingPendingAttachmentId.set(null);
    this.pendingAttachmentDropTargetId.set(null);
    if (!fromId || fromId === id) {
      return;
    }
    this.pendingCreateAttachments.update((items) =>
      reorderPendingTaskAttachments(items, fromId, id),
    );
  }

  onPendingAttachmentDragEnd(): void {
    this.draggingPendingAttachmentId.set(null);
    this.pendingAttachmentDropTargetId.set(null);
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
        const pending = [...this.pendingCreateAttachments()];
        const created = await firstValueFrom(
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
        const uploadSummary = await this.uploadPendingCreateAttachments(
          created.data.id,
          pending,
        );
        this.closeModal();
        await this.reloadBoard(this.selectedPhaseId());
        if (uploadSummary.failed > 0) {
          this.error.set(
            `Task created, but ${uploadSummary.failed} of ${uploadSummary.total} image(s) failed to upload. Open the task and use Evidence & files to retry.`,
          );
        } else {
          this.error.set('');
        }
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
        this.closeModal();
        await this.reloadBoard(this.selectedPhaseId());
        if (this.detailOpen()) {
          await this.openTaskDetail(editId);
        }
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
    const id = Number(taskId);
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }

    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.detailAttachmentError.set('');
    this.detailImageDropActive.set(false);
    this.detailTab.set('details');
    this.commentDraft.set('');
    this.detailHistoryItems.set([]);
    this.detailHistoryMeta.set(null);
    this.detailHistoryError.set('');
    this.detailHistoryPage.set(1);
    try {
      const response = await firstValueFrom(
        this.adminApi.getProjectTaskDetail(this.projectId(), id),
      );
      const detail = response.data;
      this.detailTask.set({
        ...detail,
        id: Number(detail.id),
        epicId: detail.epicId == null ? null : Number(detail.epicId),
        comments: (detail.comments ?? []).map((comment) => ({
          ...comment,
          id: Number(comment.id),
          taskId: Number(comment.taskId),
        })),
        attachments: (detail.attachments ?? []).map((file) => ({
          ...file,
          id: Number(file.id),
          taskId: Number(file.taskId),
        })),
      });
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
    this.detailAttachmentError.set('');
    this.detailImageDropActive.set(false);
    this.detailTab.set('details');
    this.commentDraft.set('');
    this.detailHistoryItems.set([]);
    this.detailHistoryMeta.set(null);
    this.detailHistoryError.set('');
    this.detailHistoryPage.set(1);
  }

  async setDetailTab(tab: TaskDetailTab): Promise<void> {
    if (this.detailTab() === tab) {
      return;
    }
    this.detailTab.set(tab);
    if (tab === 'history' && this.detailTask()) {
      await this.loadDetailHistory(1);
    }
  }

  async goToDetailHistoryPage(page: number): Promise<void> {
    const meta = this.detailHistoryMeta();
    if (!meta || page < 1 || page > meta.totalPages || page === this.detailHistoryPage()) {
      return;
    }
    await this.loadDetailHistory(page);
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
      await this.refreshDetailAfterMutation(task.id);
      await this.reloadBoard(this.selectedPhaseId());
    } catch {
      this.detailError.set('Unable to add comment.');
    } finally {
      this.detailSaving.set(false);
    }
  }

  async onAttachmentSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    await this.uploadDetailAttachments(files);
  }

  onDetailImageDropZoneDragOver(event: DragEvent): void {
    if (this.detailSaving() || this.detailTab() !== 'details') {
      return;
    }
    if (!dataTransferHasOsFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.detailImageDropActive.set(true);
  }

  onDetailImageDropZoneDragLeave(event: DragEvent): void {
    const current = event.currentTarget as HTMLElement | null;
    const related = event.relatedTarget as Node | null;
    if (current && related && current.contains(related)) {
      return;
    }
    this.detailImageDropActive.set(false);
  }

  async onDetailImageDropZoneDrop(event: DragEvent): Promise<void> {
    if (this.detailSaving() || this.detailTab() !== 'details') {
      return;
    }
    if (!dataTransferHasOsFiles(event.dataTransfer)) {
      this.detailImageDropActive.set(false);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.detailImageDropActive.set(false);
    const files = extractImageFilesFromDataTransfer(event.dataTransfer);
    if (!files.length) {
      this.detailAttachmentError.set('Drop JPEG, PNG, WebP, or GIF images only.');
      return;
    }
    await this.uploadDetailAttachments(files);
  }

  onDetailPanelPaste(event: ClipboardEvent): void {
    if (this.detailTab() !== 'details' || this.detailSaving()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
      return;
    }
    const files = extractImageFilesFromClipboard(event);
    if (!files.length) {
      return;
    }
    event.preventDefault();
    void this.uploadDetailAttachments(files);
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
      await this.refreshDetailAfterMutation(task.id);
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

  private queueCreateAttachments(files: File[]): void {
    if (!files.length || this.editingTaskId() != null) {
      return;
    }
    const result = addPendingTaskAttachments(this.pendingCreateAttachments(), files);
    this.pendingCreateAttachments.set(result.items);
    this.pendingAttachmentError.set(result.errors[0] ?? '');
  }

  private clearPendingCreateAttachments(): void {
    revokePendingTaskAttachments(this.pendingCreateAttachments());
    this.pendingCreateAttachments.set([]);
    this.pendingAttachmentError.set('');
    this.draggingPendingAttachmentId.set(null);
    this.pendingAttachmentDropTargetId.set(null);
    this.imageDropActive.set(false);
  }

  private async uploadPendingCreateAttachments(
    taskId: number,
    pending: PendingTaskAttachment[],
  ): Promise<{ total: number; failed: number }> {
    if (!pending.length) {
      return { total: 0, failed: 0 };
    }

    let failed = 0;
    for (const item of pending) {
      try {
        await firstValueFrom(
          this.adminApi.uploadProjectTaskAttachment(
            this.projectId(),
            taskId,
            item.file,
          ),
        );
      } catch {
        failed += 1;
      }
    }
    return { total: pending.length, failed };
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
    const requestedPhaseId =
      phaseId != null && Number.isFinite(Number(phaseId)) ? Number(phaseId) : undefined;
    const boardResponse = await firstValueFrom(
      this.adminApi.listProjectTasks(this.projectId(), {
        phaseId: requestedPhaseId,
      }),
    );
    this.applyBoard(boardResponse.data, requestedPhaseId);
  }

  private async loadHistory(page: number): Promise<void> {
    this.historyLoading.set(true);
    this.historyError.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.listProjectTaskActivity(this.projectId(), {
          phaseId: this.selectedPhaseId() ?? undefined,
          page,
          limit: this.historyLimit,
        }),
      );
      this.historyItems.set(response.data.items);
      this.historyMeta.set(response.data.meta);
      this.historyPage.set(response.data.meta.page);
      // Do not overwrite selectedPhaseId — viewing a non-current phase must stay sticky.
    } catch {
      this.historyError.set('Unable to load phase history.');
      this.historyItems.set([]);
      this.historyMeta.set(null);
    } finally {
      this.historyLoading.set(false);
    }
  }

  private async loadDetailHistory(page: number): Promise<void> {
    const task = this.detailTask();
    const taskId = task ? Number(task.id) : NaN;
    if (!task || !Number.isFinite(taskId) || taskId <= 0) {
      this.detailHistoryItems.set([]);
      this.detailHistoryMeta.set(null);
      return;
    }

    this.detailHistoryLoading.set(true);
    this.detailHistoryError.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.listProjectTaskActivity(this.projectId(), {
          taskId,
          page,
          limit: this.detailHistoryLimit,
        }),
      );
      // Defense-in-depth: never show another task's activity in this drawer.
      const items = response.data.items.filter(
        (item) => item.taskId != null && Number(item.taskId) === taskId,
      );
      this.detailHistoryItems.set(items);
      this.detailHistoryMeta.set(response.data.meta);
      this.detailHistoryPage.set(response.data.meta.page);
    } catch {
      this.detailHistoryError.set('Unable to load task history.');
      this.detailHistoryItems.set([]);
      this.detailHistoryMeta.set(null);
    } finally {
      this.detailHistoryLoading.set(false);
    }
  }

  private async uploadDetailAttachments(files: File[]): Promise<void> {
    const task = this.detailTask();
    if (!task || !files.length) {
      return;
    }

    const valid: File[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const validationError = validateProjectTaskImage(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }
      valid.push(file);
    }

    if (!valid.length) {
      this.detailAttachmentError.set(errors[0] ?? 'No valid images to upload.');
      return;
    }

    this.detailSaving.set(true);
    this.detailError.set('');
    this.detailAttachmentError.set(errors[0] ?? '');
    let failed = 0;
    try {
      for (const file of valid) {
        try {
          await firstValueFrom(
            this.adminApi.uploadProjectTaskAttachment(this.projectId(), task.id, file),
          );
        } catch {
          failed += 1;
        }
      }
      await this.refreshDetailAfterMutation(task.id);
      await this.reloadBoard(this.selectedPhaseId());
      if (failed > 0) {
        this.detailAttachmentError.set(
          `${failed} of ${valid.length} image(s) failed to upload.`,
        );
      } else if (!errors.length) {
        this.detailAttachmentError.set('');
      }
    } catch {
      this.detailError.set('Unable to upload attachment.');
    } finally {
      this.detailSaving.set(false);
    }
  }

  private async refreshDetailAfterMutation(taskId: number): Promise<void> {
    const activeTab = this.detailTab();
    this.detailLoading.set(true);
    this.detailError.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.getProjectTaskDetail(this.projectId(), taskId),
      );
      const detail = response.data;
      this.detailTask.set({
        ...detail,
        id: Number(detail.id),
        epicId: detail.epicId == null ? null : Number(detail.epicId),
        comments: (detail.comments ?? []).map((comment) => ({
          ...comment,
          id: Number(comment.id),
          taskId: Number(comment.taskId),
        })),
        attachments: (detail.attachments ?? []).map((file) => ({
          ...file,
          id: Number(file.id),
          taskId: Number(file.taskId),
        })),
      });
      if (activeTab === 'history') {
        await this.loadDetailHistory(1);
      }
    } catch {
      this.detailError.set('Unable to load task details.');
      this.detailTask.set(null);
    } finally {
      this.detailLoading.set(false);
    }
  }

  private applyBoard(
    board: {
      columns: Array<{ key: ProjectBoardStatus; label: string }>;
      phases: ProjectPhaseItem[];
      epics: ProjectEpicItem[];
      tasks: ProjectTaskItem[];
      currentPhaseId: number | null;
      selectedPhaseId: number | null;
    },
    preferredPhaseId?: number,
  ): void {
    this.columns.set(board.columns);
    this.phases.set(
      board.phases.map((phase) => ({
        ...phase,
        id: Number(phase.id),
        projectId: Number(phase.projectId),
        epicCount: Number(phase.epicCount),
      })),
    );
    // Modules (epics) are already filtered to the selected phase by the API.
    this.epics.set(
      board.epics.map((epic) => ({
        ...epic,
        id: Number(epic.id),
        projectId: Number(epic.projectId),
        phaseId: Number(epic.phaseId),
        sortOrder: Number(epic.sortOrder),
        taskCount: Number(epic.taskCount),
        doneTaskCount: Number(epic.doneTaskCount),
      })),
    );
    this.tasks.set(
      board.tasks.map((task) => ({
        ...task,
        id: Number(task.id),
        projectId: Number(task.projectId),
        epicId: task.epicId != null ? Number(task.epicId) : null,
        sortOrder: Number(task.sortOrder),
      })),
    );
    const currentPhaseId =
      board.currentPhaseId != null && Number.isFinite(Number(board.currentPhaseId))
        ? Number(board.currentPhaseId)
        : null;
    const apiSelectedPhaseId =
      board.selectedPhaseId != null && Number.isFinite(Number(board.selectedPhaseId))
        ? Number(board.selectedPhaseId)
        : null;
    this.currentPhaseId.set(currentPhaseId);
    // Prefer the phase the user asked to view over API echo of currentPhaseId.
    const nextSelected =
      preferredPhaseId != null &&
      board.phases.some((phase) => Number(phase.id) === preferredPhaseId)
        ? preferredPhaseId
        : apiSelectedPhaseId;
    this.selectedPhaseId.set(nextSelected);
  }
}
