import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';
import { buildTblusersSelectSql } from '../users/tblusers.util';
import { isDeveloperOrPm, isSuperAdmin } from '../rbac/admin-roles.util';
import { CreateProjectDto, ProjectUserRefDto } from './dto/create-project.dto';
import { ProspectContractDto } from '../marketing/dto/prospect-contract.dto';
import { assertDealContractReadyForSigning } from '../marketing/deal-contract-validation.util';
import {
  CreateProjectTaskDto,
  MoveProjectEpicDto,
  MoveProjectTaskDto,
  PROJECT_BOARD_STATUSES,
  PROJECT_TASK_STATUSES,
  SetCurrentPhaseDto,
  UpdateProjectTaskDto,
} from './dto/project-task.dto';
import { deduplicateProjectUserRefs } from './project-assignments.util';
import {
  computeProjectPaymentStatus,
  remainingForSchedule,
  roundMoney,
  type PaymentScheduleSettlementItem,
  type ProjectPaymentStatus,
} from './project-payment.util';
import {
  actorDisplayName,
  buildTaskActivityPhaseFilter,
  mapTaskActivityRow,
  ProjectTaskActivityItem,
  ProjectTaskActivityType,
  serializeTaskActivityMeta,
} from './project-task-activity.util';
import { resolveSelectedPhaseId, toPhaseId } from './project-phase.util';
import { PoolClient } from 'pg';
import {
  deleteProjectTaskAttachmentFile,
  saveProjectTaskAttachmentFile,
} from './task-attachment.util';

type UserSource = 'pcmazing_admin_users' | 'tblusers';
type BoardStatus = (typeof PROJECT_BOARD_STATUSES)[number];
type TaskStatus = (typeof PROJECT_TASK_STATUSES)[number];
type SqlQueryable = {
  query: <T = unknown>(
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount?: number | null }>;
};

export interface ProjectActor {
  userId: number;
  source: UserSource;
  role?: string | null;
  fullName?: string | null;
  username?: string | null;
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
  paymentStatus: ProjectPaymentStatus;
  paymentTotal: number;
  settledTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPaymentScheduleItem {
  id: number;
  label: string;
  amount: number;
  description: string | null;
  dueDate: string | null;
  notes: string | null;
  connectedMilestoneId: string | null;
  status: 'pending' | 'paid' | 'overdue';
  settledAt: string | null;
  paymentMethod: string | null;
  referenceNumber: string | null;
  checkDate: string | null;
  amountPaid: number;
  remainingBalance: number;
  settlements: PaymentScheduleSettlementItem[];
}

export interface ProjectDetail extends ProjectListItem {
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  currency: string;
  contract: {
    id: number;
    projectName: string;
    projectType: string;
    signedAt: string | null;
    remarks: string | null;
    modules: Array<{
      id: number;
      name: string;
      description: string | null;
      features: string | null;
      processFlow: string | null;
    }>;
    milestones: Array<{
      id: number;
      title: string;
      description: string | null;
      dueDate: string | null;
      connectedModuleId: string | null;
    }>;
    paymentSchedule: ProjectPaymentScheduleItem[];
  } | null;
  teamMembers: ProjectUserSummary[];
}

export interface ProjectSettlePaymentResult {
  payment: ProjectPaymentScheduleItem;
  settlement: PaymentScheduleSettlementItem;
  remainingBalance: number;
}

export interface ProjectInvoiceData {
  projectId: number;
  projectName: string;
  projectType: string | null;
  clientName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  issuedAt: string;
  invoiceNumber: string | null;
  phaseNumber: number | null;
  phaseTitle: string | null;
  phaseDescription: string | null;
  phaseDueDate: string | null;
  milestones: Array<{
    id: number;
    title: string;
    description: string | null;
    dueDate: string | null;
  }>;
  payments: Array<{
    id: number;
    label: string;
    amount: number;
    amountPaid: number;
    remainingBalance: number;
    dueDate: string | null;
    status: string;
    connectedMilestoneId: string | null;
    connectedMilestoneTitle: string | null;
  }>;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
}

export interface ProjectReceiptData {
  projectId: number;
  projectName: string;
  clientName: string;
  company: string | null;
  currency: string;
  settlement: PaymentScheduleSettlementItem;
  paymentLabel: string;
  scheduleAmount: number;
  amountPaid: number;
  remainingBalance: number;
  phaseNumber: number | null;
  phaseName: string | null;
  phaseDescription: string | null;
  phaseDueDate: string | null;
}

export interface ProjectTaskItem {
  id: number;
  projectId: number;
  epicId: number | null;
  epicTitle: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
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

    if (!(await tableExists(this.databaseService, 'pcmazing_project_task_activity_log'))) {
      throw new ServiceUnavailableException(
        'Project task activity log is not available. Run migration 41.',
      );
    }

    await this.ensurePaymentSettlementsTable();

    this.schemaReady = true;
  }

  private async ensurePaymentSettlementsTable(): Promise<void> {
    if (!(await tableExists(this.databaseService, 'pcmazing_client_contract_payment_settlements'))) {
      await this.databaseService.query(`
        CREATE TABLE IF NOT EXISTS pcmazing_client_contract_payment_settlements (
          id BIGSERIAL PRIMARY KEY,
          payment_schedule_id BIGINT NOT NULL
            REFERENCES pcmazing_client_contract_payment_schedules(id) ON DELETE CASCADE,
          amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
          settled_on DATE NOT NULL,
          payment_method VARCHAR(100) NOT NULL,
          payment_code VARCHAR(100),
          check_date DATE,
          remaining_balance NUMERIC(14, 2) NOT NULL CHECK (remaining_balance >= 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await this.databaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_pcmazing_payment_settlements_schedule
          ON pcmazing_client_contract_payment_settlements(payment_schedule_id, settled_on DESC, id DESC)
      `);
    }

    // Backfill paid rows that have no ledger entries yet.
    await this.databaseService.query(`
      INSERT INTO pcmazing_client_contract_payment_settlements (
        payment_schedule_id,
        amount,
        settled_on,
        payment_method,
        payment_code,
        check_date,
        remaining_balance,
        created_at
      )
      SELECT
        ps.id,
        ps.amount,
        COALESCE(ps.settled_at::date, ps.due_date, CURRENT_DATE),
        COALESCE(NULLIF(TRIM(ps.payment_method), ''), 'Cash'),
        ps.payment_code,
        ps.check_date,
        0,
        COALESCE(ps.settled_at, NOW())
      FROM pcmazing_client_contract_payment_schedules ps
      WHERE LOWER(COALESCE(ps.status, '')) = 'paid'
        AND NOT EXISTS (
          SELECT 1
          FROM pcmazing_client_contract_payment_settlements s
          WHERE s.payment_schedule_id = ps.id
        )
    `);
  }

