export const PROJECT_TASK_ACTIVITY_TYPES = [
  'created',
  'edited',
  'moved',
  'deleted',
  'comment_added',
  'attachment_added',
  'attachment_deleted',
] as const;

export type ProjectTaskActivityType = (typeof PROJECT_TASK_ACTIVITY_TYPES)[number];

export interface TaskActivityActorSnapshot {
  userId: number | null;
  source: 'pcmazing_admin_users' | 'tblusers' | null;
  name: string | null;
}

export interface TaskActivityRowInput {
  id: number;
  projectId: number;
  phaseId: number | null;
  taskId: number | null;
  taskTitle: string;
  epicId: number | null;
  epicTitle: string | null;
  actionType: ProjectTaskActivityType;
  actorUserId: number | null;
  actorUserSource: 'pcmazing_admin_users' | 'tblusers' | null;
  actorName: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  details: string | null;
  metaJson: unknown;
  createdAt: string;
}

export interface ProjectTaskActivityItem {
  id: number;
  projectId: number;
  phaseId: number | null;
  taskId: number | null;
  taskTitle: string;
  epicId: number | null;
  epicTitle: string | null;
  actionType: ProjectTaskActivityType;
  actor: TaskActivityActorSnapshot;
  fromStatus: string | null;
  toStatus: string | null;
  details: string | null;
  meta: Record<string, unknown> | null;
  summary: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  testing: 'Testing',
  done: 'Done',
  epics: 'Epics',
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) {
    return 'Unknown';
  }
  return STATUS_LABELS[status] ?? status;
}

export function serializeTaskActivityMeta(
  meta: Record<string, unknown> | null | undefined,
): string | null {
  if (!meta || !Object.keys(meta).length) {
    return null;
  }
  return JSON.stringify(meta);
}

export function parseTaskActivityMeta(raw: unknown): Record<string, unknown> | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

export function buildTaskActivitySummary(input: {
  actionType: ProjectTaskActivityType;
  taskTitle: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  details?: string | null;
  meta?: Record<string, unknown> | null;
}): string {
  const title = input.taskTitle.trim() || 'Untitled task';
  switch (input.actionType) {
    case 'created':
      return `Created “${title}”`;
    case 'edited':
      return `Edited “${title}”`;
    case 'moved':
      return `Moved “${title}” from ${statusLabel(input.fromStatus)} to ${statusLabel(input.toStatus)}`;
    case 'deleted':
      return `Deleted “${title}”`;
    case 'comment_added':
      return `Commented on “${title}”`;
    case 'attachment_added': {
      const fileName =
        typeof input.meta?.fileName === 'string' && input.meta.fileName.trim()
          ? input.meta.fileName.trim()
          : null;
      return fileName
        ? `Attached “${fileName}” to “${title}”`
        : `Attached a file to “${title}”`;
    }
    case 'attachment_deleted': {
      const fileName =
        typeof input.meta?.fileName === 'string' && input.meta.fileName.trim()
          ? input.meta.fileName.trim()
          : null;
      return fileName
        ? `Removed “${fileName}” from “${title}”`
        : `Removed an attachment from “${title}”`;
    }
    default:
      return title;
  }
}

export function mapTaskActivityRow(row: TaskActivityRowInput): ProjectTaskActivityItem {
  const meta = parseTaskActivityMeta(row.metaJson);
  return {
    id: row.id,
    projectId: row.projectId,
    phaseId: row.phaseId,
    taskId: row.taskId,
    taskTitle: row.taskTitle,
    epicId: row.epicId,
    epicTitle: row.epicTitle,
    actionType: row.actionType,
    actor: {
      userId: row.actorUserId,
      source: row.actorUserSource,
      name: row.actorName,
    },
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    details: row.details,
    meta,
    summary: buildTaskActivitySummary({
      actionType: row.actionType,
      taskTitle: row.taskTitle,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      details: row.details,
      meta,
    }),
    createdAt: row.createdAt,
  };
}

export function actorDisplayName(actor: {
  fullName?: string | null;
  username?: string | null;
} | null | undefined): string | null {
  const fullName = actor?.fullName?.trim();
  if (fullName) {
    return fullName;
  }
  const username = actor?.username?.trim();
  return username || null;
}

/** Pure filter used by history listing and unit tests. */
export function matchesTaskActivityPhaseFilter(
  row: { phaseId: number | null },
  phaseId: number,
): boolean {
  return row.phaseId === phaseId;
}

/**
 * Build activity WHERE clause.
 * When `taskId` is set, scope to that task only (ignore phase) so task detail
 * History never mixes other tasks from the selected phase.
 */
export function buildTaskActivityPhaseFilter(
  projectId: number,
  phaseId: number | null | undefined,
  taskId?: number,
): {
  whereSql: string;
  params: unknown[];
} {
  const params: unknown[] = [projectId];
  let whereSql = 'project_id = $1';

  if (taskId != null && Number.isFinite(taskId) && taskId > 0) {
    params.push(taskId);
    whereSql += ` AND task_id = $${params.length}`;
    return { whereSql, params };
  }

  if (phaseId != null && Number.isFinite(phaseId) && phaseId > 0) {
    params.push(phaseId);
    whereSql += ` AND phase_id = $${params.length}`;
  }

  return { whereSql, params };
}
