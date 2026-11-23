import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { DatabaseService } from '../../database/database.service';
import { ensureEmployeeWorkspaceTables } from './employee-workspace.schema';
import { AdminJwtPayload } from '../auth/guards/jwt-auth.guard';
import {
  canFinalizePayslip,
  canReviewTimesheet,
  canUsePortalLogin,
} from '../rbac/admin-roles.util';

export class SubmitTimesheetDto {
  @IsString()
  month!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReviewTimesheetDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class FinalizeTimesheetDto {
  @IsDateString()
  postedOn!: string;
}

type TimesheetRow = {
  id: number;
  user_id: number;
  user_source: string;
  period_from: string;
  period_to: string;
  full_name: string;
  username: string;
  status: string;
  total_hours: string;
  days_present: number;
  days_completed: number;
  employee_note: string | null;
  review_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  finalized_at: string | null;
  finalized_by_name: string | null;
  posted_on: string | null;
  payslip_id: number | null;
};

@Injectable()
export class EmployeeTimesheetService {
  private ready = false;

  constructor(private readonly databaseService: DatabaseService) {}

  private async prepare() {
    if (this.ready) return;
    await ensureEmployeeWorkspaceTables(this.databaseService);
    this.ready = true;
  }

  async mine(actor: AdminJwtPayload, monthRaw?: string) {
    await this.prepare();
    this.assertPortal(actor.role);
    const month = this.month(monthRaw);
    const bounds = this.bounds(month);
    const summary = await this.attendanceSummary(actor.sub, actor.source, bounds.dateFrom, bounds.dateTo);
    const sheet = await this.findPeriod(actor.sub, actor.source, bounds.dateFrom, bounds.dateTo);
    return {
      month,
      periodFrom: bounds.dateFrom,
      periodTo: bounds.dateTo,
      attendance: summary,
      timesheet: sheet ? this.present(sheet) : null,
      canReview: canReviewTimesheet(actor.role),
      canFinalize: canFinalizePayslip(actor.role),
    };
  }

  async submit(actor: AdminJwtPayload, dto: SubmitTimesheetDto) {
    await this.prepare();
    this.assertPortal(actor.role);
    const month = this.month(dto.month);
    const bounds = this.bounds(month);
    const summary = await this.attendanceSummary(actor.sub, actor.source, bounds.dateFrom, bounds.dateTo);
    if (summary.daysPresent < 1) {
      throw new BadRequestException('Add at least one time-in before sending this timesheet.');
    }
    const existing = await this.findPeriod(actor.sub, actor.source, bounds.dateFrom, bounds.dateTo);
    if (existing && (existing.status === 'submitted' || existing.status === 'approved' || existing.status === 'finalized')) {
      throw new BadRequestException('This timesheet is already with a reviewer.');
    }
    const note = dto.note?.trim() || null;
    const result = await this.databaseService.query<TimesheetRow>(
      `INSERT INTO pcmazing_employee_timesheets (
         user_id, user_source, period_from, period_to, full_name, username, status,
         total_hours, days_present, days_completed, employee_note, submitted_at, updated_at
       ) VALUES ($1, $2, $3::date, $4::date, $5, $6, 'submitted', $7, $8, $9, $10, NOW(), NOW())
       ON CONFLICT (user_id, user_source, period_from, period_to)
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         username = EXCLUDED.username,
         status = 'submitted',
         total_hours = EXCLUDED.total_hours,
         days_present = EXCLUDED.days_present,
         days_completed = EXCLUDED.days_completed,
         employee_note = EXCLUDED.employee_note,
         review_note = NULL,
         submitted_at = NOW(),
         reviewed_at = NULL,
         reviewed_by_user_id = NULL,
         reviewed_by_name = NULL,
         updated_at = NOW()
       RETURNING ${this.columns}`,
      [
        actor.sub,
        actor.source,
        bounds.dateFrom,
        bounds.dateTo,
        actor.fullName || actor.username,
        actor.username,
        summary.totalHours,
        summary.daysPresent,
        summary.daysCompleted,
        note,
      ],
    );
    return this.present(result.rows[0]);
  }

