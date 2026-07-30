import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';
import { buildTblusersSelectSql } from '../users/tblusers.util';
import { isDeveloperOrPm, isSuperAdmin } from '../rbac/admin-roles.util';
import { CreateProjectDto, ProjectUserRefDto } from './dto/create-project.dto';
import {
  CreateProjectTaskDto,
  MoveProjectEpicDto,
  MoveProjectTaskDto,
  PROJECT_TASK_STATUSES,
  SetCurrentPhaseDto,
  UpdateProjectTaskDto,
} from './dto/project-task.dto';
import { PoolClient } from 'pg';
import {
  deleteProjectTaskAttachmentFile,
  saveProjectTaskAttachmentFile,
} from './task-attachment.util';

type UserSource = 'pcmazing_admin_users' | 'tblusers';
type BoardStatus = (typeof PROJECT_TASK_STATUSES)[number];

export interface ProjectActor {
  userId: number;
  source: UserSource;
  role?: string | null;
}

export interface ProjectUserSummary {
  id: number;
  source: UserSource;
  username: string;
  fullName: string;
  role: string;
  email: string | null;
  isActive: boolean;
}

export interface ProjectListItem {
  id: number;
  prospectId: number;
  name: string;
  projectType: string | null;
  status: string;
  clientName: string;
  company: string | null;
  projectManager: ProjectUserSummary | null;
  teamMemberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectListItem {
  teamMembers: ProjectUserSummary[];
}

export interface ProjectTaskItem {
  id: number;
  projectId: number;
  epicId: number | null;
  epicTitle: string | null;
  title: string;
  description: string | null;
  status: (typeof PROJECT_TASK_STATUSES)[number];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sortOrder: number;
  assignee: ProjectUserSummary | null;
  dueDate: string | null;
  commentCount: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTaskCommentItem {
  id: number;
  taskId: number;
  body: string;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTaskAttachmentItem {
  id: number;
  taskId: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  kind: 'screenshot' | 'file';
  createdByUserId: number;
  createdAt: string;
}

export interface ProjectTaskDetail extends ProjectTaskItem {
  comments: ProjectTaskCommentItem[];
  attachments: ProjectTaskAttachmentItem[];
}

export interface ProjectEpicItem {
  id: number;
  projectId: number;
  phaseId: number;
  contractModuleId: number | null;
  title: string;
  description: string | null;
  sortOrder: number;
  status: 'planned' | 'active' | 'completed';
  boardStatus: BoardStatus;
  taskCount: number;
  doneTaskCount: number;
  tasks: ProjectTaskItem[];
}

export interface ProjectPhaseItem {
  id: number;
  projectId: number;
  contractMilestoneId: number | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  sortOrder: number;
  status: 'planned' | 'active' | 'completed';
  phaseLabel: string;
  epicCount: number;
}

@Injectable()
export class ProjectsService {
  private schemaReady = false;

  constructor(private readonly databaseService: DatabaseService) {}

  async ensureReady(): Promise<void> {
    if (this.schemaReady) {
      return;
    }

    if (!(await tableExists(this.databaseService, 'pcmazing_client_prospects'))) {
      throw new ServiceUnavailableException('Lead generation tables are not available.');
    }

    if (!(await tableExists(this.databaseService, 'pcmazing_projects'))) {
      throw new ServiceUnavailableException('Projects table is not available. Run migration 27.');
    }

    if (!(await tableExists(this.databaseService, 'pcmazing_project_tasks'))) {
      throw new ServiceUnavailableException('Project tasks table is not available. Run migration 28.');
    }

    if (!(await tableExists(this.databaseService, 'pcmazing_project_epics'))) {
      throw new ServiceUnavailableException('Project epics table is not available. Run migration 29.');
    }

    if (!(await tableExists(this.databaseService, 'pcmazing_project_phases'))) {
      throw new ServiceUnavailableException('Project phases table is not available. Run migration 30.');
    }

    const boardStatusColumn = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'pcmazing_project_epics'
         AND column_name = 'board_status'`,
    );
    if (Number(boardStatusColumn.rows[0]?.count ?? 0) === 0) {
      throw new ServiceUnavailableException(
        'Epic board_status column is not available. Run migration 32.',
      );
    }

    if (!(await tableExists(this.databaseService, 'pcmazing_project_task_comments'))) {
      throw new ServiceUnavailableException(
        'Project task comments table is not available. Run migration 33.',
      );
    }

    if (!(await tableExists(this.databaseService, 'pcmazing_project_task_attachments'))) {
      throw new ServiceUnavailableException(
        'Project task attachments table is not available. Run migration 33.',
      );
    }

    this.schemaReady = true;
  }

  async listAssignees(role?: string): Promise<ProjectUserSummary[]> {
    await this.ensureReady();
    const users = await this.loadActiveUsers();
    if (!role?.trim()) {
      return users;
    }

    const normalized = role.trim().toLowerCase();
    return users.filter((user) => user.role.toLowerCase() === normalized);
  }

  async assertCanAccessProject(projectId: number, actor?: ProjectActor | null): Promise<void> {
    if (!actor || !Number.isFinite(actor.userId) || actor.userId <= 0) {
      return;
    }
    if (isSuperAdmin(actor.role) || !isDeveloperOrPm(actor.role)) {
      return;
    }

    const result = await this.databaseService.query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM pcmazing_projects p
       WHERE p.id = $1
         AND (
           (p.project_manager_user_id = $2 AND p.project_manager_user_source = $3)
           OR EXISTS (
             SELECT 1
             FROM pcmazing_project_members m
             WHERE m.project_id = p.id
               AND m.user_id = $2
               AND m.user_source = $3
           )
         )
       LIMIT 1`,
      [projectId, actor.userId, actor.source],
    );

    if (!result.rows[0]) {
      throw new ForbiddenException('You do not have access to this project.');
    }
  }

  async list(actor?: ProjectActor | null): Promise<{ items: ProjectListItem[] }> {
    await this.ensureReady();

    const scoped = Boolean(
      actor &&
        Number.isFinite(actor.userId) &&
        actor.userId > 0 &&
        isDeveloperOrPm(actor.role) &&
        !isSuperAdmin(actor.role),
    );
    const params: Array<number | string> = [];
    let scopeSql = '';
    if (scoped && actor) {
      params.push(actor.userId, actor.source);
      scopeSql = `WHERE (
        (p.project_manager_user_id = $1 AND p.project_manager_user_source = $2)
        OR EXISTS (
          SELECT 1
          FROM pcmazing_project_members m2
          WHERE m2.project_id = p.id
            AND m2.user_id = $1
            AND m2.user_source = $2
        )
      )`;
    }

    const result = await this.databaseService.query<{
      id: number;
      prospect_id: number;
      name: string;
      project_type: string | null;
      status: string;
      client_name: string;
      company: string | null;
      project_manager_user_id: number;
      project_manager_user_source: UserSource;
      team_member_count: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
        p.id,
        p.prospect_id,
        p.name,
        p.project_type,
        p.status,
        c.client_name,
        c.company,
        p.project_manager_user_id,
        p.project_manager_user_source,
        COUNT(m.id)::text AS team_member_count,
        p.created_at::text,
        p.updated_at::text
       FROM pcmazing_projects p
       INNER JOIN pcmazing_client_prospects c ON c.id = p.prospect_id
       LEFT JOIN pcmazing_project_members m ON m.project_id = p.id
       ${scopeSql}
       GROUP BY p.id, c.client_name, c.company
       ORDER BY p.updated_at DESC, p.id DESC`,
      params,
    );

    const managers = await this.resolveUsers(
      result.rows.map((row) => ({
        id: row.project_manager_user_id,
        source: row.project_manager_user_source,
      })),
    );

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        prospectId: row.prospect_id,
        name: row.name,
        projectType: row.project_type,
        status: row.status,
        clientName: row.client_name,
        company: row.company,
        projectManager: managers.get(`${row.project_manager_user_source}:${row.project_manager_user_id}`) ?? null,
        teamMemberCount: Number(row.team_member_count),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  }

  async getById(id: number): Promise<ProjectDetail> {
    await this.ensureReady();

    const result = await this.databaseService.query<{
      id: number;
      prospect_id: number;
      name: string;
      project_type: string | null;
      status: string;
      client_name: string;
      company: string | null;
      project_manager_user_id: number;
      project_manager_user_source: UserSource;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
        p.id,
        p.prospect_id,
        p.name,
        p.project_type,
        p.status,
        c.client_name,
        c.company,
        p.project_manager_user_id,
        p.project_manager_user_source,
        p.created_at::text,
        p.updated_at::text
       FROM pcmazing_projects p
       INNER JOIN pcmazing_client_prospects c ON c.id = p.prospect_id
       WHERE p.id = $1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Project not found.');
    }

    const membersResult = await this.databaseService.query<{
      user_id: number;
      user_source: UserSource;
    }>(
      `SELECT user_id, user_source
       FROM pcmazing_project_members
       WHERE project_id = $1
       ORDER BY id ASC`,
      [id],
    );

    const refs: ProjectUserRefDto[] = [
      { id: row.project_manager_user_id, source: row.project_manager_user_source },
      ...membersResult.rows.map((member) => ({ id: member.user_id, source: member.user_source })),
    ];
    const users = await this.resolveUsers(refs);
    const teamMembers = membersResult.rows
      .map((member) => users.get(`${member.user_source}:${member.user_id}`))
      .filter((user): user is ProjectUserSummary => Boolean(user));

    return {
      id: row.id,
      prospectId: row.prospect_id,
      name: row.name,
      projectType: row.project_type,
      status: row.status,
      clientName: row.client_name,
      company: row.company,
      projectManager: users.get(`${row.project_manager_user_source}:${row.project_manager_user_id}`) ?? null,
      teamMemberCount: teamMembers.length,
      teamMembers,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getByProspectId(prospectId: number): Promise<{ id: number } | null> {
    await this.ensureReady();
    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM pcmazing_projects WHERE prospect_id = $1`,
      [prospectId],
    );
    return result.rows[0] ?? null;
  }

  async create(dto: CreateProjectDto, createdByUserId: number): Promise<ProjectDetail> {
    await this.ensureReady();

    const prospect = await this.databaseService.query<{
      id: number;
      status: string;
      client_name: string;
      system_name: string | null;
      system_type: string | null;
    }>(
      `SELECT
        p.id,
        p.status,
        p.client_name,
        c.system_name,
        c.system_type
       FROM pcmazing_client_prospects p
       LEFT JOIN pcmazing_client_contracts c ON c.prospect_id = p.id
       WHERE p.id = $1`,
      [dto.prospectId],
    );

    const prospectRow = prospect.rows[0];
    if (!prospectRow) {
      throw new NotFoundException('Client prospect not found.');
    }

    if (prospectRow.status !== 'contract_signed') {
      throw new BadRequestException('A project can only be created after the contract is signed.');
    }

    const existing = await this.getByProspectId(dto.prospectId);
    if (existing) {
      throw new ConflictException('A project already exists for this signed contract.');
    }

    const manager = await this.requireActiveUser(dto.projectManager);
    const teamMembers = await this.requireDeveloperUsers(dto.teamMembers);

    const projectName = dto.name?.trim() || prospectRow.system_name?.trim() || prospectRow.client_name;
    const projectType = prospectRow.system_type?.trim() || null;

    const created = await this.databaseService.withTransaction(async (client) => {
      const insert = await client.query<{ id: number }>(
        `INSERT INTO pcmazing_projects (
          prospect_id,
          name,
          project_type,
          status,
          project_manager_user_id,
          project_manager_user_source,
          created_by_user_id
        ) VALUES ($1, $2, $3, 'active', $4, $5, $6)
        RETURNING id`,
        [
          dto.prospectId,
          projectName,
          projectType,
          manager.id,
          manager.source,
          createdByUserId,
        ],
      );

      const projectId = insert.rows[0]?.id;
      if (!projectId) {
        throw new BadRequestException('Unable to create project.');
      }

      for (const member of teamMembers) {
        await client.query(
          `INSERT INTO pcmazing_project_members (project_id, user_id, user_source, member_role)
           VALUES ($1, $2, $3, 'developer')
           ON CONFLICT (project_id, user_id, user_source) DO NOTHING`,
          [projectId, member.id, member.source],
        );
      }

      await this.seedPhasesAndModuleEpics(client, projectId, dto.prospectId);

      return projectId;
    });

    return this.getById(created);
  }

  async listTasks(
    projectId: number,
    phaseIdRaw?: number,
  ): Promise<{
    columns: Array<{ key: BoardStatus; label: string }>;
    phases: ProjectPhaseItem[];
    epics: ProjectEpicItem[];
    tasks: ProjectTaskItem[];
    currentPhaseId: number | null;
    selectedPhaseId: number | null;
  }> {
    await this.ensureReady();
    const project = await this.getById(projectId);
    await this.ensureHierarchySeeded(projectId, project.prospectId);

    const phases = await this.listPhases(projectId);
    const currentResult = await this.databaseService.query<{
      current_phase_id: number | null;
    }>(`SELECT current_phase_id FROM pcmazing_projects WHERE id = $1`, [projectId]);

    let currentPhaseId = currentResult.rows[0]?.current_phase_id ?? null;
    if (!currentPhaseId && phases.length) {
      currentPhaseId = phases[0].id;
      await this.databaseService.query(
        `UPDATE pcmazing_projects SET current_phase_id = $1, updated_at = NOW() WHERE id = $2`,
        [currentPhaseId, projectId],
      );
      await this.databaseService.query(
        `UPDATE pcmazing_project_phases
         SET status = CASE WHEN id = $1 THEN 'active' ELSE status END,
             updated_at = NOW()
         WHERE project_id = $2`,
        [currentPhaseId, projectId],
      );
    }

    const selectedPhaseId =
      phaseIdRaw && phases.some((phase) => phase.id === phaseIdRaw)
        ? phaseIdRaw
        : currentPhaseId;

    const epics = selectedPhaseId
      ? await this.listEpicsForPhase(projectId, selectedPhaseId)
      : [];

    const tasks = selectedPhaseId
      ? await this.listTasksForPhase(projectId, selectedPhaseId)
      : [];

    return {
      columns: [
        { key: 'backlog', label: 'Backlog' },
        { key: 'todo', label: 'To Do' },
        { key: 'in_progress', label: 'In Progress' },
        { key: 'in_review', label: 'In Review' },
        { key: 'done', label: 'Done' },
      ],
      phases: await this.listPhases(projectId),
      epics,
      tasks,
      currentPhaseId,
      selectedPhaseId,
    };
  }

  async setCurrentPhase(projectId: number, dto: SetCurrentPhaseDto): Promise<{
    currentPhaseId: number;
    phases: ProjectPhaseItem[];
    epics: ProjectEpicItem[];
  }> {
    await this.ensureReady();
    await this.getById(projectId);

    const phase = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM pcmazing_project_phases WHERE id = $1 AND project_id = $2`,
      [dto.phaseId, projectId],
    );
    if (!phase.rows[0]) {
      throw new NotFoundException('Phase not found for this project.');
    }

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE pcmazing_project_phases
         SET status = CASE
           WHEN id = $1 THEN 'active'
           WHEN status = 'active' THEN 'planned'
           ELSE status
         END,
         updated_at = NOW()
         WHERE project_id = $2`,
        [dto.phaseId, projectId],
      );
      await client.query(
        `UPDATE pcmazing_projects
         SET current_phase_id = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [dto.phaseId, projectId],
      );
    });

    return {
      currentPhaseId: dto.phaseId,
      phases: await this.listPhases(projectId),
      epics: await this.listEpicsForPhase(projectId, dto.phaseId),
    };
  }

  async moveEpic(
    projectId: number,
    epicId: number,
    dto: MoveProjectEpicDto,
  ): Promise<ProjectEpicItem> {
    await this.ensureReady();
    await this.getById(projectId);
    const epic = await this.getEpicById(projectId, epicId);

    if (dto.status === 'done') {
      const open = await this.countOpenTasksForEpic(epicId);
      if (open > 0) {
        throw new BadRequestException(
          'Complete all subtasks before moving this epic to Done.',
        );
      }
    }

    await this.databaseService.withTransaction(async (client) => {
      if (epic.boardStatus !== dto.status) {
        await client.query(
          `UPDATE pcmazing_project_epics
           SET sort_order = sort_order - 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND phase_id = $2
             AND board_status = $3
             AND sort_order > $4`,
          [projectId, epic.phaseId, epic.boardStatus, epic.sortOrder],
        );
        await client.query(
          `UPDATE pcmazing_project_epics
           SET sort_order = sort_order + 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND phase_id = $2
             AND board_status = $3
             AND sort_order >= $4
             AND id <> $5`,
          [projectId, epic.phaseId, dto.status, dto.sortOrder, epicId],
        );
      } else if (dto.sortOrder < epic.sortOrder) {
        await client.query(
          `UPDATE pcmazing_project_epics
           SET sort_order = sort_order + 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND phase_id = $2
             AND board_status = $3
             AND sort_order >= $4
             AND sort_order < $5
             AND id <> $6`,
          [projectId, epic.phaseId, dto.status, dto.sortOrder, epic.sortOrder, epicId],
        );
      } else if (dto.sortOrder > epic.sortOrder) {
        await client.query(
          `UPDATE pcmazing_project_epics
           SET sort_order = sort_order - 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND phase_id = $2
             AND board_status = $3
             AND sort_order <= $4
             AND sort_order > $5
             AND id <> $6`,
          [projectId, epic.phaseId, dto.status, dto.sortOrder, epic.sortOrder, epicId],
        );
      }

      const lifecycleStatus = dto.status === 'done' ? 'completed' : 'active';
      await client.query(
        `UPDATE pcmazing_project_epics
         SET board_status = $1,
             sort_order = $2,
             status = $3,
             updated_at = NOW()
         WHERE id = $4 AND project_id = $5`,
        [dto.status, dto.sortOrder, lifecycleStatus, epicId, projectId],
      );
    });

    return this.getEpicById(projectId, epicId);
  }

  async createTask(
    projectId: number,
    dto: CreateProjectTaskDto,
    createdByUserId: number,
  ): Promise<ProjectTaskItem> {
    await this.ensureReady();
    const project = await this.getById(projectId);
    await this.ensureHierarchySeeded(projectId, project.prospectId);

    if (!dto.epicId) {
      throw new BadRequestException('Select an epic (module) before creating a task.');
    }

    await this.assertEpicBelongsToProject(projectId, dto.epicId);

    const status = dto.status ?? 'todo';
    const priority = dto.priority ?? 'medium';
    let assigneeId: number | null = null;
    let assigneeSource: UserSource | null = null;

    if (dto.assignee) {
      const assignee = await this.requireActiveUser(dto.assignee);
      assigneeId = assignee.id;
      assigneeSource = assignee.source;
    }

    const maxOrder = await this.databaseService.query<{ max: string | null }>(
      `SELECT MAX(sort_order)::text AS max
       FROM pcmazing_project_tasks
       WHERE project_id = $1 AND status = $2 AND epic_id = $3`,
      [projectId, status, dto.epicId],
    );
    const sortOrder = Number(maxOrder.rows[0]?.max ?? -1) + 1;

    const insert = await this.databaseService.query<{ id: number }>(
      `INSERT INTO pcmazing_project_tasks (
        project_id, epic_id, title, description, status, priority, sort_order,
        assignee_user_id, assignee_user_source, due_date, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11)
      RETURNING id`,
      [
        projectId,
        dto.epicId,
        dto.title.trim(),
        dto.description?.trim() || null,
        status,
        priority,
        sortOrder,
        assigneeId,
        assigneeSource,
        dto.dueDate ?? null,
        createdByUserId,
      ],
    );

    const taskId = insert.rows[0]?.id;
    if (!taskId) {
      throw new BadRequestException('Unable to create task.');
    }

    await this.databaseService.query(
      `UPDATE pcmazing_projects SET current_epic_id = $1, updated_at = NOW() WHERE id = $2`,
      [dto.epicId, projectId],
    );

    await this.syncEpicAfterTaskChange(projectId, dto.epicId);
    return this.getTaskById(projectId, taskId);
  }

  async updateTask(
    projectId: number,
    taskId: number,
    dto: UpdateProjectTaskDto,
  ): Promise<ProjectTaskItem> {
    await this.ensureReady();
    const existing = await this.getTaskById(projectId, taskId);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (dto.title !== undefined) {
      params.push(dto.title.trim());
      updates.push(`title = $${params.length}`);
    }
    if (dto.description !== undefined) {
      params.push(dto.description?.trim() || null);
      updates.push(`description = $${params.length}`);
    }
    if (dto.status !== undefined) {
      params.push(dto.status);
      updates.push(`status = $${params.length}`);
    }
    if (dto.priority !== undefined) {
      params.push(dto.priority);
      updates.push(`priority = $${params.length}`);
    }
    if (dto.epicId !== undefined) {
      await this.assertEpicBelongsToProject(projectId, dto.epicId);
      params.push(dto.epicId);
      updates.push(`epic_id = $${params.length}`);
    }
    if (dto.sortOrder !== undefined) {
      params.push(dto.sortOrder);
      updates.push(`sort_order = $${params.length}`);
    }
    if (dto.dueDate !== undefined) {
      params.push(dto.dueDate || null);
      updates.push(`due_date = $${params.length}::date`);
    }
    if (dto.assignee !== undefined) {
      if (dto.assignee === null) {
        updates.push('assignee_user_id = NULL');
        updates.push('assignee_user_source = NULL');
      } else {
        const assignee = await this.requireActiveUser(dto.assignee);
        params.push(assignee.id);
        updates.push(`assignee_user_id = $${params.length}`);
        params.push(assignee.source);
        updates.push(`assignee_user_source = $${params.length}`);
      }
    }

    if (!updates.length) {
      return this.getTaskById(projectId, taskId);
    }

    updates.push('updated_at = NOW()');
    params.push(taskId, projectId);

    await this.databaseService.query(
      `UPDATE pcmazing_project_tasks
       SET ${updates.join(', ')}
       WHERE id = $${params.length - 1} AND project_id = $${params.length}`,
      params,
    );

    const updated = await this.getTaskById(projectId, taskId);
    const epicIds = new Set<number>();
    if (existing.epicId) {
      epicIds.add(existing.epicId);
    }
    if (updated.epicId) {
      epicIds.add(updated.epicId);
    }
    for (const epicId of epicIds) {
      await this.syncEpicAfterTaskChange(projectId, epicId);
    }
    return updated;
  }

  async moveTask(
    projectId: number,
    taskId: number,
    dto: MoveProjectTaskDto,
  ): Promise<ProjectTaskItem> {
    await this.ensureReady();
    const task = await this.getTaskById(projectId, taskId);

    await this.databaseService.withTransaction(async (client) => {
      if (task.status !== dto.status) {
        await client.query(
          `UPDATE pcmazing_project_tasks
           SET sort_order = sort_order - 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND status = $2
             AND sort_order > $3
             AND COALESCE(epic_id, 0) = COALESCE($4::bigint, 0)`,
          [projectId, task.status, task.sortOrder, task.epicId],
        );
        await client.query(
          `UPDATE pcmazing_project_tasks
           SET sort_order = sort_order + 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND status = $2
             AND sort_order >= $3
             AND COALESCE(epic_id, 0) = COALESCE($4::bigint, 0)`,
          [projectId, dto.status, dto.sortOrder, task.epicId],
        );
      } else if (dto.sortOrder < task.sortOrder) {
        await client.query(
          `UPDATE pcmazing_project_tasks
           SET sort_order = sort_order + 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND status = $2
             AND sort_order >= $3
             AND sort_order < $4
             AND id <> $5
             AND COALESCE(epic_id, 0) = COALESCE($6::bigint, 0)`,
          [projectId, dto.status, dto.sortOrder, task.sortOrder, taskId, task.epicId],
        );
      } else if (dto.sortOrder > task.sortOrder) {
        await client.query(
          `UPDATE pcmazing_project_tasks
           SET sort_order = sort_order - 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND status = $2
             AND sort_order <= $3
             AND sort_order > $4
             AND id <> $5
             AND COALESCE(epic_id, 0) = COALESCE($6::bigint, 0)`,
          [projectId, dto.status, dto.sortOrder, task.sortOrder, taskId, task.epicId],
        );
      }

      await client.query(
        `UPDATE pcmazing_project_tasks
         SET status = $1,
             sort_order = $2,
             updated_at = NOW()
         WHERE id = $3 AND project_id = $4`,
        [dto.status, dto.sortOrder, taskId, projectId],
      );
    });

    if (task.epicId) {
      await this.syncEpicAfterTaskChange(projectId, task.epicId);
    }
    return this.getTaskById(projectId, taskId);
  }

  async deleteTask(projectId: number, taskId: number): Promise<void> {
    await this.ensureReady();
    const task = await this.getTaskById(projectId, taskId);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `DELETE FROM pcmazing_project_tasks WHERE id = $1 AND project_id = $2`,
        [taskId, projectId],
      );
      await client.query(
        `UPDATE pcmazing_project_tasks
         SET sort_order = sort_order - 1,
             updated_at = NOW()
         WHERE project_id = $1
           AND status = $2
           AND sort_order > $3
           AND COALESCE(epic_id, 0) = COALESCE($4::bigint, 0)`,
        [projectId, task.status, task.sortOrder, task.epicId],
      );
    });

    if (task.epicId) {
      await this.syncEpicAfterTaskChange(projectId, task.epicId);
    }
  }

  async getTaskDetail(projectId: number, taskId: number): Promise<ProjectTaskDetail> {
    await this.ensureReady();
    const task = await this.getTaskById(projectId, taskId);
    const [comments, attachments] = await Promise.all([
      this.listTaskComments(projectId, taskId),
      this.listTaskAttachments(projectId, taskId),
    ]);
    return { ...task, comments, attachments };
  }

  async addTaskComment(
    projectId: number,
    taskId: number,
    body: string,
    createdByUserId: number,
  ): Promise<ProjectTaskCommentItem> {
    await this.ensureReady();
    await this.getTaskById(projectId, taskId);
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('Comment body is required.');
    }

    const insert = await this.databaseService.query<{
      id: number;
      task_id: number;
      body: string;
      created_by_user_id: number;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO pcmazing_project_task_comments (
        task_id, project_id, body, created_by_user_id
      ) VALUES ($1, $2, $3, $4)
      RETURNING id, task_id, body, created_by_user_id, created_at::text, updated_at::text`,
      [taskId, projectId, trimmed, createdByUserId],
    );

    const row = insert.rows[0];
    if (!row) {
      throw new BadRequestException('Unable to add comment.');
    }

    return {
      id: row.id,
      taskId: row.task_id,
      body: row.body,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async uploadTaskAttachment(
    projectId: number,
    taskId: number,
    file: Express.Multer.File,
    createdByUserId: number,
  ): Promise<ProjectTaskAttachmentItem> {
    await this.ensureReady();
    await this.getTaskById(projectId, taskId);

    const saved = await saveProjectTaskAttachmentFile(taskId, file);

    const insert = await this.databaseService.query<{
      id: number;
      task_id: number;
      file_name: string;
      file_url: string;
      mime_type: string;
      file_size: string;
      kind: 'screenshot' | 'file';
      created_by_user_id: number;
      created_at: string;
    }>(
      `INSERT INTO pcmazing_project_task_attachments (
        task_id, project_id, file_name, file_url, mime_type, file_size, kind, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id, task_id, file_name, file_url, mime_type, file_size::text, kind,
        created_by_user_id, created_at::text`,
      [
        taskId,
        projectId,
        file.originalname || 'attachment',
        saved.fileUrl,
        file.mimetype,
        file.size,
        saved.kind,
        createdByUserId,
      ],
    );

    const row = insert.rows[0];
    if (!row) {
      throw new BadRequestException('Unable to upload attachment.');
    }

    return {
      id: row.id,
      taskId: row.task_id,
      fileName: row.file_name,
      fileUrl: row.file_url,
      mimeType: row.mime_type,
      fileSize: Number(row.file_size),
      kind: row.kind,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
    };
  }

  async deleteTaskAttachment(
    projectId: number,
    taskId: number,
    attachmentId: number,
  ): Promise<void> {
    await this.ensureReady();
    await this.getTaskById(projectId, taskId);

    const existing = await this.databaseService.query<{ id: number; file_url: string }>(
      `SELECT id, file_url
       FROM pcmazing_project_task_attachments
       WHERE id = $1 AND task_id = $2 AND project_id = $3`,
      [attachmentId, taskId, projectId],
    );
    if (!existing.rows[0]) {
      throw new NotFoundException('Attachment not found.');
    }

    await this.databaseService.query(
      `DELETE FROM pcmazing_project_task_attachments
       WHERE id = $1 AND task_id = $2 AND project_id = $3`,
      [attachmentId, taskId, projectId],
    );

    await deleteProjectTaskAttachmentFile(existing.rows[0].file_url);
  }

  private async getTaskById(projectId: number, taskId: number): Promise<ProjectTaskItem> {
    const result = await this.databaseService.query<{
      id: number;
      project_id: number;
      epic_id: number | null;
      epic_title: string | null;
      title: string;
      description: string | null;
      status: (typeof PROJECT_TASK_STATUSES)[number];
      priority: 'low' | 'medium' | 'high' | 'urgent';
      sort_order: number;
      assignee_user_id: number | null;
      assignee_user_source: UserSource | null;
      due_date: string | null;
      comment_count: string;
      attachment_count: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
        t.id,
        t.project_id,
        t.epic_id,
        e.title AS epic_title,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.sort_order,
        t.assignee_user_id,
        t.assignee_user_source,
        t.due_date::text,
        (
          SELECT COUNT(*)::text
          FROM pcmazing_project_task_comments c
          WHERE c.task_id = t.id
        ) AS comment_count,
        (
          SELECT COUNT(*)::text
          FROM pcmazing_project_task_attachments a
          WHERE a.task_id = t.id
        ) AS attachment_count,
        t.created_at::text,
        t.updated_at::text
       FROM pcmazing_project_tasks t
       LEFT JOIN pcmazing_project_epics e ON e.id = t.epic_id
       WHERE t.id = $1 AND t.project_id = $2`,
      [taskId, projectId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Task not found.');
    }

    let assignee: ProjectUserSummary | null = null;
    if (row.assignee_user_id != null && row.assignee_user_source) {
      const users = await this.resolveUsers([
        { id: row.assignee_user_id, source: row.assignee_user_source },
      ]);
      assignee = users.get(`${row.assignee_user_source}:${row.assignee_user_id}`) ?? null;
    }

    return {
      id: row.id,
      projectId: row.project_id,
      epicId: row.epic_id,
      epicTitle: row.epic_title,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      sortOrder: row.sort_order,
      assignee,
      dueDate: row.due_date,
      commentCount: Number(row.comment_count),
      attachmentCount: Number(row.attachment_count),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async listTaskComments(
    projectId: number,
    taskId: number,
  ): Promise<ProjectTaskCommentItem[]> {
    const result = await this.databaseService.query<{
      id: number;
      task_id: number;
      body: string;
      created_by_user_id: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, task_id, body, created_by_user_id, created_at::text, updated_at::text
       FROM pcmazing_project_task_comments
       WHERE project_id = $1 AND task_id = $2
       ORDER BY created_at ASC, id ASC`,
      [projectId, taskId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      body: row.body,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private async listTaskAttachments(
    projectId: number,
    taskId: number,
  ): Promise<ProjectTaskAttachmentItem[]> {
    const result = await this.databaseService.query<{
      id: number;
      task_id: number;
      file_name: string;
      file_url: string;
      mime_type: string;
      file_size: string;
      kind: 'screenshot' | 'file';
      created_by_user_id: number;
      created_at: string;
    }>(
      `SELECT
        id, task_id, file_name, file_url, mime_type, file_size::text, kind,
        created_by_user_id, created_at::text
       FROM pcmazing_project_task_attachments
       WHERE project_id = $1 AND task_id = $2
       ORDER BY created_at DESC, id DESC`,
      [projectId, taskId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      fileName: row.file_name,
      fileUrl: row.file_url,
      mimeType: row.mime_type,
      fileSize: Number(row.file_size),
      kind: row.kind,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
    }));
  }

  private async listPhases(projectId: number): Promise<ProjectPhaseItem[]> {
    const result = await this.databaseService.query<{
      id: number;
      project_id: number;
      contract_milestone_id: number | null;
      title: string;
      description: string | null;
      due_date: string | null;
      sort_order: number;
      status: 'planned' | 'active' | 'completed';
      epic_count: string;
    }>(
      `SELECT
        p.id,
        p.project_id,
        p.contract_milestone_id,
        p.title,
        p.description,
        p.due_date::text,
        p.sort_order,
        p.status,
        COUNT(e.id)::text AS epic_count
       FROM pcmazing_project_phases p
       LEFT JOIN pcmazing_project_epics e ON e.phase_id = p.id
       WHERE p.project_id = $1
       GROUP BY p.id
       ORDER BY p.sort_order ASC, p.id ASC`,
      [projectId],
    );

    return result.rows.map((row, index) => ({
      id: row.id,
      projectId: row.project_id,
      contractMilestoneId: row.contract_milestone_id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      sortOrder: row.sort_order,
      status: row.status,
      phaseLabel: `Phase ${index + 1}`,
      epicCount: Number(row.epic_count),
    }));
  }

  private async listEpicsForPhase(projectId: number, phaseId: number): Promise<ProjectEpicItem[]> {
    const result = await this.databaseService.query<{
      id: number;
      project_id: number;
      phase_id: number;
      contract_module_id: number | null;
      title: string;
      description: string | null;
      sort_order: number;
      status: 'planned' | 'active' | 'completed';
      board_status: BoardStatus;
      task_count: string;
      done_task_count: string;
    }>(
      `SELECT
        e.id,
        e.project_id,
        e.phase_id,
        e.contract_module_id,
        e.title,
        e.description,
        e.sort_order,
        e.status,
        e.board_status,
        COUNT(t.id)::text AS task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'done')::text AS done_task_count
       FROM pcmazing_project_epics e
       LEFT JOIN pcmazing_project_tasks t ON t.epic_id = e.id
       WHERE e.project_id = $1
         AND e.phase_id = $2
       GROUP BY e.id
       ORDER BY
         CASE e.board_status
           WHEN 'backlog' THEN 1
           WHEN 'todo' THEN 2
           WHEN 'in_progress' THEN 3
           WHEN 'in_review' THEN 4
           WHEN 'done' THEN 5
           ELSE 6
         END,
         e.sort_order ASC,
         e.id ASC`,
      [projectId, phaseId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      phaseId: row.phase_id,
      contractModuleId: row.contract_module_id,
      title: row.title,
      description: row.description,
      sortOrder: row.sort_order,
      status: row.status,
      boardStatus: row.board_status,
      taskCount: Number(row.task_count),
      doneTaskCount: Number(row.done_task_count),
      tasks: [],
    }));
  }

  private async listTasksForPhase(projectId: number, phaseId: number): Promise<ProjectTaskItem[]> {
    const result = await this.databaseService.query<{
      id: number;
      project_id: number;
      epic_id: number | null;
      epic_title: string | null;
      title: string;
      description: string | null;
      status: BoardStatus;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      sort_order: number;
      assignee_user_id: number | null;
      assignee_user_source: UserSource | null;
      due_date: string | null;
      comment_count: string;
      attachment_count: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
        t.id,
        t.project_id,
        t.epic_id,
        e.title AS epic_title,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.sort_order,
        t.assignee_user_id,
        t.assignee_user_source,
        t.due_date::text,
        (
          SELECT COUNT(*)::text
          FROM pcmazing_project_task_comments c
          WHERE c.task_id = t.id
        ) AS comment_count,
        (
          SELECT COUNT(*)::text
          FROM pcmazing_project_task_attachments a
          WHERE a.task_id = t.id
        ) AS attachment_count,
        t.created_at::text,
        t.updated_at::text
       FROM pcmazing_project_tasks t
       INNER JOIN pcmazing_project_epics e ON e.id = t.epic_id
       WHERE t.project_id = $1
         AND e.phase_id = $2
       ORDER BY
         CASE t.status
           WHEN 'backlog' THEN 1
           WHEN 'todo' THEN 2
           WHEN 'in_progress' THEN 3
           WHEN 'in_review' THEN 4
           WHEN 'done' THEN 5
           ELSE 6
         END,
         t.sort_order ASC,
         t.id ASC`,
      [projectId, phaseId],
    );

    const assigneeRefs = result.rows
      .filter((row) => row.assignee_user_id != null && row.assignee_user_source)
      .map((row) => ({
        id: row.assignee_user_id as number,
        source: row.assignee_user_source as UserSource,
      }));
    const users = await this.resolveUsers(assigneeRefs);

    return result.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      epicId: row.epic_id,
      epicTitle: row.epic_title,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      sortOrder: row.sort_order,
      assignee:
        row.assignee_user_id != null && row.assignee_user_source
          ? users.get(`${row.assignee_user_source}:${row.assignee_user_id}`) ?? null
          : null,
      dueDate: row.due_date,
      commentCount: Number(row.comment_count),
      attachmentCount: Number(row.attachment_count),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private async getEpicById(projectId: number, epicId: number): Promise<ProjectEpicItem> {
    const epic = await this.databaseService.query<{ phase_id: number }>(
      `SELECT phase_id FROM pcmazing_project_epics WHERE id = $1 AND project_id = $2`,
      [epicId, projectId],
    );
    if (!epic.rows[0]) {
      throw new NotFoundException('Epic not found for this project.');
    }

    const epics = await this.listEpicsForPhase(projectId, epic.rows[0].phase_id);
    const found = epics.find((item) => item.id === epicId);
    if (!found) {
      throw new NotFoundException('Epic not found for this project.');
    }
    return found;
  }

  private async countOpenTasksForEpic(epicId: number): Promise<number> {
    const result = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM pcmazing_project_tasks
       WHERE epic_id = $1
         AND status <> 'done'`,
      [epicId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async syncEpicAfterTaskChange(projectId: number, epicId: number): Promise<void> {
    const epic = await this.databaseService.query<{
      board_status: BoardStatus;
      task_count: string;
      open_count: string;
    }>(
      `SELECT
        e.board_status,
        COUNT(t.id)::text AS task_count,
        COUNT(t.id) FILTER (WHERE t.status <> 'done')::text AS open_count
       FROM pcmazing_project_epics e
       LEFT JOIN pcmazing_project_tasks t ON t.epic_id = e.id
       WHERE e.id = $1 AND e.project_id = $2
       GROUP BY e.id`,
      [epicId, projectId],
    );

    const row = epic.rows[0];
    if (!row) {
      return;
    }

    const openCount = Number(row.open_count ?? 0);
    // If epic is Done but a subtask is no longer Done, pull it back to In Review.
    if (row.board_status === 'done' && openCount > 0) {
      await this.databaseService.query(
        `UPDATE pcmazing_project_epics
         SET board_status = 'in_review',
             status = 'active',
             updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [epicId, projectId],
      );
    }
  }

  private async ensureHierarchySeeded(projectId: number, prospectId: number): Promise<void> {
    // Idempotent: creates missing phases/module epics without wiping existing rows.
    await this.databaseService.withTransaction(async (client) => {
      await this.seedPhasesAndModuleEpics(client, projectId, prospectId);
    });
  }

  private async seedPhasesAndModuleEpics(
    client: PoolClient,
    projectId: number,
    prospectId: number,
  ): Promise<void> {
    const milestones = await client.query<{
      id: number;
      title: string;
      description: string | null;
      due_date: string | null;
      sort_order: number;
      connected_module_sort_order: string | null;
    }>(
      `SELECT
        m.id,
        m.title,
        m.description,
        m.due_date::text,
        m.sort_order,
        m.connected_module_sort_order::text
       FROM pcmazing_client_contract_milestones m
       INNER JOIN pcmazing_client_contracts c ON c.id = m.contract_id
       WHERE c.prospect_id = $1
       ORDER BY m.sort_order ASC, m.id ASC`,
      [prospectId],
    );

    const modules = await client.query<{
      id: number;
      module_name: string;
      description: string | null;
      sort_order: number;
    }>(
      `SELECT mod.id, mod.module_name, mod.description, mod.sort_order
       FROM pcmazing_client_contract_modules mod
       INNER JOIN pcmazing_client_contracts c ON c.id = mod.contract_id
       WHERE c.prospect_id = $1
       ORDER BY mod.sort_order ASC, mod.id ASC`,
      [prospectId],
    );

    if (!milestones.rows.length) {
      const phase = await client.query<{ id: number }>(
        `INSERT INTO pcmazing_project_phases (
          project_id, title, description, sort_order, status
        ) VALUES ($1, 'Phase 1', 'Default project phase', 0, 'active')
        RETURNING id`,
        [projectId],
      );
      const phaseId = phase.rows[0]?.id;
      const epic = await client.query<{ id: number }>(
        `INSERT INTO pcmazing_project_epics (
          project_id, phase_id, title, description, sort_order, status
        ) VALUES ($1, $2, 'General', 'Default epic', 0, 'active')
        RETURNING id`,
        [projectId, phaseId],
      );
      await client.query(
        `UPDATE pcmazing_projects
         SET current_phase_id = $1, current_epic_id = $2, updated_at = NOW()
         WHERE id = $3`,
        [phaseId, epic.rows[0]?.id, projectId],
      );
      return;
    }

    let firstPhaseId: number | null = null;
    let firstEpicId: number | null = null;

    for (const [index, milestone] of milestones.rows.entries()) {
      let phaseId = (
        await client.query<{ id: number }>(
          `SELECT id FROM pcmazing_project_phases
           WHERE project_id = $1 AND contract_milestone_id = $2`,
          [projectId, milestone.id],
        )
      ).rows[0]?.id;

      if (!phaseId) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO pcmazing_project_phases (
            project_id, contract_milestone_id, title, description, due_date, sort_order, status
          ) VALUES ($1, $2, $3, $4, $5::date, $6, $7)
          RETURNING id`,
          [
            projectId,
            milestone.id,
            milestone.title.trim() || `Milestone ${index + 1}`,
            milestone.description,
            milestone.due_date,
            index,
            index === 0 ? 'active' : 'planned',
          ],
        );
        phaseId = inserted.rows[0]?.id;
      }

      if (!phaseId) {
        continue;
      }

      if (index === 0) {
        firstPhaseId = phaseId;
      }

      const linkedIndexes = this.parseModuleSortOrders(milestone.connected_module_sort_order);
      const linkedModules = linkedIndexes.length
        ? linkedIndexes
            .map((moduleIndex) => modules.rows[moduleIndex] ?? modules.rows.find((row) => row.sort_order === moduleIndex))
            .filter((row): row is { id: number; module_name: string; description: string | null; sort_order: number } => Boolean(row))
        : [];

      // Milestone modules become epic items; fallback epic if none linked.
      const finalSources =
        linkedModules.length > 0
          ? linkedModules.map((module) => ({
              id: module.id as number | null,
              module_name: module.module_name,
              description: module.description,
              sort_order: module.sort_order,
            }))
          : [
              {
                id: null as number | null,
                module_name: `${milestone.title.trim() || `Milestone ${index + 1}`} work`,
                description: milestone.description,
                sort_order: 0,
              },
            ];

      for (const [epicIndex, module] of finalSources.entries()) {
        let epicId: number | null = null;
        if (module.id != null) {
          epicId = (
            await client.query<{ id: number }>(
              `SELECT id FROM pcmazing_project_epics
               WHERE phase_id = $1 AND contract_module_id = $2`,
              [phaseId, module.id],
            )
          ).rows[0]?.id ?? null;
        } else {
          epicId = (
            await client.query<{ id: number }>(
              `SELECT id FROM pcmazing_project_epics
               WHERE phase_id = $1 AND contract_module_id IS NULL
               ORDER BY sort_order ASC, id ASC
               LIMIT 1`,
              [phaseId],
            )
          ).rows[0]?.id ?? null;
        }

        if (!epicId) {
          const insertedEpic = await client.query<{ id: number }>(
            `INSERT INTO pcmazing_project_epics (
              project_id, phase_id, contract_milestone_id, contract_module_id,
              title, description, sort_order, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned')
            RETURNING id`,
            [
              projectId,
              phaseId,
              milestone.id,
              module.id,
              module.module_name.trim() || `Epic ${epicIndex + 1}`,
              module.description,
              epicIndex,
            ],
          );
          epicId = insertedEpic.rows[0]?.id ?? null;
        }

        if (index === 0 && epicIndex === 0 && epicId) {
          firstEpicId = epicId;
        }
      }
    }

    if (firstPhaseId) {
      await client.query(
        `UPDATE pcmazing_projects
         SET current_phase_id = COALESCE(current_phase_id, $1),
             current_epic_id = COALESCE(current_epic_id, $2),
             updated_at = NOW()
         WHERE id = $3`,
        [firstPhaseId, firstEpicId, projectId],
      );
    }
  }

  private parseModuleSortOrders(value?: string | null): number[] {
    if (!value) {
      return [];
    }
    return String(value)
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((part) => Number.isInteger(part) && part >= 0);
  }

  private async assertEpicBelongsToProject(projectId: number, epicId: number): Promise<void> {
    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM pcmazing_project_epics WHERE id = $1 AND project_id = $2`,
      [epicId, projectId],
    );
    if (!result.rows[0]) {
      throw new BadRequestException('Selected epic does not belong to this project.');
    }
  }

  private async requireActiveUser(ref: ProjectUserRefDto): Promise<ProjectUserSummary> {
    const users = await this.resolveUsers([ref]);
    const user = users.get(`${ref.source}:${ref.id}`);
    if (!user) {
      throw new BadRequestException('Selected project manager was not found.');
    }
    if (!user.isActive) {
      throw new BadRequestException('Project manager must be an active user.');
    }
    return user;
  }

  private async requireDeveloperUsers(refs: ProjectUserRefDto[]): Promise<ProjectUserSummary[]> {
    const unique = new Map<string, ProjectUserRefDto>();
    for (const ref of refs) {
      unique.set(`${ref.source}:${ref.id}`, ref);
    }

    const users = await this.resolveUsers([...unique.values()]);
    const resolved: ProjectUserSummary[] = [];

    for (const ref of unique.values()) {
      const user = users.get(`${ref.source}:${ref.id}`);
      if (!user) {
        throw new BadRequestException(`Team member ${ref.id} was not found.`);
      }
      if (!user.isActive) {
        throw new BadRequestException(`${user.fullName} is inactive and cannot be assigned.`);
      }
      if (user.role.toLowerCase() !== 'developer') {
        throw new BadRequestException(`${user.fullName} is not a Developer.`);
      }
      resolved.push(user);
    }

    if (!resolved.length) {
      throw new BadRequestException('At least one developer team member is required.');
    }

    return resolved;
  }

  private async loadActiveUsers(): Promise<ProjectUserSummary[]> {
    const users: ProjectUserSummary[] = [];

    if (await tableExists(this.databaseService, 'pcmazing_admin_users')) {
      const adminUsers = await this.databaseService.query<{
        id: number;
        username: string;
        full_name: string;
        email: string | null;
        role: string;
        is_active: boolean;
      }>(
        `SELECT id, username, full_name, email, role, is_active
         FROM pcmazing_admin_users
         WHERE is_active = TRUE
         ORDER BY full_name ASC, username ASC`,
      );

      for (const row of adminUsers.rows) {
        users.push({
          id: row.id,
          source: 'pcmazing_admin_users',
          username: row.username,
          fullName: row.full_name,
          role: row.role,
          email: row.email,
          isActive: row.is_active,
        });
      }
    }

    if (await tableExists(this.databaseService, 'tblusers')) {
      const tblUsers = await this.databaseService.query<{
        id: number;
        username: string;
        fullname: string | null;
        email: string | null;
        rolename: string | null;
        status: number;
      }>(
        `${buildTblusersSelectSql()}
         WHERE COALESCE(NULLIF(to_jsonb(u)->>'status', '')::int, 1) = 1
         ORDER BY fullname ASC NULLS LAST, u.username ASC`,
      );

      for (const row of tblUsers.rows) {
        users.push({
          id: row.id,
          source: 'tblusers',
          username: row.username,
          fullName: (row.fullname || row.username).trim(),
          role: row.rolename || 'staff',
          email: row.email,
          isActive: row.status === 1,
        });
      }
    }

    return users;
  }

  private async resolveUsers(refs: ProjectUserRefDto[]): Promise<Map<string, ProjectUserSummary>> {
    const map = new Map<string, ProjectUserSummary>();
    if (!refs.length) {
      return map;
    }

    const bySource = new Map<UserSource, number[]>();
    for (const ref of refs) {
      const list = bySource.get(ref.source) ?? [];
      list.push(ref.id);
      bySource.set(ref.source, list);
    }

    const all = await this.loadActiveUsers();
    const inactiveAlso = await this.loadUsersByIds(bySource);

    for (const user of [...all, ...inactiveAlso]) {
      map.set(`${user.source}:${user.id}`, user);
    }

    return map;
  }

  private async loadUsersByIds(bySource: Map<UserSource, number[]>): Promise<ProjectUserSummary[]> {
    const users: ProjectUserSummary[] = [];

    const adminIds = [...new Set(bySource.get('pcmazing_admin_users') ?? [])];
    if (adminIds.length && (await tableExists(this.databaseService, 'pcmazing_admin_users'))) {
      const result = await this.databaseService.query<{
        id: number;
        username: string;
        full_name: string;
        email: string | null;
        role: string;
        is_active: boolean;
      }>(
        `SELECT id, username, full_name, email, role, is_active
         FROM pcmazing_admin_users
         WHERE id = ANY($1::bigint[])`,
        [adminIds],
      );
      for (const row of result.rows) {
        users.push({
          id: row.id,
          source: 'pcmazing_admin_users',
          username: row.username,
          fullName: row.full_name,
          role: row.role,
          email: row.email,
          isActive: row.is_active,
        });
      }
    }

    const tblIds = [...new Set(bySource.get('tblusers') ?? [])];
    if (tblIds.length && (await tableExists(this.databaseService, 'tblusers'))) {
      const result = await this.databaseService.query<{
        id: number;
        username: string;
        fullname: string | null;
        email: string | null;
        rolename: string | null;
        status: number;
      }>(
        `${buildTblusersSelectSql()}
         WHERE u.id = ANY($1::bigint[])`,
        [tblIds],
      );
      for (const row of result.rows) {
        users.push({
          id: row.id,
          source: 'tblusers',
          username: row.username,
          fullName: (row.fullname || row.username).trim(),
          role: row.rolename || 'staff',
          email: row.email,
          isActive: row.status === 1,
        });
      }
    }

    return users;
  }
}