  private async ensurePaymentSettledAtColumn(): Promise<boolean> {
    const settledAtColumn = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'pcmazing_client_contract_payment_schedules'
         AND column_name = 'settled_at'`,
    );
    if (Number(settledAtColumn.rows[0]?.count ?? 0) === 0) {
      await this.databaseService.query(
        `ALTER TABLE pcmazing_client_contract_payment_schedules
         ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ`,
      );
    }

    const checkDateColumn = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'pcmazing_client_contract_payment_schedules'
         AND column_name = 'check_date'`,
    );
    if (Number(checkDateColumn.rows[0]?.count ?? 0) === 0) {
      await this.databaseService.query(
        `ALTER TABLE pcmazing_client_contract_payment_schedules
         ADD COLUMN IF NOT EXISTS check_date DATE`,
      );
    }
    return true;
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
      payment_total: string;
      settled_total: string;
      overdue_unpaid_count: string;
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
        COUNT(DISTINCT m.id)::text AS team_member_count,
        COALESCE(pay.payment_total, 0)::text AS payment_total,
        COALESCE(pay.settled_total, 0)::text AS settled_total,
        COALESCE(pay.overdue_unpaid_count, 0)::text AS overdue_unpaid_count,
        p.created_at::text,
        p.updated_at::text
       FROM pcmazing_projects p
       INNER JOIN pcmazing_client_prospects c ON c.id = p.prospect_id
       LEFT JOIN pcmazing_project_members m ON m.project_id = p.id
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(SUM(ps.amount), 0) AS payment_total,
           COALESCE((
             SELECT SUM(s.amount)
             FROM pcmazing_client_contract_payment_settlements s
             INNER JOIN pcmazing_client_contract_payment_schedules ps2
               ON ps2.id = s.payment_schedule_id
             WHERE ps2.contract_id = cc.id
           ), 0) AS settled_total,
           COUNT(*) FILTER (
             WHERE LOWER(COALESCE(ps.status, '')) <> 'paid'
               AND ps.due_date IS NOT NULL
               AND ps.due_date < CURRENT_DATE
           )::int AS overdue_unpaid_count
         FROM pcmazing_client_contracts cc
         LEFT JOIN pcmazing_client_contract_payment_schedules ps ON ps.contract_id = cc.id
         WHERE cc.prospect_id = p.prospect_id
         GROUP BY cc.id
         LIMIT 1
       ) pay ON TRUE
       ${scopeSql}
       GROUP BY
         p.id,
         c.client_name,
         c.company,
         pay.payment_total,
         pay.settled_total,
         pay.overdue_unpaid_count
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
      items: result.rows.map((row) => {
        const paymentTotal = roundMoney(Number(row.payment_total));
        const settledTotal = roundMoney(Number(row.settled_total));
        return {
          id: row.id,
          prospectId: row.prospect_id,
          name: row.name,
          projectType: row.project_type,
          status: row.status,
          clientName: row.client_name,
          company: row.company,
          projectManager:
            managers.get(`${row.project_manager_user_source}:${row.project_manager_user_id}`) ?? null,
          teamMemberCount: Number(row.team_member_count),
          paymentStatus: computeProjectPaymentStatus({
            totalAmount: paymentTotal,
            settledAmount: settledTotal,
            hasOverdueUnpaid: Number(row.overdue_unpaid_count) > 0,
          }),
          paymentTotal,
          settledTotal,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }),
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
      email: string | null;
      phone: string | null;
      address: string | null;
      notes: string | null;
      currency: string | null;
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
        c.email,
        c.phone,
        c.address,
        c.notes,
        c.currency,
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
    const contract = await this.loadProjectContract(row.prospect_id);
    const paymentTotal = roundMoney(
      (contract?.paymentSchedule ?? []).reduce((sum, item) => sum + item.amount, 0),
    );
    const settledTotal = roundMoney(
      (contract?.paymentSchedule ?? []).reduce((sum, item) => sum + item.amountPaid, 0),
    );
    const hasOverdueUnpaid = (contract?.paymentSchedule ?? []).some(
      (item) => item.status !== 'paid' && item.remainingBalance > 0 && item.status === 'overdue',
    );

    return {
      id: row.id,
      prospectId: row.prospect_id,
      name: row.name,
      projectType: row.project_type,
      status: row.status,
      clientName: row.client_name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      currency: (row.currency || 'PHP').trim().toUpperCase() || 'PHP',
      contract,
      projectManager: users.get(`${row.project_manager_user_source}:${row.project_manager_user_id}`) ?? null,
      teamMemberCount: teamMembers.length,
      teamMembers,
      paymentStatus: computeProjectPaymentStatus({
        totalAmount: paymentTotal,
        settledAmount: settledTotal,
        hasOverdueUnpaid,
      }),
      paymentTotal,
      settledTotal,
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

    const manager = await this.requireActiveUser(dto.projectManager);
    const teamMembers = await this.requireActiveTeamMembers(dto.teamMembers);

    const created = dto.prospectId
      ? await this.createProjectFromSignedProspect(dto, createdByUserId, manager, teamMembers)
      : await this.createProjectDirectly(dto, createdByUserId, manager, teamMembers);

    return this.getById(created);
  }

  async update(
    projectId: number,
    dto: CreateProjectDto,
    updatedByUserId: number,
  ): Promise<ProjectDetail> {
    await this.ensureReady();
    const existing = await this.getById(projectId);
    const clientName = dto.clientName?.trim();
    const contract = dto.contract;
    if (!clientName) {
      throw new BadRequestException('Client name is required.');
    }
    if (!contract) {
      throw new BadRequestException('Signed contract details are required.');
    }
    assertDealContractReadyForSigning(contract);

    const manager = await this.requireActiveUser(dto.projectManager);
    const teamMembers = await this.requireActiveTeamMembers(
      deduplicateProjectUserRefs(dto.teamMembers),
    );

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE pcmazing_client_prospects
         SET client_name = $1,
             company = $2,
             email = $3,
             phone = $4,
             address = $5,
             notes = $6,
             updated_at = NOW()
         WHERE id = $7`,
        [
          clientName,
          dto.company?.trim() || null,
          dto.email?.trim() || null,
          dto.phone?.trim() || null,
          dto.address?.trim() || null,
          dto.notes?.trim() || null,
          existing.prospectId,
        ],
      );

      await client.query(
        `UPDATE pcmazing_projects
         SET name = $1,
             project_type = $2,
             project_manager_user_id = $3,
             project_manager_user_source = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [
          dto.name?.trim() || contract.projectName.trim(),
          contract.projectType.trim() || null,
          manager.id,
          manager.source,
          projectId,
        ],
      );

      await client.query(`DELETE FROM pcmazing_project_members WHERE project_id = $1`, [projectId]);
      await this.insertProjectMembers(client, projectId, teamMembers);
      await this.saveSignedContract(
        client,
        existing.prospectId,
        contract,
        updatedByUserId,
        dto.notes,
        false,
      );
      await this.syncProjectHierarchyMetadata(client, projectId);
      await this.seedPhasesAndModuleEpics(client, projectId, existing.prospectId);
    });

    return this.getById(projectId);
  }

  async updateAssignments(
    projectId: number,
    dto: { projectManager: ProjectUserRefDto; teamMembers: ProjectUserRefDto[] },
  ): Promise<ProjectDetail> {
    await this.ensureReady();

    const manager = await this.requireActiveUser(dto.projectManager);
    const teamMembers = await this.requireActiveTeamMembers(
      deduplicateProjectUserRefs(dto.teamMembers),
    );

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE pcmazing_projects
         SET project_manager_user_id = $1,
             project_manager_user_source = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [manager.id, manager.source, projectId],
      );

      await client.query(`DELETE FROM pcmazing_project_members WHERE project_id = $1`, [projectId]);
      await this.insertProjectMembers(client, projectId, teamMembers);
    });

    return this.getById(projectId);
  }

  private async createProjectFromSignedProspect(
    dto: CreateProjectDto,
    createdByUserId: number,
    manager: ProjectUserSummary,
    teamMembers: ProjectUserSummary[],
  ): Promise<number> {
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

    const existing = await this.getByProspectId(dto.prospectId!);
    if (existing) {
      throw new ConflictException('A project already exists for this signed contract.');
    }

    const projectName = dto.name?.trim() || prospectRow.system_name?.trim() || prospectRow.client_name;
    const projectType = prospectRow.system_type?.trim() || null;

    return this.databaseService.withTransaction(async (client) => {
      const projectId = await this.insertProjectRecord(
        client,
        dto.prospectId!,
        projectName,
        projectType,
        manager,
        createdByUserId,
      );
      await this.insertProjectMembers(client, projectId, teamMembers);
      await this.seedPhasesAndModuleEpics(client, projectId, dto.prospectId!);
      return projectId;
    });
  }

  private async createProjectDirectly(
    dto: CreateProjectDto,
    createdByUserId: number,
    manager: ProjectUserSummary,
    teamMembers: ProjectUserSummary[],
  ): Promise<number> {
    const clientName = dto.clientName?.trim();
    if (!clientName) {
      throw new BadRequestException('Client name is required when adding a new project directly.');
    }

    const contract = dto.contract;
    if (!contract) {
      throw new BadRequestException('Signed contract details are required when adding a new project directly.');
    }

    assertDealContractReadyForSigning(contract);

    const projectName = dto.name?.trim() || contract.projectName.trim();
    const projectType = contract.projectType.trim() || null;

    return this.databaseService.withTransaction(async (client) => {
      const prospectResult = await client.query<{ id: number }>(
        `INSERT INTO pcmazing_client_prospects (
          client_name,
          company,
          email,
          phone,
          address,
          status,
          source,
          notes,
          created_by_user_id,
          client_type,
          currency
        ) VALUES ($1, $2, $3, $4, $5, 'contract_signed', 'manual', $6, $7, 'local', 'PHP')
        RETURNING id`,
        [
          clientName,
          dto.company?.trim() || null,
          dto.email?.trim() || null,
          dto.phone?.trim() || null,
          dto.address?.trim() || null,
          dto.notes?.trim() || null,
          createdByUserId,
        ],
      );

      const prospectId = prospectResult.rows[0]?.id;
      if (!prospectId) {
        throw new BadRequestException('Unable to create the linked client record for this project.');
      }

      await this.saveSignedContract(client, prospectId, contract, createdByUserId, dto.notes);

      const projectId = await this.insertProjectRecord(
        client,
        prospectId,
        projectName,
        projectType,
        manager,
        createdByUserId,
      );
      await this.insertProjectMembers(client, projectId, teamMembers);
      await this.seedPhasesAndModuleEpics(client, projectId, prospectId);
      return projectId;
    });
  }

  private async insertProjectRecord(
    client: PoolClient,
    prospectId: number,
    projectName: string,
    projectType: string | null,
    manager: ProjectUserSummary,
    createdByUserId: number,
  ): Promise<number> {
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
        prospectId,
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

    return projectId;
  }

  private async insertProjectMembers(
    client: PoolClient,
    projectId: number,
    teamMembers: ProjectUserSummary[],
  ): Promise<void> {
    for (const member of teamMembers) {
      await client.query(
        `INSERT INTO pcmazing_project_members (project_id, user_id, user_source, member_role)
         VALUES ($1, $2, $3, 'developer')
         ON CONFLICT (project_id, user_id, user_source) DO NOTHING`,
        [projectId, member.id, member.source],
      );
    }
  }

  private async saveSignedContract(
    client: PoolClient,
    prospectId: number,
    contract: ProspectContractDto,
    userId: number,
    notes?: string,
    recordSignedResponse = true,
  ): Promise<number> {
    if (recordSignedResponse) {
      await client.query(
        `INSERT INTO pcmazing_client_responses (prospect_id, user_id, response_type, notes, outcome, remarks)
         VALUES ($1, $2, 'other', $3, 'Contract Signed', $4)`,
        [
          prospectId,
          userId,
          contract.remarks?.trim() || notes?.trim() || null,
          contract.remarks?.trim() || null,
        ],
      );
    }

    const contractResult = await client.query<{ id: number }>(
      `INSERT INTO pcmazing_client_contracts (
        prospect_id,
        system_name,
        system_type,
        signed_at,
        remarks,
        created_by_user_id,
        updated_by_user_id
      ) VALUES ($1, $2, $3, $4::date, $5, $6, $6)
      ON CONFLICT (prospect_id) DO UPDATE
      SET system_name = EXCLUDED.system_name,
          system_type = EXCLUDED.system_type,
          signed_at = EXCLUDED.signed_at,
          remarks = EXCLUDED.remarks,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = NOW()
      RETURNING id`,
      [
        prospectId,
        contract.projectName.trim(),
        contract.projectType.trim(),
        contract.signedAt ?? null,
        contract.remarks?.trim() || null,
        userId,
      ],
    );

    const contractId = contractResult.rows[0]?.id;
    if (!contractId) {
      throw new BadRequestException('Unable to save contract details.');
    }

    const existingModules = await client.query<{ id: number }>(
      `SELECT id FROM pcmazing_client_contract_modules
       WHERE contract_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [contractId],
    );

    for (const [index, module] of contract.modules.entries()) {
      const existingId = existingModules.rows[index]?.id;
      if (existingId) {
        await client.query(
          `UPDATE pcmazing_client_contract_modules
           SET sort_order = $1,
               module_name = $2,
               description = $3,
               features = $4,
               process_flow = $5,
               prospect_id = $6
           WHERE id = $7`,
          [
            index,
            module.name.trim(),
            module.description?.trim() || null,
            module.features?.trim() || null,
            module.processFlow?.trim() || null,
            prospectId,
            existingId,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO pcmazing_client_contract_modules (
            contract_id, prospect_id, sort_order, module_name, description, features, process_flow
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            contractId,
            prospectId,
            index,
            module.name.trim(),
            module.description?.trim() || null,
            module.features?.trim() || null,
            module.processFlow?.trim() || null,
          ],
        );
      }
    }
    const removedModuleIds = existingModules.rows.slice(contract.modules.length).map((row) => row.id);
    if (removedModuleIds.length) {
      await client.query(
        `DELETE FROM pcmazing_client_contract_modules WHERE id = ANY($1::bigint[])`,
        [removedModuleIds],
      );
    }

    const existingMilestones = await client.query<{ id: number }>(
      `SELECT id FROM pcmazing_client_contract_milestones
       WHERE contract_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [contractId],
    );
    const milestoneIds: number[] = [];
    for (const [index, milestone] of contract.milestones.entries()) {
      const connectedModuleSortOrders = this.normalizeLinkedSortOrders(milestone.connectedModuleId);
      const existingId = existingMilestones.rows[index]?.id;
      const milestoneResult = existingId
        ? await client.query<{ id: number }>(
            `UPDATE pcmazing_client_contract_milestones
             SET sort_order = $1,
                 title = $2,
                 description = $3,
                 due_date = $4::date,
                 connected_module_sort_order = $5,
                 prospect_id = $6
             WHERE id = $7
             RETURNING id`,
            [
              index,
              milestone.title.trim(),
              milestone.description?.trim() || null,
              milestone.dueDate ?? null,
              connectedModuleSortOrders,
              prospectId,
              existingId,
            ],
          )
        : await client.query<{ id: number }>(
            `INSERT INTO pcmazing_client_contract_milestones (
              contract_id, prospect_id, sort_order, title, description, due_date, connected_module_sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6::date, $7)
            RETURNING id`,
            [
              contractId,
              prospectId,
              index,
              milestone.title.trim(),
              milestone.description?.trim() || null,
              milestone.dueDate ?? null,
              connectedModuleSortOrders,
            ],
          );
      milestoneIds.push(milestoneResult.rows[0]?.id ?? 0);
    }
    const removedMilestoneIds = existingMilestones.rows
      .slice(contract.milestones.length)
      .map((row) => row.id);
    if (removedMilestoneIds.length) {
      await client.query(
        `DELETE FROM pcmazing_client_contract_milestones WHERE id = ANY($1::bigint[])`,
        [removedMilestoneIds],
      );
    }

    const existingPayments = await client.query<{ id: number }>(
      `SELECT id FROM pcmazing_client_contract_payment_schedules
       WHERE contract_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [contractId],
    );
    for (const [index, payment] of contract.paymentSchedule.entries()) {
      const connectedMilestoneSortOrder = this.parseLinkedSortOrder(payment.connectedMilestoneId);
      const milestoneId =
        connectedMilestoneSortOrder !== null ? milestoneIds[connectedMilestoneSortOrder] ?? null : null;

      const existingId = existingPayments.rows[index]?.id;
      if (existingId) {
        await client.query(
          `UPDATE pcmazing_client_contract_payment_schedules
           SET sort_order = $1,
               label = $2,
               amount = $3,
               description = $4,
               due_date = $5::date,
               notes = $6,
               milestone_id = $7,
               prospect_id = $8
           WHERE id = $9`,
          [
            index,
            payment.label.trim(),
            payment.amount,
            payment.description?.trim() || null,
            payment.dueDate ?? null,
            payment.notes?.trim() || null,
            milestoneId,
            prospectId,
            existingId,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO pcmazing_client_contract_payment_schedules (
            contract_id, prospect_id, sort_order, label, amount, description, due_date, notes, milestone_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9)`,
          [
            contractId,
            prospectId,
            index,
            payment.label.trim(),
            payment.amount,
            payment.description?.trim() || null,
            payment.dueDate ?? null,
            payment.notes?.trim() || null,
            milestoneId,
          ],
        );
      }
    }
    const removedPaymentIds = existingPayments.rows
      .slice(contract.paymentSchedule.length)
      .map((row) => row.id);
    if (removedPaymentIds.length) {
      await client.query(
        `DELETE FROM pcmazing_client_contract_payment_schedules WHERE id = ANY($1::bigint[])`,
        [removedPaymentIds],
      );
    }

    return contractId;
  }

  private async syncProjectHierarchyMetadata(client: PoolClient, projectId: number): Promise<void> {
    await client.query(
      `UPDATE pcmazing_project_phases phase
       SET title = milestone.title,
           description = milestone.description,
           due_date = milestone.due_date,
           sort_order = milestone.sort_order,
           updated_at = NOW()
       FROM pcmazing_client_contract_milestones milestone
       WHERE phase.project_id = $1
         AND phase.contract_milestone_id = milestone.id`,
      [projectId],
    );
    await client.query(
      `UPDATE pcmazing_project_epics epic
       SET title = module.module_name,
           description = module.description,
           sort_order = module.sort_order,
           updated_at = NOW()
       FROM pcmazing_client_contract_modules module
       WHERE epic.project_id = $1
         AND epic.contract_module_id = module.id`,
      [projectId],
    );
  }

  private async loadProjectContract(prospectId: number): Promise<ProjectDetail['contract']> {
    await this.ensurePaymentSettledAtColumn();

    const contractResult = await this.databaseService.query<{
      id: number;
      system_name: string;
      system_type: string;
      signed_at: string | null;
      remarks: string | null;
    }>(
      `SELECT id, system_name, system_type, signed_at::text, remarks
       FROM pcmazing_client_contracts
       WHERE prospect_id = $1
       LIMIT 1`,
      [prospectId],
    );
    const contractRow = contractResult.rows[0];
    if (!contractRow) {
      return null;
    }

    const [modulesResult, milestonesResult, paymentsResult, settlementsResult] = await Promise.all([
      this.databaseService.query<{
        id: number;
        module_name: string;
        description: string | null;
        features: string | null;
        process_flow: string | null;
      }>(
        `SELECT id, module_name, description, features, process_flow
         FROM pcmazing_client_contract_modules
         WHERE contract_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [contractRow.id],
      ),
      this.databaseService.query<{
        id: number;
        title: string;
        description: string | null;
        due_date: string | null;
        connected_module_sort_order: string | number | null;
        sort_order: number;
      }>(
        `SELECT id, title, description, due_date::text, connected_module_sort_order, sort_order
         FROM pcmazing_client_contract_milestones
         WHERE contract_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [contractRow.id],
      ),
      this.databaseService.query<{
        id: number;
        label: string;
        amount: string;
        description: string | null;
        due_date: string | null;
        notes: string | null;
        milestone_id: number | null;
        status: string;
        settled_at: string | null;
        payment_method: string | null;
        payment_code: string | null;
        check_date: string | null;
      }>(
        `SELECT
          id,
          label,
          amount::text,
          description,
          due_date::text,
          notes,
          milestone_id,
          status,
          settled_at::text,
          payment_method,
          payment_code,
          check_date::text
         FROM pcmazing_client_contract_payment_schedules
         WHERE contract_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [contractRow.id],
      ),
      this.databaseService.query<{
        id: number;
        payment_schedule_id: number;
        amount: string;
        settled_on: string;
        payment_method: string;
        payment_code: string | null;
        check_date: string | null;
        remaining_balance: string;
        created_at: string;
      }>(
        `SELECT
          s.id,
          s.payment_schedule_id,
          s.amount::text,
          s.settled_on::text,
          s.payment_method,
          s.payment_code,
          s.check_date::text,
          s.remaining_balance::text,
          s.created_at::text
         FROM pcmazing_client_contract_payment_settlements s
         INNER JOIN pcmazing_client_contract_payment_schedules ps ON ps.id = s.payment_schedule_id
         WHERE ps.contract_id = $1
         ORDER BY s.settled_on DESC, s.id DESC`,
        [contractRow.id],
      ),
    ]);

    const milestoneSortOrderById = new Map(
      milestonesResult.rows.map((row) => [row.id, row.sort_order]),
    );
    const settlementsBySchedule = new Map<number, PaymentScheduleSettlementItem[]>();
    for (const row of settlementsResult.rows) {
      const scheduleId = Number(row.payment_schedule_id);
      const list = settlementsBySchedule.get(scheduleId) ?? [];
      list.push({
        id: Number(row.id),
        paymentScheduleId: scheduleId,
        amount: Number(row.amount),
        settledOn: row.settled_on,
        paymentMethod: row.payment_method,
        referenceNumber: row.payment_code,
        checkDate: row.check_date,
        remainingBalance: Number(row.remaining_balance),
        createdAt: row.created_at,
      });
      settlementsBySchedule.set(scheduleId, list);
    }

    return {
      id: contractRow.id,
      projectName: contractRow.system_name,
      projectType: contractRow.system_type,
      signedAt: contractRow.signed_at,
      remarks: contractRow.remarks,
      modules: modulesResult.rows.map((row) => ({
        id: row.id,
        name: row.module_name,
        description: row.description,
        features: row.features,
        processFlow: row.process_flow,
      })),
      milestones: milestonesResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        dueDate: row.due_date,
        connectedModuleId:
          row.connected_module_sort_order === null
          || row.connected_module_sort_order === undefined
            ? null
            : String(row.connected_module_sort_order),
      })),
      paymentSchedule: paymentsResult.rows.map((row) => {
        const settlements = settlementsBySchedule.get(Number(row.id)) ?? [];
        const amount = Number(row.amount);
        const amountPaid = roundMoney(settlements.reduce((sum, item) => sum + item.amount, 0));
        const remaining = remainingForSchedule(amount, amountPaid);
        return {
          id: Number(row.id),
          label: row.label,
          amount,
          description: row.description,
          dueDate: row.due_date,
          notes: row.notes,
          connectedMilestoneId:
            row.milestone_id != null && milestoneSortOrderById.has(row.milestone_id)
              ? String(milestoneSortOrderById.get(row.milestone_id))
              : null,
          status: this.normalizePaymentStatus(
            amountPaid >= amount - 0.001 ? 'paid' : row.status,
            row.due_date,
          ),
          settledAt: row.settled_at,
          paymentMethod: row.payment_method,
          referenceNumber: row.payment_code,
          checkDate: row.check_date,
          amountPaid,
          remainingBalance: remaining,
          settlements,
        };
      }),
    };
  }

  private normalizePaymentStatus(
    statusRaw: string | null | undefined,
    dueDate: string | null,
  ): 'pending' | 'paid' | 'overdue' {
    const status = (statusRaw || 'pending').trim().toLowerCase();
    if (status === 'paid') {
      return 'paid';
    }
    if (status === 'overdue') {
      return 'overdue';
    }
    if (dueDate) {
      const due = new Date(`${dueDate}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!Number.isNaN(due.getTime()) && due.getTime() < today.getTime()) {
        return 'overdue';
      }
    }
    return 'pending';
  }

  async settleProjectPayment(
    projectId: number,
    paymentId: number,
    dto: {
      date: string;
      paymentMethod: string;
      settlementType: 'partial' | 'full';
      amount?: number;
      referenceNumber?: string;
      checkNumber?: string;
      checkDate?: string;
    },
  ): Promise<ProjectSettlePaymentResult> {
    await this.ensureReady();
    await this.ensurePaymentSettledAtColumn();

    const settledDate = String(dto.date || '').trim();
    const paymentMethod = String(dto.paymentMethod || '').trim();
    const settlementType = String(dto.settlementType || '').trim().toLowerCase() as
      | 'partial'
      | 'full';
    const referenceNumber = String(dto.referenceNumber || '').trim();
    const checkNumber = String(dto.checkNumber || '').trim();
    const checkDate = String(dto.checkDate || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(settledDate)) {
      throw new BadRequestException('Settlement date is required (YYYY-MM-DD).');
    }
    if (!paymentMethod) {
      throw new BadRequestException('Payment method is required.');
    }
    if (settlementType !== 'partial' && settlementType !== 'full') {
      throw new BadRequestException('Settlement type must be partial or full.');
    }

    let paymentCode: string | null = null;
    let storedCheckDate: string | null = null;

    if (paymentMethod === 'Cash') {
      paymentCode = null;
      storedCheckDate = null;
    } else if (paymentMethod === 'Check') {
      if (!checkNumber) {
        throw new BadRequestException('Check number is required.');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(checkDate)) {
        throw new BadRequestException('Check date is required (YYYY-MM-DD).');
      }
      paymentCode = checkNumber;
      storedCheckDate = checkDate;
    } else if (['Bank Transfer', 'Wise', 'PayPal'].includes(paymentMethod)) {
      if (!referenceNumber) {
        throw new BadRequestException('Reference number is required.');
      }
      paymentCode = referenceNumber;
      storedCheckDate = null;
    } else {
      throw new BadRequestException('Invalid payment method.');
    }

    const project = await this.getById(projectId);
    if (!project.contract) {
      throw new BadRequestException('This project has no signed contract payment schedule.');
    }

    const ownership = await this.databaseService.query<{
      id: number;
      label: string;
      amount: string;
      description: string | null;
      due_date: string | null;
      notes: string | null;
      milestone_id: number | null;
      status: string;
      settled_at: string | null;
      payment_method: string | null;
      payment_code: string | null;
      check_date: string | null;
      sort_order: number;
    }>(
      `SELECT
        ps.id,
        ps.label,
        ps.amount::text,
        ps.description,
        ps.due_date::text,
        ps.notes,
        ps.milestone_id,
        ps.status,
        ps.settled_at::text,
        ps.payment_method,
        ps.payment_code,
        ps.check_date::text,
        ps.sort_order
       FROM pcmazing_client_contract_payment_schedules ps
       INNER JOIN pcmazing_client_contracts c ON c.id = ps.contract_id
       INNER JOIN pcmazing_projects p ON p.prospect_id = c.prospect_id
       WHERE p.id = $1
         AND ps.id = $2
       LIMIT 1`,
      [projectId, paymentId],
    );

    const existing = ownership.rows[0];
    if (!existing) {
      throw new NotFoundException('Payment schedule item not found for this project.');
    }

    const scheduleAmount = roundMoney(Number(existing.amount));
    const priorSettlements = await this.databaseService.query<{
      amount: string;
    }>(
      `SELECT amount::text
       FROM pcmazing_client_contract_payment_settlements
       WHERE payment_schedule_id = $1`,
      [paymentId],
    );
    const amountPaidBefore = roundMoney(
      priorSettlements.rows.reduce((sum, row) => sum + Number(row.amount), 0),
    );
    const remainingBefore = remainingForSchedule(scheduleAmount, amountPaidBefore);

    if (remainingBefore <= 0 || (existing.status || '').toLowerCase() === 'paid') {
      throw new BadRequestException('This payment is already fully paid.');
    }

    let settleAmount: number;
    if (settlementType === 'full') {
      settleAmount = remainingBefore;
    } else {
      settleAmount = roundMoney(Number(dto.amount));
      if (!Number.isFinite(settleAmount) || settleAmount <= 0) {
        throw new BadRequestException('Settlement amount must be greater than zero.');
      }
      if (settleAmount > remainingBefore) {
        throw new BadRequestException(
          `Settlement amount cannot exceed remaining balance (${remainingBefore}).`,
        );
      }
    }

    const remainingAfter = remainingForSchedule(
      scheduleAmount,
      roundMoney(amountPaidBefore + settleAmount),
    );
    const isFullyPaid = remainingAfter <= 0;

    const settlementInsert = await this.databaseService.query<{
      id: number;
      payment_schedule_id: number;
      amount: string;
      settled_on: string;
      payment_method: string;
      payment_code: string | null;
      check_date: string | null;
      remaining_balance: string;
      created_at: string;
    }>(
      `INSERT INTO pcmazing_client_contract_payment_settlements (
        payment_schedule_id,
        amount,
        settled_on,
        payment_method,
        payment_code,
        check_date,
        remaining_balance
      ) VALUES ($1, $2, $3::date, $4, $5, $6::date, $7)
       RETURNING
         id,
         payment_schedule_id,
         amount::text,
         settled_on::text,
         payment_method,
         payment_code,
         check_date::text,
         remaining_balance::text,
         created_at::text`,
      [
        paymentId,
        settleAmount,
        settledDate,
        paymentMethod,
        paymentCode,
        storedCheckDate,
        remainingAfter,
      ],
    );

    const settlementRow = settlementInsert.rows[0];
    if (!settlementRow) {
      throw new ServiceUnavailableException('Unable to record payment settlement.');
    }

    let scheduleRow = existing;
    if (isFullyPaid) {
      const updated = await this.databaseService.query<{
        id: number;
        label: string;
        amount: string;
        description: string | null;
        due_date: string | null;
        notes: string | null;
        milestone_id: number | null;
        status: string;
        settled_at: string | null;
        payment_method: string | null;
        payment_code: string | null;
        check_date: string | null;
        sort_order: number;
      }>(
        `UPDATE pcmazing_client_contract_payment_schedules
         SET status = 'paid',
             settled_at = ($1::date + TIME '12:00:00') AT TIME ZONE 'UTC',
             payment_method = $2,
             payment_code = $3,
             check_date = $4::date
         WHERE id = $5
         RETURNING
           id,
           label,
           amount::text,
           description,
           due_date::text,
           notes,
           milestone_id,
           status,
           settled_at::text,
           payment_method,
           payment_code,
           check_date::text,
           sort_order`,
        [settledDate, paymentMethod, paymentCode, storedCheckDate, paymentId],
      );
      scheduleRow = updated.rows[0] ?? existing;
    }

    const linkedFromContract = project.contract.paymentSchedule.find(
      (item) => Number(item.id) === Number(scheduleRow.id),
    );
    const settlementsFromContract = linkedFromContract?.settlements ?? [];
    const newSettlement: PaymentScheduleSettlementItem = {
      id: Number(settlementRow.id),
      paymentScheduleId: Number(settlementRow.payment_schedule_id),
      amount: Number(settlementRow.amount),
      settledOn: settlementRow.settled_on,
      paymentMethod: settlementRow.payment_method,
      referenceNumber: settlementRow.payment_code,
      checkDate: settlementRow.check_date,
      remainingBalance: Number(settlementRow.remaining_balance),
      createdAt: settlementRow.created_at,
    };
    const settlements = [newSettlement, ...settlementsFromContract.filter((s) => s.id !== newSettlement.id)];
    const amountPaid = roundMoney(amountPaidBefore + settleAmount);
    const remainingBalance = remainingAfter;

    const payment: ProjectPaymentScheduleItem = {
      id: Number(scheduleRow.id),
      label: scheduleRow.label,
      amount: scheduleAmount,
      description: scheduleRow.description,
      dueDate: scheduleRow.due_date,
      notes: scheduleRow.notes,
      connectedMilestoneId:
        linkedFromContract?.connectedMilestoneId ??
        (scheduleRow.milestone_id != null ? String(scheduleRow.sort_order) : null),
      status: this.normalizePaymentStatus(
        isFullyPaid ? 'paid' : scheduleRow.status,
        scheduleRow.due_date,
      ),
      settledAt: scheduleRow.settled_at,
      paymentMethod: scheduleRow.payment_method,
      referenceNumber: scheduleRow.payment_code,
      checkDate: scheduleRow.check_date,
      amountPaid,
      remainingBalance,
      settlements,
    };

    return {
      payment,
      settlement: newSettlement,
      remainingBalance,
    };
  }

  async getInvoice(projectId: number, milestoneId?: number): Promise<ProjectInvoiceData> {
    const project = await this.getById(projectId);
    if (!project.contract) {
      throw new BadRequestException('This project has no signed contract to invoice.');
    }

    const milestones = project.contract.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      dueDate: m.dueDate,
    }));

    const milestoneTitleByConnectedId = new Map(
      project.contract.milestones.map((m, index) => [String(index), m.title]),
    );

    const payments = project.contract.paymentSchedule.map((item) => ({
      id: item.id,
      label: item.label,
      amount: item.amount,
      amountPaid: item.amountPaid,
      remainingBalance: item.remainingBalance,
      dueDate: item.dueDate,
      status: item.status,
      connectedMilestoneId: item.connectedMilestoneId,
      connectedMilestoneTitle: item.connectedMilestoneId
        ? milestoneTitleByConnectedId.get(String(item.connectedMilestoneId)) ?? null
        : null,
    }));

    const base: ProjectInvoiceData = {
      projectId: project.id,
      projectName: project.name,
      projectType: project.projectType,
      clientName: project.clientName,
      company: project.company,
      email: project.email,
      phone: project.phone,
      address: project.address,
      currency: project.currency,
      issuedAt: new Date().toISOString(),
      invoiceNumber: null,
      phaseNumber: null,
      phaseTitle: null,
      phaseDescription: null,
      phaseDueDate: null,
      milestones,
      payments,
      totalAmount: roundMoney(payments.reduce((sum, p) => sum + p.amount, 0)),
      totalPaid: roundMoney(payments.reduce((sum, p) => sum + p.amountPaid, 0)),
      totalDue: 0,
    };
    base.totalDue = remainingForSchedule(base.totalAmount, base.totalPaid);

    if (milestoneId == null || !Number.isInteger(milestoneId) || milestoneId <= 0) {
      return base;
    }

    const milestoneIndex = milestones.findIndex((m) => m.id === milestoneId);
    if (milestoneIndex < 0) {
      throw new NotFoundException('Milestone not found on this project.');
    }

    const milestone = milestones[milestoneIndex];
    let phasePayments = payments.filter((payment) => {
      const linked = Number(String(payment.connectedMilestoneId ?? '').trim());
      return Number.isInteger(linked) && linked === milestoneIndex;
    });
    if (!phasePayments.length) {
      const fallback = payments[milestoneIndex];
      if (fallback) {
        const fallbackLinked = Number(String(fallback.connectedMilestoneId ?? '').trim());
        const fallbackUnlinked =
          !Number.isInteger(fallbackLinked) ||
          fallbackLinked < 0 ||
          fallbackLinked >= milestones.length;
        if (fallbackUnlinked) {
          phasePayments = [fallback];
        }
      }
    }

    const totalAmount = roundMoney(phasePayments.reduce((sum, p) => sum + p.amount, 0));
    const totalPaid = roundMoney(phasePayments.reduce((sum, p) => sum + p.amountPaid, 0));
    const totalDue = remainingForSchedule(totalAmount, totalPaid);
    const phaseTitle = milestone.title?.trim() || `Phase ${milestoneIndex + 1}`;

    return {
      ...base,
      invoiceNumber: String(milestoneIndex + 1).padStart(3, '0'),
      phaseNumber: milestoneIndex + 1,
      phaseTitle,
      phaseDescription: milestone.description,
      phaseDueDate: milestone.dueDate ?? phasePayments[0]?.dueDate ?? null,
      milestones: [milestone],
      payments: phasePayments,
      totalAmount,
      totalPaid,
      totalDue,
    };
  }

  async getReceipt(projectId: number, settlementId: number): Promise<ProjectReceiptData> {
    await this.ensureReady();

    const result = await this.databaseService.query<{
      settlement_id: number;
      payment_schedule_id: number;
      amount: string;
      settled_on: string;
      payment_method: string;
      payment_code: string | null;
      check_date: string | null;
      remaining_balance: string;
      created_at: string;
      payment_label: string;
      schedule_amount: string;
      project_id: number;
      project_name: string;
      client_name: string;
      company: string | null;
      currency: string | null;
      milestone_title: string | null;
      milestone_description: string | null;
      milestone_due_date: string | null;
      milestone_sort_order: number | null;
    }>(
      `SELECT
        s.id AS settlement_id,
        s.payment_schedule_id,
        s.amount::text,
        s.settled_on::text,
        s.payment_method,
        s.payment_code,
        s.check_date::text,
        s.remaining_balance::text,
        s.created_at::text,
        ps.label AS payment_label,
        ps.amount::text AS schedule_amount,
        p.id AS project_id,
        p.name AS project_name,
        c.client_name,
        c.company,
        c.currency,
        m.title AS milestone_title,
        m.description AS milestone_description,
        m.due_date::text AS milestone_due_date,
        m.sort_order AS milestone_sort_order
       FROM pcmazing_client_contract_payment_settlements s
       INNER JOIN pcmazing_client_contract_payment_schedules ps ON ps.id = s.payment_schedule_id
       INNER JOIN pcmazing_client_contracts cc ON cc.id = ps.contract_id
       INNER JOIN pcmazing_projects p ON p.prospect_id = cc.prospect_id
       INNER JOIN pcmazing_client_prospects c ON c.id = p.prospect_id
       LEFT JOIN pcmazing_client_contract_milestones m ON m.id = ps.milestone_id
       WHERE p.id = $1
         AND s.id = $2
       LIMIT 1`,
      [projectId, settlementId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Receipt not found for this project.');
    }

    const scheduleAmount = roundMoney(Number(row.schedule_amount));
    const settlementAmount = roundMoney(Number(row.amount));
    const remainingBalance = roundMoney(Number(row.remaining_balance));
    const amountPaid = remainingForSchedule(scheduleAmount, remainingBalance);

    const settlement: PaymentScheduleSettlementItem = {
      id: Number(row.settlement_id),
      paymentScheduleId: Number(row.payment_schedule_id),
      amount: settlementAmount,
      settledOn: row.settled_on,
      paymentMethod: row.payment_method,
      referenceNumber: row.payment_code,
      checkDate: row.check_date,
      remainingBalance,
      createdAt: row.created_at,
    };

    return {
      projectId: Number(row.project_id),
      projectName: row.project_name,
      clientName: row.client_name,
      company: row.company,
      currency: (row.currency || 'PHP').trim().toUpperCase() || 'PHP',
      settlement,
      paymentLabel: row.payment_label,
      scheduleAmount,
      amountPaid,
      remainingBalance,
      phaseNumber:
        row.milestone_sort_order != null ? Number(row.milestone_sort_order) + 1 : null,
      phaseName: row.milestone_title?.trim() || row.payment_label,
      phaseDescription: row.milestone_description,
      phaseDueDate: row.milestone_due_date,
    };
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
      current_phase_id: string | number | null;
    }>(`SELECT current_phase_id FROM pcmazing_projects WHERE id = $1`, [projectId]);

    let currentPhaseId = toPhaseId(currentResult.rows[0]?.current_phase_id);
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

    // BIGSERIAL ids arrive as strings from pg; coerce before matching the query param.
    const selectedPhaseId = resolveSelectedPhaseId(phases, currentPhaseId, phaseIdRaw);

    const epics = selectedPhaseId
      ? await this.listEpicsForPhase(projectId, selectedPhaseId)
      : [];

    const tasks = selectedPhaseId
      ? await this.listTasksForPhase(projectId, selectedPhaseId)
      : [];

    return {
      columns: [
        { key: 'epics', label: 'Epics' },
        { key: 'backlog', label: 'Backlog' },
        { key: 'todo', label: 'To Do' },
        { key: 'in_progress', label: 'In Progress' },
        { key: 'in_review', label: 'In Review' },
        { key: 'testing', label: 'Testing' },
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

    await this.databaseService.withTransaction(async (client) => {
      if (dto.sortOrder < epic.sortOrder) {
        await client.query(
          `UPDATE pcmazing_project_epics
           SET sort_order = sort_order + 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND phase_id = $2
             AND sort_order >= $3
             AND sort_order < $4
             AND id <> $5`,
          [projectId, epic.phaseId, dto.sortOrder, epic.sortOrder, epicId],
        );
      } else if (dto.sortOrder > epic.sortOrder) {
        await client.query(
          `UPDATE pcmazing_project_epics
           SET sort_order = sort_order - 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND phase_id = $2
             AND sort_order <= $3
             AND sort_order > $4
             AND id <> $5`,
          [projectId, epic.phaseId, dto.sortOrder, epic.sortOrder, epicId],
        );
      }

      await client.query(
        `UPDATE pcmazing_project_epics
         SET sort_order = $1,
             updated_at = NOW()
         WHERE id = $2 AND project_id = $3`,
        [dto.sortOrder, epicId, projectId],
      );
    });

    return this.getEpicById(projectId, epicId);
  }

  async createTask(
    projectId: number,
    dto: CreateProjectTaskDto,
    actor?: ProjectActor | null,
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
       FROM pcmazing_project_tasks task
       WHERE task.project_id = $1
         AND task.status = $2
         AND task.epic_id IN (
           SELECT epic.id
           FROM pcmazing_project_epics epic
           WHERE epic.phase_id = (
             SELECT selected.phase_id
             FROM pcmazing_project_epics selected
             WHERE selected.id = $3 AND selected.project_id = $1
           )
         )`,
      [projectId, status, dto.epicId],
    );
    const sortOrder = Number(maxOrder.rows[0]?.max ?? -1) + 1;
    const createdByUserId = actor?.userId ?? null;
    const activityContext = await this.resolveTaskActivityContext(projectId, {
      epicId: dto.epicId,
      title: dto.title.trim(),
      status,
    });

    let taskId: number | undefined;
    try {
      taskId = await this.databaseService.withTransaction(async (client) => {
        const insert = await client.query<{ id: number }>(
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

        const id = insert.rows[0]?.id;
        if (!id) {
          throw new BadRequestException('Unable to create task.');
        }

        await client.query(
          `UPDATE pcmazing_projects SET current_epic_id = $1, updated_at = NOW() WHERE id = $2`,
          [dto.epicId, projectId],
        );

        await this.insertTaskActivity(client, {
          projectId,
          phaseId: activityContext.phaseId,
          taskId: id,
          taskTitle: dto.title.trim(),
          epicId: dto.epicId,
          epicTitle: activityContext.epicTitle,
          actionType: 'created',
          actor: actor ?? null,
          fromStatus: null,
          toStatus: status,
          details: null,
          meta: { priority },
        });

        return id;
      });
    } catch (error: unknown) {
      const databaseError = error as { code?: string; constraint?: string };
      if (
        databaseError.code === '23514'
        && databaseError.constraint === 'pcmazing_project_tasks_status_check'
      ) {
        throw new ServiceUnavailableException(
          'The Kanban database statuses are outdated. Apply migration 41 before using Backlog.',
        );
      }
      throw error;
    }

    if (!taskId) {
      throw new BadRequestException('Unable to create task.');
    }

    await this.syncEpicAfterTaskChange(projectId, dto.epicId);
    return this.getTaskById(projectId, taskId);
  }

  async updateTask(
    projectId: number,
    taskId: number,
    dto: UpdateProjectTaskDto,
    actor?: ProjectActor | null,
  ): Promise<ProjectTaskItem> {
    await this.ensureReady();
    const existing = await this.getTaskById(projectId, taskId);

    const updates: string[] = [];
    const params: unknown[] = [];
    const changedFields: string[] = [];

    if (dto.title !== undefined) {
      params.push(dto.title.trim());
      updates.push(`title = $${params.length}`);
      changedFields.push('title');
    }
    if (dto.description !== undefined) {
      params.push(dto.description?.trim() || null);
      updates.push(`description = $${params.length}`);
      changedFields.push('description');
    }
    if (dto.status !== undefined) {
      params.push(dto.status);
      updates.push(`status = $${params.length}`);
      changedFields.push('status');
    }
    if (dto.priority !== undefined) {
      params.push(dto.priority);
      updates.push(`priority = $${params.length}`);
      changedFields.push('priority');
    }
    if (dto.epicId !== undefined) {
      await this.assertEpicBelongsToProject(projectId, dto.epicId);
      params.push(dto.epicId);
      updates.push(`epic_id = $${params.length}`);
      changedFields.push('epicId');
    }
    if (dto.sortOrder !== undefined) {
      params.push(dto.sortOrder);
      updates.push(`sort_order = $${params.length}`);
      changedFields.push('sortOrder');
    }
    if (dto.dueDate !== undefined) {
      params.push(dto.dueDate || null);
      updates.push(`due_date = $${params.length}::date`);
      changedFields.push('dueDate');
    }
    if (dto.assignee !== undefined) {
      changedFields.push('assignee');
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

    const activityContext = await this.resolveTaskActivityContext(projectId, existing);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE pcmazing_project_tasks
         SET ${updates.join(', ')}
         WHERE id = $${params.length - 1} AND project_id = $${params.length}`,
        params,
      );

      const nextTitle = dto.title !== undefined ? dto.title.trim() : existing.title;
      const nextStatus = dto.status ?? existing.status;
      const nextEpicId = dto.epicId ?? existing.epicId;
      let nextEpicTitle = existing.epicTitle;
      let nextPhaseId = activityContext.phaseId;
      if (dto.epicId !== undefined && dto.epicId !== existing.epicId) {
        const nextContext = await this.resolveTaskActivityContext(projectId, {
          epicId: dto.epicId,
          title: nextTitle,
          status: nextStatus,
        });
        nextEpicTitle = nextContext.epicTitle;
        nextPhaseId = nextContext.phaseId;
      }

      await this.insertTaskActivity(client, {
        projectId,
        phaseId: nextPhaseId,
        taskId,
        taskTitle: nextTitle,
        epicId: nextEpicId,
        epicTitle: nextEpicTitle,
        actionType: 'edited',
        actor: actor ?? null,
        fromStatus: existing.status,
        toStatus: nextStatus,
        details: null,
        meta: { changedFields },
      });
    });

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
    actor?: ProjectActor | null,
  ): Promise<ProjectTaskItem> {
    await this.ensureReady();
    const task = await this.getTaskById(projectId, taskId);
    const activityContext = await this.resolveTaskActivityContext(projectId, task);

    await this.databaseService.withTransaction(async (client) => {
      if (task.status !== dto.status) {
        await client.query(
          `UPDATE pcmazing_project_tasks
           SET sort_order = sort_order - 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND status = $2
             AND sort_order > $3
             AND epic_id IN (
               SELECT epic.id
               FROM pcmazing_project_epics epic
               WHERE epic.phase_id = (
                 SELECT selected.phase_id
                 FROM pcmazing_project_epics selected
                 WHERE selected.id = $4 AND selected.project_id = $1
               )
             )`,
          [projectId, task.status, task.sortOrder, task.epicId],
        );
        await client.query(
          `UPDATE pcmazing_project_tasks
           SET sort_order = sort_order + 1,
               updated_at = NOW()
           WHERE project_id = $1
             AND status = $2
             AND sort_order >= $3
             AND epic_id IN (
               SELECT epic.id
               FROM pcmazing_project_epics epic
               WHERE epic.phase_id = (
                 SELECT selected.phase_id
                 FROM pcmazing_project_epics selected
                 WHERE selected.id = $4 AND selected.project_id = $1
               )
             )`,
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
             AND epic_id IN (
               SELECT epic.id
               FROM pcmazing_project_epics epic
               WHERE epic.phase_id = (
                 SELECT selected.phase_id
                 FROM pcmazing_project_epics selected
                 WHERE selected.id = $6 AND selected.project_id = $1
               )
             )`,
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
             AND epic_id IN (
               SELECT epic.id
               FROM pcmazing_project_epics epic
               WHERE epic.phase_id = (
                 SELECT selected.phase_id
                 FROM pcmazing_project_epics selected
                 WHERE selected.id = $6 AND selected.project_id = $1
               )
             )`,
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

      if (task.status !== dto.status || task.sortOrder !== dto.sortOrder) {
        await this.insertTaskActivity(client, {
          projectId,
          phaseId: activityContext.phaseId,
          taskId,
          taskTitle: task.title,
          epicId: task.epicId,
          epicTitle: activityContext.epicTitle,
          actionType: 'moved',
          actor: actor ?? null,
          fromStatus: task.status,
          toStatus: dto.status,
          details: null,
          meta: {
            fromSortOrder: task.sortOrder,
            toSortOrder: dto.sortOrder,
          },
        });
      }
    });

    if (task.epicId) {
      await this.syncEpicAfterTaskChange(projectId, task.epicId);
    }
    return this.getTaskById(projectId, taskId);
  }

  async deleteTask(
    projectId: number,
    taskId: number,
    actor?: ProjectActor | null,
  ): Promise<void> {
    await this.ensureReady();
    const task = await this.getTaskById(projectId, taskId);
    const activityContext = await this.resolveTaskActivityContext(projectId, task);

    await this.databaseService.withTransaction(async (client) => {
      await this.insertTaskActivity(client, {
        projectId,
        phaseId: activityContext.phaseId,
        taskId,
        taskTitle: task.title,
        epicId: task.epicId,
        epicTitle: activityContext.epicTitle,
        actionType: 'deleted',
        actor: actor ?? null,
        fromStatus: task.status,
        toStatus: null,
        details: null,
        meta: null,
      });

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
           AND epic_id IN (
             SELECT epic.id
             FROM pcmazing_project_epics epic
             WHERE epic.phase_id = (
               SELECT selected.phase_id
               FROM pcmazing_project_epics selected
               WHERE selected.id = $4 AND selected.project_id = $1
             )
           )`,
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
    actor?: ProjectActor | null,
  ): Promise<ProjectTaskCommentItem> {
    await this.ensureReady();
    const task = await this.getTaskById(projectId, taskId);
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('Comment body is required.');
    }

    const createdByUserId = actor?.userId;
    if (!createdByUserId || createdByUserId <= 0) {
      throw new BadRequestException('Authenticated user is required to add a comment.');
    }

    const activityContext = await this.resolveTaskActivityContext(projectId, task);

    const row = await this.databaseService.withTransaction(async (client) => {
      const insert = await client.query<{
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

      const inserted = insert.rows[0];
      if (!inserted) {
        throw new BadRequestException('Unable to add comment.');
      }

      await this.insertTaskActivity(client, {
        projectId,
        phaseId: activityContext.phaseId,
        taskId,
        taskTitle: task.title,
        epicId: task.epicId,
        epicTitle: activityContext.epicTitle,
        actionType: 'comment_added',
        actor: actor ?? null,
        fromStatus: task.status,
        toStatus: task.status,
        details: trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed,
        meta: { commentId: inserted.id },
      });

      return inserted;
    });

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
    actor?: ProjectActor | null,
  ): Promise<ProjectTaskAttachmentItem> {
    await this.ensureReady();
    const task = await this.getTaskById(projectId, taskId);

    const createdByUserId = actor?.userId;
    if (!createdByUserId || createdByUserId <= 0) {
      throw new BadRequestException('Authenticated user is required to upload an attachment.');
    }

    const saved = await saveProjectTaskAttachmentFile(taskId, file);
    const activityContext = await this.resolveTaskActivityContext(projectId, task);

    try {
      const row = await this.databaseService.withTransaction(async (client) => {
        const insert = await client.query<{
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

        const inserted = insert.rows[0];
        if (!inserted) {
          throw new BadRequestException('Unable to upload attachment.');
        }

        await this.insertTaskActivity(client, {
          projectId,
          phaseId: activityContext.phaseId,
          taskId,
          taskTitle: task.title,
          epicId: task.epicId,
          epicTitle: activityContext.epicTitle,
          actionType: 'attachment_added',
          actor: actor ?? null,
          fromStatus: task.status,
          toStatus: task.status,
          details: null,
          meta: {
            attachmentId: inserted.id,
            fileName: inserted.file_name,
            mimeType: inserted.mime_type,
            fileSize: Number(inserted.file_size),
            kind: inserted.kind,
          },
        });

        return inserted;
      });

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
    } catch (error) {
      await deleteProjectTaskAttachmentFile(saved.fileUrl);
      throw error;
    }
  }

  async deleteTaskAttachment(
    projectId: number,
    taskId: number,
    attachmentId: number,
    actor?: ProjectActor | null,
  ): Promise<void> {
    await this.ensureReady();
    const task = await this.getTaskById(projectId, taskId);

    const existing = await this.databaseService.query<{
      id: number;
      file_url: string;
      file_name: string;
      mime_type: string;
      kind: 'screenshot' | 'file';
    }>(
      `SELECT id, file_url, file_name, mime_type, kind
       FROM pcmazing_project_task_attachments
       WHERE id = $1 AND task_id = $2 AND project_id = $3`,
      [attachmentId, taskId, projectId],
    );
    if (!existing.rows[0]) {
      throw new NotFoundException('Attachment not found.');
    }

    const activityContext = await this.resolveTaskActivityContext(projectId, task);
    const attachment = existing.rows[0];

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `DELETE FROM pcmazing_project_task_attachments
         WHERE id = $1 AND task_id = $2 AND project_id = $3`,
        [attachmentId, taskId, projectId],
      );

      await this.insertTaskActivity(client, {
        projectId,
        phaseId: activityContext.phaseId,
        taskId,
        taskTitle: task.title,
        epicId: task.epicId,
        epicTitle: activityContext.epicTitle,
        actionType: 'attachment_deleted',
        actor: actor ?? null,
        fromStatus: task.status,
        toStatus: task.status,
        details: null,
        meta: {
          attachmentId: attachment.id,
          fileName: attachment.file_name,
          mimeType: attachment.mime_type,
          kind: attachment.kind,
        },
      });
    });

    await deleteProjectTaskAttachmentFile(attachment.file_url);
  }

  async listTaskActivity(
    projectId: number,
    phaseIdRaw?: number,
    pageRaw?: string,
    limitRaw?: string,
    taskIdRaw?: number,
  ): Promise<{
    items: ProjectTaskActivityItem[];
    meta: ReturnType<typeof buildPaginationMeta>;
    selectedPhaseId: number | null;
  }> {
    await this.ensureReady();
    await this.getById(projectId);

    const phases = await this.listPhases(projectId);
    const currentResult = await this.databaseService.query<{
      current_phase_id: string | number | null;
    }>(`SELECT current_phase_id FROM pcmazing_projects WHERE id = $1`, [projectId]);
    const currentPhaseId =
      toPhaseId(currentResult.rows[0]?.current_phase_id) ?? phases[0]?.id ?? null;

    const selectedPhaseId = resolveSelectedPhaseId(phases, currentPhaseId, phaseIdRaw);
    const taskId =
      taskIdRaw != null && Number.isFinite(taskIdRaw) && taskIdRaw > 0 ? taskIdRaw : undefined;

    // Task-scoped history does not need a phase; phase history does.
    if (!taskId && !selectedPhaseId) {
      const { page, limit } = buildPagination(pageRaw, limitRaw);
      return {
        items: [],
        meta: buildPaginationMeta(page, limit, 0),
        selectedPhaseId: null,
      };
    }

    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const { whereSql, params } = buildTaskActivityPhaseFilter(
      projectId,
      taskId ? null : selectedPhaseId,
      taskId,
    );

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM pcmazing_project_task_activity_log
       WHERE ${whereSql}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const result = await this.databaseService.query<{
      id: number;
      project_id: number;
      phase_id: number | null;
      task_id: number | null;
      task_title: string;
      epic_id: number | null;
      epic_title: string | null;
      action_type: ProjectTaskActivityType;
      actor_user_id: number | null;
      actor_user_source: UserSource | null;
      actor_name: string | null;
      from_status: string | null;
      to_status: string | null;
      details: string | null;
      meta_json: unknown;
      created_at: string;
    }>(
      `SELECT
        id,
        project_id,
        phase_id,
        task_id,
        task_title,
        epic_id,
        epic_title,
        action_type,
        actor_user_id,
        actor_user_source,
        actor_name,
        from_status,
        to_status,
        details,
        meta_json,
        created_at::text
       FROM pcmazing_project_task_activity_log
       WHERE ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      listParams,
    );

    return {
      items: result.rows.map((row) =>
        mapTaskActivityRow({
          id: row.id,
          projectId: row.project_id,
          phaseId: row.phase_id,
          taskId: row.task_id,
          taskTitle: row.task_title,
          epicId: row.epic_id,
          epicTitle: row.epic_title,
          actionType: row.action_type,
          actorUserId: row.actor_user_id,
          actorUserSource: row.actor_user_source,
          actorName: row.actor_name,
          fromStatus: row.from_status,
          toStatus: row.to_status,
          details: row.details,
          metaJson: row.meta_json,
          createdAt: row.created_at,
        }),
      ),
      meta: buildPaginationMeta(page, limit, total),
      selectedPhaseId,
    };
  }

  private async resolveTaskActivityContext(
    projectId: number,
    task: {
      epicId?: number | null;
      title?: string;
      status?: string;
      epicTitle?: string | null;
    },
  ): Promise<{ phaseId: number | null; epicTitle: string | null }> {
    if (!task.epicId) {
      return {
        phaseId: null,
        epicTitle: task.epicTitle ?? null,
      };
    }

    const result = await this.databaseService.query<{
      phase_id: number;
      title: string;
    }>(
      `SELECT phase_id, title
       FROM pcmazing_project_epics
       WHERE id = $1 AND project_id = $2`,
      [task.epicId, projectId],
    );

    return {
      phaseId: result.rows[0]?.phase_id ?? null,
      epicTitle: result.rows[0]?.title ?? task.epicTitle ?? null,
    };
  }

  private async insertTaskActivity(
    queryable: SqlQueryable,
    input: {
      projectId: number;
      phaseId: number | null;
      taskId: number | null;
      taskTitle: string;
      epicId: number | null;
      epicTitle: string | null;
      actionType: ProjectTaskActivityType;
      actor: ProjectActor | null;
      fromStatus: string | null;
      toStatus: string | null;
      details: string | null;
      meta: Record<string, unknown> | null;
    },
  ): Promise<void> {
    await queryable.query(
      `INSERT INTO pcmazing_project_task_activity_log (
        project_id, phase_id, task_id, task_title, epic_id, epic_title,
        action_type, actor_user_id, actor_user_source, actor_name,
        from_status, to_status, details, meta_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14::jsonb
      )`,
      [
        input.projectId,
        input.phaseId,
        input.taskId,
        input.taskTitle,
        input.epicId,
        input.epicTitle,
        input.actionType,
        input.actor?.userId ?? null,
        input.actor?.source ?? null,
        actorDisplayName(input.actor),
        input.fromStatus,
        input.toStatus,
        input.details,
        serializeTaskActivityMeta(input.meta),
      ],
    );
  }

  private async getTaskById(projectId: number, taskId: number): Promise<ProjectTaskItem> {
    const result = await this.databaseService.query<{
      id: number;
      project_id: number;
      epic_id: number | null;
      epic_title: string | null;
      title: string;
      description: string | null;
      status: TaskStatus;
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
      id: string | number;
      project_id: string | number;
      contract_milestone_id: string | number | null;
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
      id: Number(row.id),
      projectId: Number(row.project_id),
      contractMilestoneId:
        row.contract_milestone_id != null ? Number(row.contract_milestone_id) : null,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      sortOrder: Number(row.sort_order),
      status: row.status,
      phaseLabel: `Phase ${index + 1}`,
      epicCount: Number(row.epic_count),
    }));
  }

  private async listEpicsForPhase(projectId: number, phaseId: number): Promise<ProjectEpicItem[]> {
    const result = await this.databaseService.query<{
      id: string | number;
      project_id: string | number;
      phase_id: string | number;
      contract_module_id: string | number | null;
      title: string;
      description: string | null;
      sort_order: string | number;
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
           WHEN 'epics' THEN 1
           WHEN 'backlog' THEN 2
           WHEN 'todo' THEN 3
           WHEN 'in_progress' THEN 4
           WHEN 'in_review' THEN 5
           WHEN 'testing' THEN 6
           WHEN 'done' THEN 7
           ELSE 8
         END,
         e.sort_order ASC,
         e.id ASC`,
      [projectId, phaseId],
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      projectId: Number(row.project_id),
      phaseId: Number(row.phase_id),
      contractModuleId: row.contract_module_id != null ? Number(row.contract_module_id) : null,
      title: row.title,
      description: row.description,
      sortOrder: Number(row.sort_order),
      status: row.status,
      // Epic placement is a board invariant even before migration 40 normalizes legacy rows.
      boardStatus: 'epics' as const,
      taskCount: Number(row.task_count),
      doneTaskCount: Number(row.done_task_count),
      tasks: [],
    }));
  }

  private async listTasksForPhase(projectId: number, phaseId: number): Promise<ProjectTaskItem[]> {
    const result = await this.databaseService.query<{
      id: string | number;
      project_id: string | number;
      epic_id: string | number | null;
      epic_title: string | null;
      title: string;
      description: string | null;
      status: TaskStatus;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      sort_order: string | number;
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
           WHEN 'epics' THEN 1
           WHEN 'backlog' THEN 2
           WHEN 'todo' THEN 3
           WHEN 'in_progress' THEN 4
           WHEN 'in_review' THEN 5
           WHEN 'testing' THEN 6
           WHEN 'done' THEN 7
           ELSE 8
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
      id: Number(row.id),
      projectId: Number(row.project_id),
      epicId: row.epic_id != null ? Number(row.epic_id) : null,
      epicTitle: row.epic_title,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      sortOrder: Number(row.sort_order),
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
    const epic = await this.databaseService.query<{ phase_id: string | number }>(
      `SELECT phase_id FROM pcmazing_project_epics WHERE id = $1 AND project_id = $2`,
      [epicId, projectId],
    );
    if (!epic.rows[0]) {
      throw new NotFoundException('Epic not found for this project.');
    }

    const phaseId = toPhaseId(epic.rows[0].phase_id);
    if (!phaseId) {
      throw new NotFoundException('Epic not found for this project.');
    }

    const epics = await this.listEpicsForPhase(projectId, phaseId);
    const found = epics.find((item) => Number(item.id) === Number(epicId));
    if (!found) {
      throw new NotFoundException('Epic not found for this project.');
    }
    return found;
  }

  private async syncEpicAfterTaskChange(projectId: number, epicId: number): Promise<void> {
    const epic = await this.databaseService.query<{
      task_count: string;
      open_count: string;
    }>(
      `SELECT
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

    const taskCount = Number(row.task_count ?? 0);
    const openCount = Number(row.open_count ?? 0);
    const lifecycleStatus =
      taskCount === 0 ? 'planned' : openCount === 0 ? 'completed' : 'active';
    await this.databaseService.query(
      `UPDATE pcmazing_project_epics
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2 AND project_id = $3`,
      [lifecycleStatus, epicId, projectId],
    );
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
      const existingPhase = await client.query<{ id: string | number }>(
        `SELECT id FROM pcmazing_project_phases
         WHERE project_id = $1
         ORDER BY sort_order ASC, id ASC
         LIMIT 1`,
        [projectId],
      );
      let phaseId = existingPhase.rows[0] ? Number(existingPhase.rows[0].id) : null;

      if (!phaseId) {
        const phase = await client.query<{ id: string | number }>(
          `INSERT INTO pcmazing_project_phases (
            project_id, title, description, sort_order, status
          ) VALUES ($1, 'Phase 1', 'Default project phase', 0, 'active')
          RETURNING id`,
          [projectId],
        );
        phaseId = phase.rows[0] ? Number(phase.rows[0].id) : null;
      }

      if (!phaseId) {
        return;
      }

      const existingEpic = await client.query<{ id: string | number }>(
        `SELECT id FROM pcmazing_project_epics
         WHERE project_id = $1 AND phase_id = $2
         ORDER BY sort_order ASC, id ASC
         LIMIT 1`,
        [projectId, phaseId],
      );
      let epicId = existingEpic.rows[0] ? Number(existingEpic.rows[0].id) : null;

      if (!epicId) {
        const epic = await client.query<{ id: string | number }>(
          `INSERT INTO pcmazing_project_epics (
              project_id, phase_id, title, description, sort_order, status, board_status
            ) VALUES ($1, $2, 'General', 'Default epic', 0, 'active', 'epics')
          RETURNING id`,
          [projectId, phaseId],
        );
        epicId = epic.rows[0] ? Number(epic.rows[0].id) : null;
      }

      await client.query(
        `UPDATE pcmazing_projects
         SET current_phase_id = COALESCE(current_phase_id, $1),
             current_epic_id = COALESCE(current_epic_id, $2),
             updated_at = NOW()
         WHERE id = $3`,
        [phaseId, epicId, projectId],
      );
      return;
    }

    let firstPhaseId: number | null = null;
    let firstEpicId: number | null = null;

    for (const [index, milestone] of milestones.rows.entries()) {
      let phaseId = (
        await client.query<{ id: string | number }>(
          `SELECT id FROM pcmazing_project_phases
           WHERE project_id = $1 AND contract_milestone_id = $2`,
          [projectId, milestone.id],
        )
      ).rows[0]?.id;

      if (!phaseId) {
        const inserted = await client.query<{ id: string | number }>(
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

      const numericPhaseId = toPhaseId(phaseId);
      if (!numericPhaseId) {
        continue;
      }

      if (index === 0) {
        firstPhaseId = numericPhaseId;
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
          epicId = toPhaseId(
            (
              await client.query<{ id: string | number }>(
                `SELECT id FROM pcmazing_project_epics
                 WHERE phase_id = $1 AND contract_module_id = $2`,
                [numericPhaseId, module.id],
              )
            ).rows[0]?.id,
          );
        } else {
          epicId = toPhaseId(
            (
              await client.query<{ id: string | number }>(
                `SELECT id FROM pcmazing_project_epics
                 WHERE phase_id = $1 AND contract_module_id IS NULL
                 ORDER BY sort_order ASC, id ASC
                 LIMIT 1`,
                [numericPhaseId],
              )
            ).rows[0]?.id,
          );
        }

        if (!epicId) {
          const insertedEpic = await client.query<{ id: string | number }>(
            `INSERT INTO pcmazing_project_epics (
              project_id, phase_id, contract_milestone_id, contract_module_id,
              title, description, sort_order, status, board_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned', 'epics')
            RETURNING id`,
            [
              projectId,
              numericPhaseId,
              milestone.id,
              module.id,
              module.module_name.trim() || `Epic ${epicIndex + 1}`,
              module.description,
              epicIndex,
            ],
          );
          epicId = toPhaseId(insertedEpic.rows[0]?.id);
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

  private parseLinkedSortOrder(value?: string | null): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const first = String(value).split(',')[0]?.trim();
    const parsed = Number(first);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  private normalizeLinkedSortOrders(value?: string | null): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const orders = String(value)
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map((part) => Number(part))
      .filter((part) => Number.isInteger(part) && part >= 0);

    if (!orders.length) {
      return null;
    }

    return [...new Set(orders)].join(',');
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

  private async requireActiveTeamMembers(
    refs: ProjectUserRefDto[],
  ): Promise<ProjectUserSummary[]> {
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
      resolved.push(user);
    }

    if (!resolved.length) {
      throw new BadRequestException('At least one team member is required.');
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