  async reviewQueue(actor: AdminJwtPayload) {
    await this.prepare();
    this.assertReviewer(actor.role);
    const result = await this.databaseService.query<TimesheetRow>(
      `SELECT ${this.columns}
       FROM pcmazing_employee_timesheets
       WHERE status = 'submitted'
       ORDER BY submitted_at ASC`,
    );
    return result.rows.map((row) => this.present(row));
  }

  async approve(actor: AdminJwtPayload, id: number, dto: ReviewTimesheetDto) {
    await this.prepare();
    this.assertReviewer(actor.role);
    const sheet = await this.require(id);
    if (sheet.status !== 'submitted') {
      throw new BadRequestException('Only a submitted timesheet can be approved.');
    }
    const result = await this.databaseService.query<TimesheetRow>(
      `UPDATE pcmazing_employee_timesheets
       SET status = 'approved',
           review_note = $2,
           reviewed_at = NOW(),
           reviewed_by_user_id = $3,
           reviewed_by_name = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${this.columns}`,
      [id, dto.note?.trim() || null, actor.sub, actor.fullName || actor.username],
    );
    return this.present(result.rows[0]);
  }

  async revert(actor: AdminJwtPayload, id: number, dto: ReviewTimesheetDto) {
    await this.prepare();
    this.assertReviewer(actor.role);
    const note = dto.note?.trim();
    if (!note) {
      throw new BadRequestException('Explain what the employee should recheck.');
    }
    const sheet = await this.require(id);
    if (sheet.status !== 'submitted' && sheet.status !== 'approved') {
      throw new BadRequestException('This timesheet cannot be sent back.');
    }
    const result = await this.databaseService.query<TimesheetRow>(
      `UPDATE pcmazing_employee_timesheets
       SET status = 'reverted',
           review_note = $2,
           reviewed_at = NOW(),
           reviewed_by_user_id = $3,
           reviewed_by_name = $4,
           finalized_at = NULL,
           finalized_by_user_id = NULL,
           finalized_by_name = NULL,
           posted_on = NULL,
           payslip_id = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${this.columns}`,
      [id, note, actor.sub, actor.fullName || actor.username],
    );
    return this.present(result.rows[0]);
  }

  async finalizeQueue(actor: AdminJwtPayload) {
    await this.prepare();
    this.assertFounder(actor.role);
    const result = await this.databaseService.query<TimesheetRow>(
      `SELECT ${this.columns}
       FROM pcmazing_employee_timesheets
       WHERE status = 'approved'
       ORDER BY reviewed_at ASC`,
    );
    return result.rows.map((row) => this.present(row));
  }

  async finalize(actor: AdminJwtPayload, id: number, dto: FinalizeTimesheetDto) {
    await this.prepare();
    this.assertFounder(actor.role);
    const postedOn = dto.postedOn?.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(postedOn)) {
      throw new BadRequestException('Choose the date this payslip should appear.');
    }
    const sheet = await this.require(id);
    if (sheet.status !== 'approved') {
      throw new BadRequestException('The COO or CEO must approve this timesheet first.');
    }
    const payslip = await this.databaseService.query<{ id: number }>(
      `SELECT p.id
       FROM pcmazing_generated_payslips p
       INNER JOIN pcmazing_payroll_runs r ON r.id = p.run_id
       WHERE p.user_id = $1
         AND p.user_source = $2
         AND r.date_from <= $4::date
         AND r.date_to >= $3::date
       ORDER BY r.date_to DESC
       LIMIT 1`,
      [sheet.user_id, sheet.user_source, sheet.period_from, sheet.period_to],
    );
    const result = await this.databaseService.query<TimesheetRow>(
      `UPDATE pcmazing_employee_timesheets
       SET status = 'finalized',
           posted_on = $2::date,
           payslip_id = $3,
           finalized_at = NOW(),
           finalized_by_user_id = $4,
           finalized_by_name = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${this.columns}`,
      [id, postedOn, payslip.rows[0]?.id ?? null, actor.sub, actor.fullName || actor.username],
    );
    return this.present(result.rows[0]);
  }

