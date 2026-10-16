import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';
import { CreateEmployeeMemoDto } from './dto/employee-memo.dto';
import {
  buildMemoNo,
  EmployeeMemoType,
  memoTypeLabel,
  normalizeMemoType,
} from './employee-memos.util';

export type EmployeeMemoListItem = {
  id: number;
  memoNo: string;
  employeeUserId: number;
  employeeName: string | null;
  memoType: EmployeeMemoType;
  memoTypeLabel: string;
  subject: string;
  issuedAt: string | null;
  acknowledgedAt: string | null;
  issuedByName: string | null;
};

export type EmployeeMemoDetail = EmployeeMemoListItem & {
  incidentDate: string | null;
  statementOfFacts: string;
  policyViolated: string | null;
  directive: string | null;
  replyByDate: string | null;
  issuedByUserId: number;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyLogoUrl: string;
  employeePosition: string | null;
};

@Injectable()
export class EmployeeMemosService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async ensureTable(): Promise<void> {
    if (!(await tableExists(this.databaseService, 'pcmazing_employee_memos'))) {
      throw new ServiceUnavailableException(
        'Employee memos table is not available. Apply migration 080_employee_memos.sql.',
      );
    }
  }

  async listAdmin(filters: {
    employeeUserId?: number;
    memoType?: string;
    ackStatus?: string;
  }): Promise<EmployeeMemoListItem[]> {
    await this.ensureTable();
    const params: unknown[] = [];
    const where: string[] = ['m.deleted_at IS NULL'];

    if (filters.employeeUserId && Number.isFinite(filters.employeeUserId)) {
      params.push(filters.employeeUserId);
      where.push(`m.employee_user_id = $${params.length}`);
    }
    if (filters.memoType) {
      try {
        const type = normalizeMemoType(filters.memoType);
        params.push(type);
        where.push(`m.memo_type = $${params.length}`);
      } catch {
        throw new BadRequestException('Invalid memo type filter.');
      }
    }
    if (filters.ackStatus === 'pending') {
      where.push('m.acknowledged_at IS NULL');
    } else if (filters.ackStatus === 'acknowledged') {
      where.push('m.acknowledged_at IS NOT NULL');
    }

    const result = await this.databaseService.query<{
      id: number;
      memo_no: string;
      employee_user_id: number;
      employee_name: string | null;
      memo_type: string;
      subject: string;
      issued_at: string | null;
      acknowledged_at: string | null;
      issued_by_name: string | null;
    }>(
      `SELECT
         m.id,
         m.memo_no,
         m.employee_user_id,
         COALESCE(e.full_name, e.username) AS employee_name,
         m.memo_type,
         m.subject,
         m.issued_at::text,
         m.acknowledged_at::text,
         COALESCE(i.full_name, i.username) AS issued_by_name
       FROM pcmazing_employee_memos m
       LEFT JOIN pcmazing_admin_users e ON e.id = m.employee_user_id
       LEFT JOIN pcmazing_admin_users i ON i.id = m.issued_by_user_id
       WHERE ${where.join(' AND ')}
       ORDER BY m.issued_at DESC, m.id DESC
       LIMIT 200`,
      params,
    );

    return result.rows.map((row) => this.mapList(row));
  }

  async getById(id: number): Promise<EmployeeMemoDetail> {
    await this.ensureTable();
    const detail = await this.fetchDetail(id);
    if (!detail) {
      throw new NotFoundException(`Memo ${id} was not found.`);
    }
    return detail;
  }

  async create(dto: CreateEmployeeMemoDto, issuedByUserId: number): Promise<EmployeeMemoDetail> {
    await this.ensureTable();

    let memoType: EmployeeMemoType;
    try {
      memoType = normalizeMemoType(dto.memoType);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid memo type.',
      );
    }

    const subject = dto.subject.trim();
    const facts = dto.statementOfFacts.trim();
    if (!subject || facts.length < 10) {
      throw new BadRequestException('Subject and statement of facts are required.');
    }

    const employee = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM pcmazing_admin_users WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [dto.employeeUserId],
    );
    if (!employee.rows[0]) {
      throw new BadRequestException('Employee was not found or is inactive.');
    }

    const insert = await this.databaseService.query<{ id: number; issued_at: string }>(
      `INSERT INTO pcmazing_employee_memos (
         memo_no,
         employee_user_id,
         memo_type,
         subject,
         incident_date,
         statement_of_facts,
         policy_violated,
         directive,
         reply_by_date,
         issued_by_user_id
       ) VALUES (
         'PENDING',
         $1, $2, $3, $4, $5, $6, $7, $8, $9
       )
       RETURNING id, issued_at::text`,
      [
        dto.employeeUserId,
        memoType,
        subject,
        dto.incidentDate?.slice(0, 10) || null,
        facts,
        dto.policyViolated?.trim() || null,
        dto.directive?.trim() || null,
        dto.replyByDate?.slice(0, 10) || null,
        issuedByUserId,
      ],
    );

    const id = Number(insert.rows[0].id);
    const issuedAt = new Date(insert.rows[0].issued_at);
    const memoNo = buildMemoNo(id, Number.isNaN(issuedAt.getTime()) ? new Date() : issuedAt);

    await this.databaseService.query(
      `UPDATE pcmazing_employee_memos
       SET memo_no = $1, updated_at = NOW()
       WHERE id = $2`,
      [memoNo, id],
    );

    return this.getById(id);
  }

  async listForEmployee(employeeUserId: number): Promise<EmployeeMemoListItem[]> {
    await this.ensureTable();
    const result = await this.databaseService.query<{
      id: number;
      memo_no: string;
      employee_user_id: number;
      employee_name: string | null;
      memo_type: string;
      subject: string;
      issued_at: string | null;
      acknowledged_at: string | null;
      issued_by_name: string | null;
    }>(
      `SELECT
         m.id,
         m.memo_no,
         m.employee_user_id,
         COALESCE(e.full_name, e.username) AS employee_name,
         m.memo_type,
         m.subject,
         m.issued_at::text,
         m.acknowledged_at::text,
         COALESCE(i.full_name, i.username) AS issued_by_name
       FROM pcmazing_employee_memos m
       LEFT JOIN pcmazing_admin_users e ON e.id = m.employee_user_id
       LEFT JOIN pcmazing_admin_users i ON i.id = m.issued_by_user_id
       WHERE m.deleted_at IS NULL
         AND m.employee_user_id = $1
       ORDER BY m.issued_at DESC, m.id DESC
       LIMIT 100`,
      [employeeUserId],
    );
    return result.rows.map((row) => this.mapList(row));
  }

  async listPendingForEmployee(employeeUserId: number): Promise<EmployeeMemoDetail[]> {
    await this.ensureTable();
    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id
       FROM pcmazing_employee_memos
       WHERE deleted_at IS NULL
         AND employee_user_id = $1
         AND acknowledged_at IS NULL
       ORDER BY issued_at ASC, id ASC
       LIMIT 20`,
      [employeeUserId],
    );

    const details: EmployeeMemoDetail[] = [];
    for (const row of result.rows) {
      const detail = await this.fetchDetail(Number(row.id));
      if (detail) {
        details.push(detail);
      }
    }
    return details;
  }

  async getForEmployee(memoId: number, employeeUserId: number): Promise<EmployeeMemoDetail> {
    await this.ensureTable();
    const detail = await this.fetchDetail(memoId);
    if (!detail || detail.employeeUserId !== employeeUserId) {
      throw new NotFoundException(`Memo ${memoId} was not found.`);
    }
    return detail;
  }

  async acknowledge(memoId: number, employeeUserId: number): Promise<EmployeeMemoDetail> {
    await this.ensureTable();
    const existing = await this.databaseService.query<{
      id: number;
      employee_user_id: number;
      acknowledged_at: string | null;
    }>(
      `SELECT id, employee_user_id, acknowledged_at::text
       FROM pcmazing_employee_memos
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [memoId],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new NotFoundException(`Memo ${memoId} was not found.`);
    }
    if (Number(row.employee_user_id) !== employeeUserId) {
      throw new NotFoundException(`Memo ${memoId} was not found.`);
    }
    if (!row.acknowledged_at) {
      await this.databaseService.query(
        `UPDATE pcmazing_employee_memos
         SET acknowledged_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND acknowledged_at IS NULL`,
        [memoId],
      );
    }
    return this.getById(memoId);
  }

  private async fetchDetail(id: number): Promise<EmployeeMemoDetail | null> {
    const result = await this.databaseService.query<{
      id: number;
      memo_no: string;
      employee_user_id: number;
      employee_name: string | null;
      employee_position: string | null;
      memo_type: string;
      subject: string;
      incident_date: string | null;
      statement_of_facts: string;
      policy_violated: string | null;
      directive: string | null;
      reply_by_date: string | null;
      issued_by_user_id: number;
      issued_by_name: string | null;
      issued_at: string | null;
      acknowledged_at: string | null;
    }>(
      `SELECT
         m.id,
         m.memo_no,
         m.employee_user_id,
         COALESCE(e.full_name, e.username) AS employee_name,
         p.position_title AS employee_position,
         m.memo_type,
         m.subject,
         m.incident_date::text,
         m.statement_of_facts,
         m.policy_violated,
         m.directive,
         m.reply_by_date::text,
         m.issued_by_user_id,
         COALESCE(i.full_name, i.username) AS issued_by_name,
         m.issued_at::text,
         m.acknowledged_at::text
       FROM pcmazing_employee_memos m
       LEFT JOIN pcmazing_admin_users e ON e.id = m.employee_user_id
       LEFT JOIN pcmazing_admin_users i ON i.id = m.issued_by_user_id
       LEFT JOIN pcmazing_user_payroll p
         ON p.user_id = m.employee_user_id
        AND p.user_source = 'pcmazing_admin_users'
       WHERE m.id = $1 AND m.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const company = await this.loadCompanyHeader();
    const list = this.mapList(row);
    return {
      ...list,
      incidentDate: row.incident_date,
      statementOfFacts: row.statement_of_facts,
      policyViolated: row.policy_violated,
      directive: row.directive,
      replyByDate: row.reply_by_date,
      issuedByUserId: Number(row.issued_by_user_id),
      companyName: company.companyName,
      companyAddress: company.companyAddress,
      companyPhone: company.companyPhone,
      companyLogoUrl: company.companyLogoUrl,
      employeePosition: row.employee_position,
    };
  }

  private async loadCompanyHeader(): Promise<{
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyLogoUrl: string;
  }> {
    const defaults = {
      companyName: 'PCmazing Information Technology Services',
      companyAddress: '',
      companyPhone: '09394133225',
      companyLogoUrl: '/images/logopcm.png',
    };

    if (!(await tableExists(this.databaseService, 'pcmazing_printing_settings'))) {
      return defaults;
    }

    const result = await this.databaseService.query<{
      store_name: string | null;
      store_address: string | null;
      store_phone: string | null;
    }>(
      `SELECT store_name, store_address, store_phone
       FROM pcmazing_printing_settings
       ORDER BY id ASC
       LIMIT 1`,
    );
    const row = result.rows[0];
    return {
      companyName: row?.store_name?.trim() || defaults.companyName,
      companyAddress: row?.store_address?.trim() || defaults.companyAddress,
      companyPhone: row?.store_phone?.trim() || defaults.companyPhone,
      companyLogoUrl: defaults.companyLogoUrl,
    };
  }

  private mapList(row: {
    id: number;
    memo_no: string;
    employee_user_id: number;
    employee_name: string | null;
    memo_type: string;
    subject: string;
    issued_at: string | null;
    acknowledged_at: string | null;
    issued_by_name: string | null;
  }): EmployeeMemoListItem {
    const memoType = normalizeMemoType(row.memo_type);
    return {
      id: Number(row.id),
      memoNo: row.memo_no,
      employeeUserId: Number(row.employee_user_id),
      employeeName: row.employee_name,
      memoType,
      memoTypeLabel: memoTypeLabel(memoType),
      subject: row.subject,
      issuedAt: row.issued_at,
      acknowledgedAt: row.acknowledged_at,
      issuedByName: row.issued_by_name,
    };
  }
}
