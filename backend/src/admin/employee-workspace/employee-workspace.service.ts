import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { isSalesRestrictedInventory, isSuperAdmin } from '../rbac/admin-roles.util';
import { PayrollService } from '../payroll/payroll.service';
import { manilaWorkDate } from '../payroll/payroll.schema';
import { ensureEmployeeWorkspaceTables } from './employee-workspace.schema';
import {
  CreateActivityDto,
  CreateTodoDto,
  UpdateTodoDto,
  UpsertDayOffDto,
} from './dto/employee-workspace.dto';

type UserSource = 'tblusers' | 'pcmazing_admin_users';

@Injectable()
export class EmployeeWorkspaceService {
  private ready = false;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly payrollService: PayrollService,
  ) {}

  async ensureReady(): Promise<void> {
    if (this.ready) {
      return;
    }
    await ensureEmployeeWorkspaceTables(this.databaseService);
    this.ready = true;
  }

  assertSalesWorkspaceAccess(role?: string | null): void {
    if (isSuperAdmin(role)) {
      return;
    }
    if (!isSalesRestrictedInventory(role)) {
      throw new ForbiddenException('Employee workspace is available for Sales Manager roles.');
    }
  }

  async getDashboard(
    userId: number,
    source: UserSource,
    monthRaw?: string,
  ) {
    await this.ensureReady();
    const workDate = manilaWorkDate();
    const month = this.normalizeMonth(monthRaw) ?? workDate.slice(0, 7);
    const { dateFrom, dateTo } = this.monthBounds(month);

    const attendanceResult = await this.databaseService.query<{
      id: number;
      work_date: string;
      time_in: string | null;
      time_out: string | null;
      overtime_hours: string | number | null;
      overtime_status: string | null;
    }>(
      `SELECT id, work_date::text AS work_date, time_in::text, time_out::text,
              overtime_hours, overtime_status
       FROM pcmazing_attendance
       WHERE user_id = $1
         AND user_source = $2
         AND work_date BETWEEN $3::date AND $4::date
       ORDER BY work_date ASC`,
      [userId, source, dateFrom, dateTo],
    );

    const attendanceDays = attendanceResult.rows.map((row) => {
      const hoursWorked = this.computeHours(row.time_in, row.time_out);
      const overtimeHours = Number(row.overtime_hours ?? 0) || 0;
      const overtimeStatus = this.normalizeOvertimeStatus(row.overtime_status);
      const canRequestOvertime =
        overtimeHours > 0 && (overtimeStatus === 'none' || overtimeStatus === 'rejected');

      return {
        id: row.id,
        workDate: row.work_date,
        timeIn: row.time_in,
        timeOut: row.time_out,
        hoursWorked,
        dayPayLabel: this.dayPayLabel(hoursWorked),
        overtimeHours,
        overtimeStatus,
        canRequestOvertime,
      };
    });

    const todayRow = attendanceDays.find((row) => row.workDate === workDate);
    let todayStatus = 'not_timed_in';
    if (todayRow?.timeIn && todayRow?.timeOut) {
      todayStatus = 'completed';
    } else if (todayRow?.timeIn) {
      todayStatus = 'timed_in';
    }

    const dayOffs = await this.listDayOffs(userId, source, dateFrom, dateTo);
    const todos = await this.listTodos(userId, source, dateFrom, dateTo);
    const activities = await this.listRecentActions(userId, source, attendanceDays, 25);
    const payslips = await this.payrollService.getEmployeePayslips(userId, source, 6);

    const daysPresent = attendanceDays.filter((row) => row.timeIn).length;
    const daysCompleted = attendanceDays.filter((row) => row.hoursWorked != null).length;
    const totalHours =
      Math.round(
        attendanceDays.reduce((sum, row) => sum + (row.hoursWorked ?? 0), 0) * 100,
      ) / 100;

    const overtimeEligible = attendanceDays.filter(
      (row) => row.overtimeHours > 0 && (row.overtimeStatus === 'none' || row.overtimeStatus === 'rejected'),
    );
    const overtimePending = attendanceDays.filter((row) => row.overtimeStatus === 'pending');

    return {
      workDate,
      month,
      today: {
        timeIn: todayRow?.timeIn ?? null,
        timeOut: todayRow?.timeOut ?? null,
        hoursWorked: todayRow?.hoursWorked ?? null,
        status: todayStatus,
        overtimeHours: todayRow?.overtimeHours ?? 0,
        overtimeStatus: todayRow?.overtimeStatus ?? 'none',
        canRequestOvertime: todayRow?.canRequestOvertime ?? false,
        attendanceId: todayRow?.id ?? null,
      },
      monthSummary: {
        totalHours,
        daysPresent,
        daysCompleted,
        dayOffCount: dayOffs.length,
      },
      overtimeNotice: {
        eligibleCount: overtimeEligible.length,
        pendingCount: overtimePending.length,
        message:
          overtimeEligible.length > 0
            ? `You have ${overtimeEligible.length} day(s) with overtime (over 9 hours). Request approval so it can be paid.`
            : overtimePending.length > 0
              ? `${overtimePending.length} overtime request(s) waiting for admin approval.`
              : null,
      },
      attendanceDays,
      dayOffs,
      todos,
      activities,
      payslips,
    };
  }

  async requestOvertime(userId: number, source: UserSource, attendanceId: number) {
    await this.ensureReady();
    const result = await this.payrollService.requestOvertime(userId, source, attendanceId);
    await this.recordActivity(
      userId,
      source,
      'overtime_requested',
      `Requested overtime · ${result.workDate}`,
      `${result.overtimeHours.toFixed(2)} h pending approval`,
    );
    return result;
  }

  async getPayslipPdf(userId: number, source: UserSource, payslipId: string | number) {
    await this.ensureReady();
    return this.payrollService.buildEmployeePayslipPdf(payslipId, userId, source);
  }

  async getPayslipDetail(userId: number, source: UserSource, payslipId: string | number) {
    await this.ensureReady();
    const detail = await this.payrollService.getEmployeePayslipDetail(payslipId, userId, source);
    const { pdfPayload: _pdfPayload, filename: _filename, ...rest } = detail;
    return rest;
  }

  async listDayOffs(userId: number, source: UserSource, dateFrom: string, dateTo: string) {
    await this.ensureReady();
    const result = await this.databaseService.query<{
      id: number;
      day_off_date: string;
      reason: string | null;
    }>(
      `SELECT id, day_off_date::text AS day_off_date, reason
       FROM pcmazing_employee_day_offs
       WHERE user_id = $1 AND user_source = $2
         AND day_off_date BETWEEN $3::date AND $4::date
       ORDER BY day_off_date ASC`,
      [userId, source, dateFrom, dateTo],
    );

    return result.rows.map((row) => ({
      id: row.id,
      dayOffDate: row.day_off_date,
      reason: row.reason,
    }));
  }

  async upsertDayOff(userId: number, source: UserSource, dto: UpsertDayOffDto) {
    await this.ensureReady();
    const dayOffDate = dto.dayOffDate.slice(0, 10);
    const reason = dto.reason?.trim() || null;

    const result = await this.databaseService.query<{
      id: number;
      day_off_date: string;
      reason: string | null;
    }>(
      `INSERT INTO pcmazing_employee_day_offs (user_id, user_source, day_off_date, reason)
       VALUES ($1, $2, $3::date, $4)
       ON CONFLICT (user_id, user_source, day_off_date) DO UPDATE SET
         reason = EXCLUDED.reason,
         updated_at = NOW()
       RETURNING id, day_off_date::text AS day_off_date, reason`,
      [userId, source, dayOffDate, reason],
    );

    const row = result.rows[0];
    await this.recordActivity(
      userId,
      source,
      'day_off_plotted',
      `Plotted day off · ${row.day_off_date}`,
      row.reason,
    );
    return { id: row.id, dayOffDate: row.day_off_date, reason: row.reason };
  }

  async deleteDayOff(userId: number, source: UserSource, id: number) {
    await this.ensureReady();
    const existing = await this.databaseService.query<{ day_off_date: string; reason: string | null }>(
      `SELECT day_off_date::text AS day_off_date, reason
       FROM pcmazing_employee_day_offs
       WHERE id = $1 AND user_id = $2 AND user_source = $3`,
      [id, userId, source],
    );
    if (!existing.rows[0]) {
      throw new NotFoundException('Day off not found.');
    }

    await this.databaseService.query(
      `DELETE FROM pcmazing_employee_day_offs
       WHERE id = $1 AND user_id = $2 AND user_source = $3`,
      [id, userId, source],
    );

    await this.recordActivity(
      userId,
      source,
      'day_off_removed',
      `Removed day off · ${existing.rows[0].day_off_date}`,
      existing.rows[0].reason,
    );
  }

  async listTodos(userId: number, source: UserSource, dateFrom: string, dateTo: string) {
    await this.ensureReady();
    const result = await this.databaseService.query<{
      id: number;
      title: string;
      notes: string | null;
      due_date: string;
      is_done: boolean;
    }>(
      `SELECT id, title, notes, due_date::text AS due_date, is_done
       FROM pcmazing_employee_todos
       WHERE user_id = $1 AND user_source = $2
         AND due_date BETWEEN $3::date AND $4::date
       ORDER BY is_done ASC, due_date ASC, id DESC`,
      [userId, source, dateFrom, dateTo],
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      notes: row.notes,
      dueDate: row.due_date,
      isDone: row.is_done,
    }));
  }

  async createTodo(userId: number, source: UserSource, dto: CreateTodoDto) {
    await this.ensureReady();
    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException('Title is required.');
    }

    const result = await this.databaseService.query<{
      id: number;
      title: string;
      notes: string | null;
      due_date: string;
      is_done: boolean;
    }>(
      `INSERT INTO pcmazing_employee_todos (user_id, user_source, title, notes, due_date)
       VALUES ($1, $2, $3, $4, $5::date)
       RETURNING id, title, notes, due_date::text AS due_date, is_done`,
      [userId, source, title, dto.notes?.trim() || null, dto.dueDate.slice(0, 10)],
    );

    const row = result.rows[0];
    await this.recordActivity(
      userId,
      source,
      'todo_created',
      `Added to-do: ${row.title}`,
      `Due ${row.due_date}`,
    );
    return {
      id: row.id,
      title: row.title,
      notes: row.notes,
      dueDate: row.due_date,
      isDone: row.is_done,
    };
  }

  async updateTodo(userId: number, source: UserSource, id: number, dto: UpdateTodoDto) {
    await this.ensureReady();
    const existing = await this.databaseService.query<{
      id: number;
      title: string;
      is_done: boolean;
    }>(
      `SELECT id, title, is_done FROM pcmazing_employee_todos
       WHERE id = $1 AND user_id = $2 AND user_source = $3`,
      [id, userId, source],
    );
    if (!existing.rows[0]) {
      throw new NotFoundException('Todo not found.');
    }

    const result = await this.databaseService.query<{
      id: number;
      title: string;
      notes: string | null;
      due_date: string;
      is_done: boolean;
    }>(
      `UPDATE pcmazing_employee_todos SET
         title = COALESCE($4, title),
         notes = CASE WHEN $5::boolean THEN $6 ELSE notes END,
         due_date = COALESCE($7::date, due_date),
         is_done = COALESCE($8, is_done),
         updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND user_source = $3
       RETURNING id, title, notes, due_date::text AS due_date, is_done`,
      [
        id,
        userId,
        source,
        dto.title?.trim() || null,
        dto.notes !== undefined,
        dto.notes?.trim() || null,
        dto.dueDate?.slice(0, 10) || null,
        dto.isDone ?? null,
      ],
    );

    const row = result.rows[0];
    if (dto.isDone !== undefined && dto.isDone !== existing.rows[0].is_done) {
      await this.recordActivity(
        userId,
        source,
        dto.isDone ? 'todo_completed' : 'todo_reopened',
        dto.isDone ? `Completed to-do: ${row.title}` : `Reopened to-do: ${row.title}`,
        `Due ${row.due_date}`,
      );
    }
    return {
      id: row.id,
      title: row.title,
      notes: row.notes,
      dueDate: row.due_date,
      isDone: row.is_done,
    };
  }

  async deleteTodo(userId: number, source: UserSource, id: number) {
    await this.ensureReady();
    const existing = await this.databaseService.query<{ title: string; due_date: string }>(
      `SELECT title, due_date::text AS due_date
       FROM pcmazing_employee_todos
       WHERE id = $1 AND user_id = $2 AND user_source = $3`,
      [id, userId, source],
    );
    if (!existing.rows[0]) {
      throw new NotFoundException('Todo not found.');
    }

    await this.databaseService.query(
      `DELETE FROM pcmazing_employee_todos
       WHERE id = $1 AND user_id = $2 AND user_source = $3`,
      [id, userId, source],
    );

    await this.recordActivity(
      userId,
      source,
      'todo_deleted',
      `Deleted to-do: ${existing.rows[0].title}`,
      `Due ${existing.rows[0].due_date}`,
    );
  }

  async listActivities(userId: number, source: UserSource, limit = 20) {
    await this.ensureReady();
    const result = await this.databaseService.query<{
      id: number;
      action_type: string;
      title: string;
      details: string | null;
      created_at: string;
    }>(
      `SELECT id, action_type, title, details, created_at::text
       FROM pcmazing_employee_activities
       WHERE user_id = $1 AND user_source = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, source, Math.min(Math.max(limit, 1), 50)],
    );

    return result.rows.map((row) => ({
      id: row.id,
      actionType: row.action_type,
      title: row.title,
      details: row.details,
      createdAt: row.created_at,
    }));
  }

  async createActivity(userId: number, source: UserSource, dto: CreateActivityDto) {
    return this.recordActivity(
      userId,
      source,
      dto.actionType.trim().slice(0, 80),
      dto.title.trim(),
      dto.details?.trim() || null,
    );
  }

  private async listRecentActions(
    userId: number,
    source: UserSource,
    attendanceDays: Array<{
      workDate: string;
      timeIn: string | null;
      timeOut: string | null;
      hoursWorked: number | null;
    }>,
    limit = 25,
  ) {
    const stored = await this.listActivities(userId, source, limit);
    const punchEvents: Array<{
      id: number;
      actionType: string;
      title: string;
      details: string | null;
      createdAt: string;
    }> = [];

    for (const day of attendanceDays) {
      if (day.timeIn) {
        punchEvents.push({
          id: -Number(`${day.workDate.replace(/-/g, '')}1`),
          actionType: 'time_in',
          title: `Timed in · ${day.workDate}`,
          details: null,
          createdAt: day.timeIn,
        });
      }
      if (day.timeOut) {
        punchEvents.push({
          id: -Number(`${day.workDate.replace(/-/g, '')}2`),
          actionType: 'time_out',
          title: `Timed out · ${day.workDate}`,
          details:
            day.hoursWorked != null ? `${day.hoursWorked.toFixed(2)} h worked` : null,
          createdAt: day.timeOut,
        });
      }
    }

    return [...stored, ...punchEvents]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  private async recordActivity(
    userId: number,
    source: UserSource,
    actionType: string,
    title: string,
    details: string | null,
  ) {
    await this.ensureReady();
    const result = await this.databaseService.query<{
      id: number;
      action_type: string;
      title: string;
      details: string | null;
      created_at: string;
    }>(
      `INSERT INTO pcmazing_employee_activities (user_id, user_source, action_type, title, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, action_type, title, details, created_at::text`,
      [userId, source, actionType, title, details],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      actionType: row.action_type,
      title: row.title,
      details: row.details,
      createdAt: row.created_at,
    };
  }

  private normalizeMonth(monthRaw?: string): string | null {
    const value = monthRaw?.trim();
    if (!value) {
      return null;
    }
    if (!/^\d{4}-\d{2}$/.test(value)) {
      throw new BadRequestException('month must be YYYY-MM.');
    }
    return value;
  }

  private monthBounds(month: string): { dateFrom: string; dateTo: string } {
    const [year, mon] = month.split('-').map(Number);
    const dateFrom = `${month}-01`;
    const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const dateTo = `${month}-${String(lastDay).padStart(2, '0')}`;
    return { dateFrom, dateTo };
  }

  private computeHours(timeIn: string | null, timeOut: string | null): number | null {
    if (!timeIn || !timeOut) {
      return null;
    }
    const start = new Date(timeIn).getTime();
    const end = new Date(timeOut).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return null;
    }
    return Math.round(((end - start) / 3_600_000) * 100) / 100;
  }

  private dayPayLabel(hours: number | null): string {
    if (hours == null) {
      return 'Incomplete';
    }
    if (hours >= 9) {
      return 'Full day';
    }
    if (hours >= 4) {
      return 'Half day';
    }
    return 'Below half day';
  }

  private normalizeOvertimeStatus(
    value: string | null | undefined,
  ): 'none' | 'pending' | 'approved' | 'rejected' {
    switch ((value ?? '').trim().toLowerCase()) {
      case 'pending':
        return 'pending';
      case 'approved':
        return 'approved';
      case 'rejected':
        return 'rejected';
      default:
        return 'none';
    }
  }
}