  private assertPortal(role?: string | null) {
    if (!canUsePortalLogin(role)) {
      throw new ForbiddenException('Employee workspace is not available for this role.');
    }
  }

  private assertReviewer(role?: string | null) {
    if (!canReviewTimesheet(role)) {
      throw new ForbiddenException('Only the COO or CEO can review timesheets.');
    }
  }

  private assertFounder(role?: string | null) {
    if (!canFinalizePayslip(role)) {
      throw new ForbiddenException('Only the founder can post a payslip.');
    }
  }

  private month(raw?: string): string {
    const value = raw?.trim() || '';
    if (!/^\d{4}-\d{2}$/.test(value)) {
      throw new BadRequestException('month must be YYYY-MM.');
    }
    return value;
  }

  private bounds(month: string): { dateFrom: string; dateTo: string } {
    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    return {
      dateFrom: `${month}-01`,
      dateTo: `${month}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private async attendanceSummary(userId: number, source: string, dateFrom: string, dateTo: string) {
    const result = await this.databaseService.query<{
      days_present: number;
      days_completed: number;
      total_hours: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE time_in IS NOT NULL)::int AS days_present,
         COUNT(*) FILTER (WHERE time_in IS NOT NULL AND time_out IS NOT NULL)::int AS days_completed,
         COALESCE(SUM(EXTRACT(EPOCH FROM (time_out - time_in)) / 3600) FILTER (WHERE time_in IS NOT NULL AND time_out IS NOT NULL), 0)::text AS total_hours
       FROM pcmazing_attendance
       WHERE user_id = $1 AND user_source = $2 AND work_date BETWEEN $3::date AND $4::date`,
      [userId, source, dateFrom, dateTo],
    );
    const row = result.rows[0];
    return {
      daysPresent: Number(row?.days_present ?? 0),
      daysCompleted: Number(row?.days_completed ?? 0),
      totalHours: Math.round(Number(row?.total_hours ?? 0) * 100) / 100,
    };
  }

  private async findPeriod(userId: number, source: string, dateFrom: string, dateTo: string) {
    const result = await this.databaseService.query<TimesheetRow>(
      `SELECT ${this.columns}
       FROM pcmazing_employee_timesheets
       WHERE user_id = $1 AND user_source = $2 AND period_from = $3::date AND period_to = $4::date`,
      [userId, source, dateFrom, dateTo],
    );
    return result.rows[0] ?? null;
  }

  private async require(id: number) {
    const result = await this.databaseService.query<TimesheetRow>(
      `SELECT ${this.columns} FROM pcmazing_employee_timesheets WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Timesheet not found.');
    }
    return row;
  }

  private readonly columns = `id, user_id, user_source, period_from::text, period_to::text, full_name, username, status,
    total_hours::text, days_present, days_completed, employee_note, review_note,
    submitted_at::text, reviewed_at::text, reviewed_by_name, finalized_at::text, finalized_by_name,
    posted_on::text, payslip_id`;

  private present(row: TimesheetRow) {
    return {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      username: row.username,
      periodFrom: row.period_from,
      periodTo: row.period_to,
      status: row.status,
      totalHours: Math.round(Number(row.total_hours || 0) * 100) / 100,
      daysPresent: Number(row.days_present) || 0,
      daysCompleted: Number(row.days_completed) || 0,
      employeeNote: row.employee_note,
      reviewNote: row.review_note,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewedByName: row.reviewed_by_name,
      finalizedAt: row.finalized_at,
      finalizedByName: row.finalized_by_name,
      postedOn: row.posted_on,
      payslipId: row.payslip_id == null ? null : String(row.payslip_id),
    };
  }
}
