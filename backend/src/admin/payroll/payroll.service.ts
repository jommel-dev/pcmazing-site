import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  ACTIVE_FILTER_SQL,
  buildTblusersSelectSql,
  mapTblusersRow,
  usesTblusers,
} from '../users/tblusers.util';
import { ensureUserManagementTable } from '../users/user-management.schema';
import { AdminUserRecord } from '../users/users.types';
import { PayrollProfileFieldsDto, PayrollSalaryType } from './dto/payroll-profile-fields.dto';
import { saveAttendanceSelfieFile } from './attendance-selfie.util';
import { ensurePayrollTables, manilaWorkDate } from './payroll.schema';
import { buildPayslipPdfBuffer, PayslipPdfPayload } from './payslip-pdf.util';

export interface PayrollProfile {
  employeeCode: string | null;
  department: string | null;
  positionTitle: string | null;
  salaryType: PayrollSalaryType;
  monthlySalary: number | null;
  payrollEnabled: boolean;
}

export type OvertimeStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface AttendanceRecord {
  id: number;
  userId: number;
  userSource: 'pcmazing_admin_users' | 'tblusers';
  username: string;
  fullName: string;
  workDate: string;
  timeIn: string | null;
  timeOut: string | null;
  hoursWorked: number | null;
  status: 'timed_in' | 'completed' | 'incomplete';
  employeeCode: string | null;
  department: string | null;
  timeInSelfieUrl: string | null;
  timeOutSelfieUrl: string | null;
  overtimeHours: number;
  overtimeStatus: OvertimeStatus;
}

export interface OvertimeRecord {
  id: number;
  userId: number;
  userSource: 'pcmazing_admin_users' | 'tblusers';
  username: string;
  fullName: string;
  workDate: string;
  timeIn: string | null;
  timeOut: string | null;
  hoursWorked: number | null;
  overtimeHours: number;
  overtimeStatus: OvertimeStatus;
  employeeCode: string | null;
  department: string | null;
  overtimeReviewedAt: string | null;
  overtimeReviewNote: string | null;
}

export interface PayrollEmployeeRecord {
  userId: number;
  userSource: 'pcmazing_admin_users' | 'tblusers';
  username: string;
  fullName: string;
  isActive: boolean;
  employeeCode: string | null;
  department: string | null;
  positionTitle: string | null;
  salaryType: PayrollSalaryType;
  monthlySalary: number | null;
  payrollEnabled: boolean;
  todayStatus: 'not_started' | 'timed_in' | 'completed' | 'absent';
  todayTimeIn: string | null;
  todayTimeOut: string | null;
}

export interface PayrollOverview {
  workDate: string;
  enrolledEmployees: number;
  timedInToday: number;
  completedToday: number;
  stillWorking: number;
  notYetIn: number;
}

export interface PayrollPeriodRow {
  userId: number;
  userSource: 'pcmazing_admin_users' | 'tblusers';
  username: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
  salaryType: PayrollSalaryType;
  salaryAmount: number | null;
  daysPresent: number;
  daysCompleted: number;
  /** Full days count as 1; half days (4–&lt;9h) count as 0.5. */
  paidDayUnits: number;
  totalHours: number;
  approvedOvertimeHours: number;
  pendingOvertimeHours: number;
  estimatedPay: number;
}

export interface EmployeePayslipItem {
  id: string;
  label: string;
  dateFrom: string;
  dateTo: string;
  periodDays: number;
  daysPresent: number;
  daysCompleted: number;
  totalHours: number;
  salaryType: PayrollSalaryType;
  salaryAmount: number | null;
  estimatedPay: number;
  payrollEnabled: boolean;
}

export interface TimeClockStatus {
  username: string;
  fullName: string;
  employeeCode: string | null;
  workDate: string;
  timeIn: string | null;
  timeOut: string | null;
  canTimeIn: boolean;
  canTimeOut: boolean;
  status: 'ready' | 'timed_in' | 'completed' | 'not_enrolled' | 'not_found' | 'inactive';
  message: string;
  /** Authoritative server timestamp (ISO). Never use device clock for punches. */
  serverNow: string;
}

/** Hours required for a full paid day (and OT threshold). */
const FULL_DAY_HOURS = 9;
/** Minimum hours for half-day pay (half of daily amount). */
const HALF_DAY_MIN_HOURS = 4;
/** Ordinary overtime multiplier (Philippines Labor Code default for regular OT). */
const OVERTIME_MULTIPLIER = 1.25;

const EMPTY_PAYROLL: PayrollProfile = {
  employeeCode: null,
  department: null,
  positionTitle: null,
  salaryType: 'monthly',
  monthlySalary: null,
  payrollEnabled: false,
};

@Injectable()
export class PayrollService {
  constructor(private readonly databaseService: DatabaseService) {}

  async ensureReady(): Promise<void> {
    await ensurePayrollTables(this.databaseService);
  }

  async getProfilesForUsers(
    users: Array<{ id: number; source: AdminUserRecord['source'] }>,
  ): Promise<Map<string, PayrollProfile>> {
    await this.ensureReady();
    const map = new Map<string, PayrollProfile>();
    if (!users.length) {
      return map;
    }

    const params: unknown[] = [];
    const tuples = users.map((user, index) => {
      params.push(user.id, user.source);
      const base = index * 2;
      return `($${base + 1}::bigint, $${base + 2}::varchar)`;
    });

    const result = await this.databaseService.query<{
      user_id: number;
      user_source: string;
      employee_code: string | null;
      department: string | null;
      position_title: string | null;
      salary_type: string | null;
      monthly_salary: string | null;
      payroll_enabled: boolean;
    }>(
      `SELECT user_id, user_source, employee_code, department, position_title, salary_type,
              monthly_salary, payroll_enabled
       FROM pcmazing_user_payroll
       WHERE (user_id, user_source) IN (${tuples.join(', ')})`,
      params,
    );

    for (const row of result.rows) {
      map.set(`${row.user_source}:${row.user_id}`, this.mapProfile(row));
    }

    return map;
  }

  async getProfile(userId: number, userSource: AdminUserRecord['source']): Promise<PayrollProfile> {
    await this.ensureReady();
    const result = await this.databaseService.query<{
      employee_code: string | null;
      department: string | null;
      position_title: string | null;
      salary_type: string | null;
      monthly_salary: string | null;
      payroll_enabled: boolean;
    }>(
      `SELECT employee_code, department, position_title, salary_type, monthly_salary, payroll_enabled
       FROM pcmazing_user_payroll
       WHERE user_id = $1 AND user_source = $2
       LIMIT 1`,
      [userId, userSource],
    );

    return result.rows[0] ? this.mapProfile(result.rows[0]) : { ...EMPTY_PAYROLL };
  }

  async upsertProfile(
    userId: number,
    userSource: AdminUserRecord['source'],
    dto: PayrollProfileFieldsDto,
  ): Promise<PayrollProfile> {
    await this.ensureReady();

    const existing = await this.getProfile(userId, userSource);
    const employeeCode =
      dto.employeeCode !== undefined ? dto.employeeCode.trim() || null : existing.employeeCode;
    const department =
      dto.department !== undefined ? dto.department.trim() || null : existing.department;
    const positionTitle =
      dto.positionTitle !== undefined ? dto.positionTitle.trim() || null : existing.positionTitle;
    const salaryType =
      dto.salaryType !== undefined ? this.normalizeSalaryType(dto.salaryType) : existing.salaryType;
    const monthlySalary =
      dto.monthlySalary !== undefined
        ? dto.monthlySalary == null
          ? null
          : Number(dto.monthlySalary)
        : existing.monthlySalary;
    const payrollEnabled =
      dto.payrollEnabled !== undefined ? Boolean(dto.payrollEnabled) : existing.payrollEnabled;

    const result = await this.databaseService.query<{
      employee_code: string | null;
      department: string | null;
      position_title: string | null;
      salary_type: string | null;
      monthly_salary: string | null;
      payroll_enabled: boolean;
    }>(
      `INSERT INTO pcmazing_user_payroll (
         user_id, user_source, employee_code, department, position_title, salary_type, monthly_salary, payroll_enabled
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, user_source) DO UPDATE SET
         employee_code = EXCLUDED.employee_code,
         department = EXCLUDED.department,
         position_title = EXCLUDED.position_title,
         salary_type = EXCLUDED.salary_type,
         monthly_salary = EXCLUDED.monthly_salary,
         payroll_enabled = EXCLUDED.payroll_enabled,
         updated_at = NOW()
       RETURNING employee_code, department, position_title, salary_type, monthly_salary, payroll_enabled`,
      [
        userId,
        userSource,
        employeeCode,
        department,
        positionTitle,
        salaryType,
        monthlySalary,
        payrollEnabled,
      ],
    );

    return this.mapProfile(result.rows[0]);
  }

  async listAttendance(pageRaw?: string, limitRaw?: string, workDate?: string) {
    await this.ensureReady();

    const page = Math.max(1, Number(pageRaw) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitRaw) || 20));
    const offset = (page - 1) * limit;
    const date = workDate?.trim() || manilaWorkDate();
    const params: unknown[] = [date];

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM pcmazing_attendance WHERE work_date = $1::date`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const result = await this.databaseService.query<{
      id: number;
      user_id: number;
      user_source: 'pcmazing_admin_users' | 'tblusers';
      username: string;
      work_date: string;
      time_in: string | null;
      time_out: string | null;
      time_in_selfie_url: string | null;
      time_out_selfie_url: string | null;
      overtime_hours: string | number | null;
      overtime_status: string | null;
      employee_code: string | null;
      department: string | null;
    }>(
      `SELECT a.id, a.user_id, a.user_source, a.username, a.work_date::text AS work_date,
              a.time_in::text AS time_in, a.time_out::text AS time_out,
              a.time_in_selfie_url, a.time_out_selfie_url,
              a.overtime_hours, a.overtime_status,
              p.employee_code, p.department
       FROM pcmazing_attendance a
       LEFT JOIN pcmazing_user_payroll p
         ON p.user_id = a.user_id AND p.user_source = a.user_source
       WHERE a.work_date = $1::date
       ORDER BY a.time_in DESC NULLS LAST, a.id DESC
       LIMIT $2 OFFSET $3`,
      [date, limit, offset],
    );

    const items: AttendanceRecord[] = [];
    for (const row of result.rows) {
      const fullName = await this.resolveFullName(row.user_id, row.user_source, row.username);
      items.push({
        id: row.id,
        userId: row.user_id,
        userSource: row.user_source,
        username: row.username,
        fullName,
        workDate: row.work_date,
        timeIn: row.time_in,
        timeOut: row.time_out,
        hoursWorked: this.computeHours(row.time_in, row.time_out),
        status: !row.time_in
          ? 'incomplete'
          : row.time_out
            ? 'completed'
            : 'timed_in',
        employeeCode: row.employee_code,
        department: row.department,
        timeInSelfieUrl: row.time_in_selfie_url,
        timeOutSelfieUrl: row.time_out_selfie_url,
        overtimeHours: Number(row.overtime_hours ?? 0) || 0,
        overtimeStatus: this.normalizeOvertimeStatus(row.overtime_status),
      });
    }

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      workDate: date,
    };
  }

  async listOvertime(statusRaw?: string, pageRaw?: string, limitRaw?: string) {
    await this.ensureReady();

    const page = Math.max(1, Number(pageRaw) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitRaw) || 50));
    const offset = (page - 1) * limit;
    const status = this.normalizeOvertimeStatus(statusRaw || 'pending');
    const filterStatus = status === 'none' ? 'pending' : status;

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM pcmazing_attendance
       WHERE overtime_status = $1
         AND overtime_hours > 0`,
      [filterStatus],
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const result = await this.databaseService.query<{
      id: number;
      user_id: number;
      user_source: 'pcmazing_admin_users' | 'tblusers';
      username: string;
      work_date: string;
      time_in: string | null;
      time_out: string | null;
      overtime_hours: string | number;
      overtime_status: string;
      overtime_reviewed_at: string | null;
      overtime_review_note: string | null;
      employee_code: string | null;
      department: string | null;
    }>(
      `SELECT a.id, a.user_id, a.user_source, a.username, a.work_date::text AS work_date,
              a.time_in::text AS time_in, a.time_out::text AS time_out,
              a.overtime_hours, a.overtime_status,
              a.overtime_reviewed_at::text AS overtime_reviewed_at,
              a.overtime_review_note,
              p.employee_code, p.department
       FROM pcmazing_attendance a
       LEFT JOIN pcmazing_user_payroll p
         ON p.user_id = a.user_id AND p.user_source = a.user_source
       WHERE a.overtime_status = $1
         AND a.overtime_hours > 0
       ORDER BY a.work_date DESC, a.id DESC
       LIMIT $2 OFFSET $3`,
      [filterStatus, limit, offset],
    );

    const items: OvertimeRecord[] = [];
    for (const row of result.rows) {
      const fullName = await this.resolveFullName(row.user_id, row.user_source, row.username);
      items.push({
        id: row.id,
        userId: row.user_id,
        userSource: row.user_source,
        username: row.username,
        fullName,
        workDate: row.work_date,
        timeIn: row.time_in,
        timeOut: row.time_out,
        hoursWorked: this.computeHours(row.time_in, row.time_out),
        overtimeHours: Number(row.overtime_hours) || 0,
        overtimeStatus: this.normalizeOvertimeStatus(row.overtime_status),
        employeeCode: row.employee_code,
        department: row.department,
        overtimeReviewedAt: row.overtime_reviewed_at,
        overtimeReviewNote: row.overtime_review_note,
      });
    }

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      status: filterStatus,
    };
  }

  async reviewOvertime(
    attendanceId: number,
    status: 'approved' | 'rejected',
    note?: string,
    reviewedByUserId?: number,
  ) {
    await this.ensureReady();

    if (!Number.isFinite(attendanceId) || attendanceId <= 0) {
      throw new BadRequestException('Invalid attendance id.');
    }

    const existing = await this.databaseService.query<{
      id: number;
      overtime_hours: string | number;
      overtime_status: string;
    }>(
      `SELECT id, overtime_hours, overtime_status
       FROM pcmazing_attendance
       WHERE id = $1
       LIMIT 1`,
      [attendanceId],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new NotFoundException('Attendance record not found.');
    }
    if ((Number(row.overtime_hours) || 0) <= 0) {
      throw new BadRequestException('This attendance record has no overtime to review.');
    }

    const result = await this.databaseService.query<{
      id: number;
      overtime_status: string;
      overtime_hours: string | number;
      overtime_reviewed_at: string | null;
      overtime_review_note: string | null;
    }>(
      `UPDATE pcmazing_attendance
       SET overtime_status = $2,
           overtime_reviewed_by = $3,
           overtime_reviewed_at = NOW(),
           overtime_review_note = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, overtime_status, overtime_hours,
                 overtime_reviewed_at::text AS overtime_reviewed_at,
                 overtime_review_note`,
      [attendanceId, status, reviewedByUserId ?? null, note?.trim() || null],
    );

    const updated = result.rows[0];
    return {
      id: updated.id,
      overtimeHours: Number(updated.overtime_hours) || 0,
      overtimeStatus: this.normalizeOvertimeStatus(updated.overtime_status),
      overtimeReviewedAt: updated.overtime_reviewed_at,
      overtimeReviewNote: updated.overtime_review_note,
    };
  }

  async getOverview(workDate?: string): Promise<PayrollOverview> {
    await this.ensureReady();
    const date = workDate?.trim() || manilaWorkDate();

    const enrolled = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM pcmazing_user_payroll WHERE payroll_enabled = TRUE`,
    );

    const attendance = await this.databaseService.query<{
      timed_in: string;
      completed: string;
      still_working: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE time_in IS NOT NULL)::text AS timed_in,
         COUNT(*) FILTER (WHERE time_in IS NOT NULL AND time_out IS NOT NULL)::text AS completed,
         COUNT(*) FILTER (WHERE time_in IS NOT NULL AND time_out IS NULL)::text AS still_working
       FROM pcmazing_attendance
       WHERE work_date = $1::date`,
      [date],
    );

    const enrolledEmployees = Number(enrolled.rows[0]?.count ?? 0);
    const timedInToday = Number(attendance.rows[0]?.timed_in ?? 0);
    const completedToday = Number(attendance.rows[0]?.completed ?? 0);
    const stillWorking = Number(attendance.rows[0]?.still_working ?? 0);

    return {
      workDate: date,
      enrolledEmployees,
      timedInToday,
      completedToday,
      stillWorking,
      notYetIn: Math.max(0, enrolledEmployees - timedInToday),
    };
  }

  async listEmployees(search = ''): Promise<PayrollEmployeeRecord[]> {
    await this.ensureReady();
    const workDate = manilaWorkDate();
    const profiles = await this.databaseService.query<{
      user_id: number;
      user_source: 'pcmazing_admin_users' | 'tblusers';
      employee_code: string | null;
      department: string | null;
      position_title: string | null;
      salary_type: string | null;
      monthly_salary: string | null;
      payroll_enabled: boolean;
    }>(
      `SELECT user_id, user_source, employee_code, department, position_title, salary_type,
              monthly_salary, payroll_enabled
       FROM pcmazing_user_payroll
       WHERE payroll_enabled = TRUE
       ORDER BY employee_code NULLS LAST, user_id ASC`,
    );

    const items: PayrollEmployeeRecord[] = [];
    const needle = search.trim().toLowerCase();

    for (const row of profiles.rows) {
      const identity = await this.resolveUserIdentity(row.user_id, row.user_source);
      if (!identity) {
        continue;
      }

      const attendance = await this.getTodayAttendance(row.user_id, row.user_source, workDate);
      const todayStatus: PayrollEmployeeRecord['todayStatus'] = !attendance?.time_in
        ? 'not_started'
        : attendance.time_out
          ? 'completed'
          : 'timed_in';

      const item: PayrollEmployeeRecord = {
        userId: row.user_id,
        userSource: row.user_source,
        username: identity.username,
        fullName: identity.fullName,
        isActive: identity.isActive,
        employeeCode: row.employee_code,
        department: row.department,
        positionTitle: row.position_title,
        salaryType: this.normalizeSalaryType(row.salary_type),
        monthlySalary: row.monthly_salary == null ? null : Number(row.monthly_salary),
        payrollEnabled: Boolean(row.payroll_enabled),
        todayStatus,
        todayTimeIn: attendance?.time_in ?? null,
        todayTimeOut: attendance?.time_out ?? null,
      };

      if (needle) {
        const haystack = [
          item.fullName,
          item.username,
          item.employeeCode ?? '',
          item.department ?? '',
          item.positionTitle ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) {
          continue;
        }
      }

      items.push(item);
    }

    return items;
  }

  async getPeriodSummary(dateFromRaw?: string, dateToRaw?: string) {
    await this.ensureReady();

    const today = manilaWorkDate();
    const dateFrom = dateFromRaw?.trim() || today.slice(0, 8) + '01';
    const dateTo = dateToRaw?.trim() || today;
    if (dateFrom > dateTo) {
      throw new BadRequestException('dateFrom must be on or before dateTo.');
    }

    const employees = await this.listEmployees('');
    const attendance = await this.databaseService.query<{
      user_id: number;
      user_source: 'pcmazing_admin_users' | 'tblusers';
      work_date: string;
      time_in: string | null;
      time_out: string | null;
      overtime_hours: string | number | null;
      overtime_status: string | null;
    }>(
      `SELECT user_id, user_source, work_date::text AS work_date,
              time_in::text AS time_in, time_out::text AS time_out,
              overtime_hours, overtime_status
       FROM pcmazing_attendance
       WHERE work_date BETWEEN $1::date AND $2::date
         AND time_in IS NOT NULL
       ORDER BY work_date ASC`,
      [dateFrom, dateTo],
    );

    const byUser = new Map<string, typeof attendance.rows>();
    for (const row of attendance.rows) {
      const key = `${row.user_source}:${row.user_id}`;
      const list = byUser.get(key) ?? [];
      list.push(row);
      byUser.set(key, list);
    }

    const periodDays = this.countInclusiveDays(dateFrom, dateTo);
    const rows: PayrollPeriodRow[] = employees.map((employee) => {
      const punches = byUser.get(`${employee.userSource}:${employee.userId}`) ?? [];
      let totalHours = 0;
      let regularHours = 0;
      let daysCompleted = 0;
      let paidDayUnits = 0;
      let approvedOvertimeHours = 0;
      let pendingOvertimeHours = 0;

      for (const punch of punches) {
        const hours = this.computeHours(punch.time_in, punch.time_out);
        if (hours != null) {
          totalHours += hours;
          daysCompleted += 1;
          const units = this.dayPayUnits(hours);
          paidDayUnits += units;
          regularHours += Math.min(hours, FULL_DAY_HOURS);
          const otHours = Number(punch.overtime_hours ?? 0) || 0;
          const otStatus = this.normalizeOvertimeStatus(punch.overtime_status);
          if (otHours > 0 && otStatus === 'approved') {
            approvedOvertimeHours += otHours;
          } else if (otHours > 0 && otStatus === 'pending') {
            pendingOvertimeHours += otHours;
          }
        }
      }

      const daysPresent = punches.length;
      const estimatedPay = this.estimatePay({
        salaryType: employee.salaryType,
        salaryAmount: employee.monthlySalary,
        regularHours,
        paidDayUnits,
        periodDays,
        approvedOvertimeHours,
      });

      return {
        userId: employee.userId,
        userSource: employee.userSource,
        username: employee.username,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        department: employee.department,
        salaryType: employee.salaryType,
        salaryAmount: employee.monthlySalary,
        daysPresent,
        daysCompleted,
        paidDayUnits: Math.round(paidDayUnits * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
        approvedOvertimeHours: Math.round(approvedOvertimeHours * 100) / 100,
        pendingOvertimeHours: Math.round(pendingOvertimeHours * 100) / 100,
        estimatedPay: Math.round(estimatedPay * 100) / 100,
      };
    });

    rows.sort((a, b) => a.fullName.localeCompare(b.fullName));

    return {
      dateFrom,
      dateTo,
      periodDays,
      items: rows,
      totals: {
        employees: rows.length,
        totalHours: Math.round(rows.reduce((sum, row) => sum + row.totalHours, 0) * 100) / 100,
        approvedOvertimeHours:
          Math.round(rows.reduce((sum, row) => sum + row.approvedOvertimeHours, 0) * 100) / 100,
        pendingOvertimeHours:
          Math.round(rows.reduce((sum, row) => sum + row.pendingOvertimeHours, 0) * 100) / 100,
        estimatedPay: Math.round(rows.reduce((sum, row) => sum + row.estimatedPay, 0) * 100) / 100,
      },
    };
  }

  /**
   * Persist period pay as generated payslips so employees can see them in ESS.
   * Re-generating the same date range replaces the previous run.
   */
  async generatePayslips(
    dateFromRaw?: string,
    dateToRaw?: string,
    generatedBy?: { userId: number; username: string },
  ) {
    const summary = await this.getPeriodSummary(dateFromRaw, dateToRaw);
    const label = this.formatPeriodLabel(summary.dateFrom, summary.dateTo);

    const existing = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM pcmazing_payroll_runs
       WHERE date_from = $1::date AND date_to = $2::date
       LIMIT 1`,
      [summary.dateFrom, summary.dateTo],
    );
    const existingId = existing.rows[0]?.id;
    if (existingId != null) {
      await this.databaseService.query(`DELETE FROM pcmazing_payroll_runs WHERE id = $1`, [
        existingId,
      ]);
    }

    const run = await this.databaseService.query<{ id: number }>(
      `INSERT INTO pcmazing_payroll_runs (
         date_from, date_to, period_days, label, generated_by_user_id, generated_by_username
       ) VALUES ($1::date, $2::date, $3, $4, $5, $6)
       RETURNING id`,
      [
        summary.dateFrom,
        summary.dateTo,
        summary.periodDays,
        label,
        generatedBy?.userId ?? null,
        generatedBy?.username ?? null,
      ],
    );
    const runId = Number(run.rows[0]?.id);
    if (!Number.isFinite(runId) || runId <= 0) {
      throw new BadRequestException('Unable to create payroll run.');
    }

    for (const item of summary.items) {
      await this.databaseService.query(
        `INSERT INTO pcmazing_generated_payslips (
           run_id, user_id, user_source, username, full_name, employee_code, department,
           salary_type, salary_amount, days_present, days_completed, total_hours,
           estimated_pay, payroll_enabled
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12,
           $13, TRUE
         )`,
        [
          runId,
          item.userId,
          item.userSource,
          item.username,
          item.fullName,
          item.employeeCode,
          item.department,
          item.salaryType,
          item.salaryAmount,
          item.daysPresent,
          item.daysCompleted,
          item.totalHours,
          item.estimatedPay,
        ],
      );
    }

    return {
      runId,
      label,
      dateFrom: summary.dateFrom,
      dateTo: summary.dateTo,
      periodDays: summary.periodDays,
      employeeCount: summary.items.length,
      totals: summary.totals,
      replaced: existingId != null,
    };
  }

  /** Payslips previously generated by admin for one employee (Sales ESS). */
  async getEmployeePayslips(
    userId: number,
    userSource: AdminUserRecord['source'],
    limit = 6,
  ): Promise<EmployeePayslipItem[]> {
    await this.ensureReady();
    const capped = Math.min(Math.max(limit, 1), 24);
    const result = await this.databaseService.query<{
      id: number;
      label: string;
      date_from: string;
      date_to: string;
      period_days: number;
      days_present: number;
      days_completed: number;
      total_hours: string;
      salary_type: string | null;
      salary_amount: string | null;
      estimated_pay: string;
      payroll_enabled: boolean;
    }>(
      `SELECT p.id,
              r.label,
              r.date_from::text AS date_from,
              r.date_to::text AS date_to,
              r.period_days,
              p.days_present,
              p.days_completed,
              p.total_hours::text AS total_hours,
              p.salary_type,
              p.salary_amount::text AS salary_amount,
              p.estimated_pay::text AS estimated_pay,
              p.payroll_enabled
       FROM pcmazing_generated_payslips p
       INNER JOIN pcmazing_payroll_runs r ON r.id = p.run_id
       WHERE p.user_id = $1
         AND p.user_source = $2
       ORDER BY r.date_to DESC, r.id DESC
       LIMIT $3`,
      [userId, userSource, capped],
    );

    return result.rows.map((row) => ({
      id: String(row.id),
      label: row.label,
      dateFrom: row.date_from,
      dateTo: row.date_to,
      periodDays: Number(row.period_days) || 0,
      daysPresent: Number(row.days_present) || 0,
      daysCompleted: Number(row.days_completed) || 0,
      totalHours: Math.round(Number(row.total_hours || 0) * 100) / 100,
      salaryType: this.normalizeSalaryType(row.salary_type),
      salaryAmount: row.salary_amount == null ? null : Number(row.salary_amount),
      estimatedPay: Math.round(Number(row.estimated_pay || 0) * 100) / 100,
      payrollEnabled: Boolean(row.payroll_enabled),
    }));
  }

  async getEmployeePayslipDetail(
    payslipIdRaw: string | number,
    userId: number,
    userSource: AdminUserRecord['source'],
  ) {
    await this.ensureReady();

    const payslipId = Number(payslipIdRaw);
    if (!Number.isFinite(payslipId) || payslipId <= 0) {
      throw new BadRequestException('Invalid payslip id.');
    }

    const slipResult = await this.databaseService.query<{
      id: number;
      username: string;
      full_name: string;
      employee_code: string | null;
      department: string | null;
      position_title: string | null;
      salary_type: string | null;
      salary_amount: string | null;
      days_present: number;
      days_completed: number;
      total_hours: string;
      estimated_pay: string;
      label: string;
      date_from: string;
      date_to: string;
      period_days: number;
      created_at: string;
    }>(
      `SELECT p.id, p.username, p.full_name, p.employee_code, p.department,
              pay.position_title,
              p.salary_type, p.salary_amount::text AS salary_amount,
              p.days_present, p.days_completed, p.total_hours::text AS total_hours,
              p.estimated_pay::text AS estimated_pay,
              r.label, r.date_from::text AS date_from, r.date_to::text AS date_to,
              r.period_days, p.created_at::text AS created_at
       FROM pcmazing_generated_payslips p
       INNER JOIN pcmazing_payroll_runs r ON r.id = p.run_id
       LEFT JOIN pcmazing_user_payroll pay
         ON pay.user_id = p.user_id AND pay.user_source = p.user_source
       WHERE p.id = $1
         AND p.user_id = $2
         AND p.user_source = $3
       LIMIT 1`,
      [payslipId, userId, userSource],
    );

    const slip = slipResult.rows[0];
    if (!slip) {
      throw new NotFoundException('Payslip not found.');
    }

    const salaryType = this.normalizeSalaryType(slip.salary_type);
    const salaryAmount = slip.salary_amount == null ? null : Number(slip.salary_amount);
    const periodDays = Number(slip.period_days) || 0;
    const { dailyRate, hourlyRate } = this.resolvePayRates(salaryType, salaryAmount, periodDays);

    const attendance = await this.databaseService.query<{
      work_date: string;
      time_in: string | null;
      time_out: string | null;
      overtime_hours: string | number | null;
      overtime_status: string | null;
    }>(
      `SELECT work_date::text AS work_date,
              time_in::text AS time_in,
              time_out::text AS time_out,
              overtime_hours,
              overtime_status
       FROM pcmazing_attendance
       WHERE user_id = $1
         AND user_source = $2
         AND work_date BETWEEN $3::date AND $4::date
         AND time_in IS NOT NULL
       ORDER BY work_date ASC`,
      [userId, userSource, slip.date_from, slip.date_to],
    );

    let paidDayUnits = 0;
    let regularHours = 0;
    let totalHours = 0;
    let daysCompleted = 0;
    let approvedOvertimeHours = 0;
    let pendingOvertimeHours = 0;
    let overtimePayTotal = 0;

    const days = attendance.rows.map((row) => {
      const hours = this.computeHours(row.time_in, row.time_out);
      const units = this.dayPayUnits(hours);
      const otHours = Number(row.overtime_hours ?? 0) || 0;
      const otStatus = this.normalizeOvertimeStatus(row.overtime_status);
      const dayPay = Math.round(units * dailyRate * 100) / 100;
      const overtimePay =
        otHours > 0 && otStatus === 'approved'
          ? Math.round(otHours * hourlyRate * OVERTIME_MULTIPLIER * 100) / 100
          : 0;

      if (hours != null) {
        daysCompleted += 1;
        totalHours += hours;
        paidDayUnits += units;
        regularHours += Math.min(hours, FULL_DAY_HOURS);
        if (otHours > 0 && otStatus === 'approved') {
          approvedOvertimeHours += otHours;
          overtimePayTotal += overtimePay;
        } else if (otHours > 0 && otStatus === 'pending') {
          pendingOvertimeHours += otHours;
        }
      }

      return {
        workDate: row.work_date,
        timeInLabel: this.formatPunchLabel(row.time_in),
        timeOutLabel: this.formatPunchLabel(row.time_out),
        hoursWorked: hours ?? 0,
        dayType: this.dayPayLabel(units, hours),
        paidUnits: units,
        dayPay,
        overtimeHours: otHours,
        overtimeStatus: otStatus,
        overtimePay,
      };
    });

    const basePay =
      Math.round(
        this.estimatePay({
          salaryType,
          salaryAmount,
          regularHours,
          paidDayUnits,
          periodDays,
          approvedOvertimeHours: 0,
        }) * 100,
      ) / 100;
    const estimatedPay =
      Math.round(
        this.estimatePay({
          salaryType,
          salaryAmount,
          regularHours,
          paidDayUnits,
          periodDays,
          approvedOvertimeHours,
        }) * 100,
      ) / 100;

    const generatedAt = new Date(slip.created_at).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const pdfPayload: PayslipPdfPayload = {
      companyName: 'PCmazing',
      label: slip.label,
      dateFrom: slip.date_from,
      dateTo: slip.date_to,
      generatedAt,
      employee: {
        fullName: slip.full_name,
        positionTitle: slip.position_title,
      },
      days,
      totals: {
        daysPresent: attendance.rows.length,
        daysCompleted,
        paidDayUnits: Math.round(paidDayUnits * 100) / 100,
        totalHours: Math.round(totalHours * 100) / 100,
        approvedOvertimeHours: Math.round(approvedOvertimeHours * 100) / 100,
        pendingOvertimeHours: Math.round(pendingOvertimeHours * 100) / 100,
        basePay,
        overtimePay: Math.round(overtimePayTotal * 100) / 100,
        estimatedPay,
      },
    };

    const safeLabel = slip.label.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_');
    return {
      id: String(slip.id),
      label: slip.label,
      dateFrom: slip.date_from,
      dateTo: slip.date_to,
      generatedAt,
      employee: {
        fullName: slip.full_name,
        positionTitle: slip.position_title,
        username: slip.username,
        employeeCode: slip.employee_code,
        department: slip.department,
      },
      days: pdfPayload.days,
      totals: pdfPayload.totals,
      filename: `payslip-${safeLabel}-${slip.username}.pdf`,
      pdfPayload,
    };
  }

  async buildEmployeePayslipPdf(
    payslipIdRaw: string | number,
    userId: number,
    userSource: AdminUserRecord['source'],
  ): Promise<{ filename: string; buffer: Buffer }> {
    const detail = await this.getEmployeePayslipDetail(payslipIdRaw, userId, userSource);
    const buffer = await buildPayslipPdfBuffer(detail.pdfPayload);
    return {
      filename: detail.filename,
      buffer,
    };
  }

  private resolvePayRates(
    salaryType: PayrollSalaryType,
    salaryAmount: number | null,
    periodDays: number,
  ): { dailyRate: number; hourlyRate: number } {
    const amount = salaryAmount == null || salaryAmount <= 0 ? 0 : salaryAmount;
    switch (salaryType) {
      case 'weekly': {
        const hourlyRate = amount / 40;
        return { dailyRate: hourlyRate * FULL_DAY_HOURS, hourlyRate };
      }
      case 'semi_monthly':
        return { dailyRate: amount, hourlyRate: amount / FULL_DAY_HOURS };
      case 'cutoff': {
        const dailyRate = periodDays > 0 ? amount / periodDays : 0;
        return { dailyRate, hourlyRate: dailyRate / FULL_DAY_HOURS };
      }
      case 'monthly':
      default: {
        const dailyRate = amount / 22;
        return { dailyRate, hourlyRate: dailyRate / FULL_DAY_HOURS };
      }
    }
  }

  private dayPayLabel(units: number, hours: number | null): string {
    if (hours == null) {
      return 'Incomplete';
    }
    if (units >= 1) {
      return 'Full day';
    }
    if (units >= 0.5) {
      return 'Half day';
    }
    return 'Unpaid';
  }

  private salaryTypeLabel(value: PayrollSalaryType): string {
    switch (value) {
      case 'weekly':
        return 'Weekly';
      case 'semi_monthly':
        return 'Semi-Monthly';
      case 'cutoff':
        return 'By Cutoff';
      default:
        return 'Monthly';
    }
  }

  private formatPunchLabel(value: string | null): string {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleTimeString('en-PH', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private formatPeriodLabel(dateFrom: string, dateTo: string): string {
    const [fromYear, fromMonth, fromDay] = dateFrom.split('-').map(Number);
    const [, , toDay] = dateTo.split('-').map(Number);
    const monthLabel = new Date(Date.UTC(fromYear, fromMonth - 1, 1)).toLocaleString('en-PH', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });

    if (dateFrom === dateTo) {
      return `${monthLabel} · ${fromDay}`;
    }

    const lastDay = new Date(Date.UTC(fromYear, fromMonth, 0)).getUTCDate();
    if (fromDay === 1 && toDay === 15 && dateFrom.slice(0, 7) === dateTo.slice(0, 7)) {
      return `${monthLabel} · 1–15`;
    }
    if (fromDay === 16 && toDay === lastDay && dateFrom.slice(0, 7) === dateTo.slice(0, 7)) {
      return `${monthLabel} · 16–${lastDay}`;
    }

    return `${dateFrom} → ${dateTo}`;
  }

  async getServerClock(): Promise<{ serverNow: string; workDate: string }> {
    const result = await this.databaseService.query<{
      server_now: Date | string;
      work_date: string;
    }>(
      `SELECT NOW() AS server_now,
              (timezone('Asia/Manila', NOW()))::date::text AS work_date`,
    );

    const row = result.rows[0];
    const serverNow =
      row?.server_now instanceof Date
        ? row.server_now.toISOString()
        : new Date(row?.server_now ?? Date.now()).toISOString();

    return {
      serverNow,
      workDate: row?.work_date || manilaWorkDate(),
    };
  }

  async getTimeClockStatus(usernameRaw: string): Promise<TimeClockStatus> {
    await this.ensureReady();
    const clock = await this.getServerClock();
    const workDate = clock.workDate;
    const username = usernameRaw.trim();

    const user = await this.findActiveUserByUsername(username);
    if (!user) {
      return {
        username,
        fullName: '',
        employeeCode: null,
        workDate,
        timeIn: null,
        timeOut: null,
        canTimeIn: false,
        canTimeOut: false,
        status: 'not_found',
        message: 'Username not found.',
        serverNow: clock.serverNow,
      };
    }

    if (!user.isActive) {
      return {
        username: user.username,
        fullName: user.fullName,
        employeeCode: null,
        workDate,
        timeIn: null,
        timeOut: null,
        canTimeIn: false,
        canTimeOut: false,
        status: 'inactive',
        message: 'This account is inactive.',
        serverNow: clock.serverNow,
      };
    }

    const profile = await this.getProfile(user.id, user.source);
    if (!profile.payrollEnabled) {
      return {
        username: user.username,
        fullName: user.fullName,
        employeeCode: profile.employeeCode,
        workDate,
        timeIn: null,
        timeOut: null,
        canTimeIn: false,
        canTimeOut: false,
        status: 'not_enrolled',
        message: 'This user is not enabled for payroll time clock.',
        serverNow: clock.serverNow,
      };
    }

    const attendance = await this.getTodayAttendance(user.id, user.source, workDate);
    if (!attendance?.time_in) {
      return {
        username: user.username,
        fullName: user.fullName,
        employeeCode: profile.employeeCode,
        workDate,
        timeIn: null,
        timeOut: null,
        canTimeIn: true,
        canTimeOut: false,
        status: 'ready',
        message: 'Ready to time in.',
        serverNow: clock.serverNow,
      };
    }

    if (!attendance.time_out) {
      return {
        username: user.username,
        fullName: user.fullName,
        employeeCode: profile.employeeCode,
        workDate,
        timeIn: attendance.time_in,
        timeOut: null,
        canTimeIn: false,
        canTimeOut: true,
        status: 'timed_in',
        message: 'Already timed in. Use time out when leaving.',
        serverNow: clock.serverNow,
      };
    }

    return {
      username: user.username,
      fullName: user.fullName,
      employeeCode: profile.employeeCode,
      workDate,
      timeIn: attendance.time_in,
      timeOut: attendance.time_out,
      canTimeIn: false,
      canTimeOut: false,
      status: 'completed',
      message: 'Time in and time out are already recorded for today.',
      serverNow: clock.serverNow,
    };
  }

  async timeIn(usernameRaw: string, selfie: Express.Multer.File): Promise<TimeClockStatus> {
    const status = await this.getTimeClockStatus(usernameRaw);
    if (status.status === 'not_found') {
      throw new NotFoundException(status.message);
    }
    if (!status.canTimeIn) {
      throw new BadRequestException(status.message);
    }

    const user = await this.findActiveUserByUsername(usernameRaw);
    if (!user) {
      throw new NotFoundException('Username not found.');
    }

    const selfieUrl = await saveAttendanceSelfieFile('in', user.username, selfie);
    const workDate = status.workDate;
    await this.databaseService.query(
      `INSERT INTO pcmazing_attendance (user_id, user_source, username, work_date, time_in, time_in_selfie_url)
       VALUES ($1, $2, $3, $4::date, NOW(), $5)
       ON CONFLICT (user_id, user_source, work_date) DO UPDATE SET
         time_in = COALESCE(pcmazing_attendance.time_in, EXCLUDED.time_in),
         time_in_selfie_url = COALESCE(pcmazing_attendance.time_in_selfie_url, EXCLUDED.time_in_selfie_url),
         username = EXCLUDED.username,
         updated_at = NOW()
       WHERE pcmazing_attendance.time_in IS NULL`,
      [user.id, user.source, user.username, workDate, selfieUrl],
    );

    const refreshed = await this.getTimeClockStatus(user.username);
    if (refreshed.status !== 'timed_in' && refreshed.status !== 'completed') {
      throw new BadRequestException('Unable to record time in. You may already be timed in.');
    }

    return refreshed;
  }

  async timeOut(usernameRaw: string, selfie: Express.Multer.File): Promise<TimeClockStatus> {
    const status = await this.getTimeClockStatus(usernameRaw);
    if (status.status === 'not_found') {
      throw new NotFoundException(status.message);
    }
    if (!status.canTimeOut) {
      throw new BadRequestException(status.message);
    }

    const user = await this.findActiveUserByUsername(usernameRaw);
    if (!user) {
      throw new NotFoundException('Username not found.');
    }

    const selfieUrl = await saveAttendanceSelfieFile('out', user.username, selfie);
    const workDate = status.workDate;
    const result = await this.databaseService.query<{
      id: number;
      time_in: string | null;
      time_out: string | null;
    }>(
      `UPDATE pcmazing_attendance
       SET time_out = NOW(),
           time_out_selfie_url = $4,
           updated_at = NOW()
       WHERE user_id = $1
         AND user_source = $2
         AND work_date = $3::date
         AND time_in IS NOT NULL
         AND time_out IS NULL
       RETURNING id, time_in::text AS time_in, time_out::text AS time_out`,
      [user.id, user.source, workDate, selfieUrl],
    );

    const punched = result.rows[0];
    if (!punched) {
      throw new BadRequestException('Unable to record time out.');
    }

    const hours = this.computeHours(punched.time_in, punched.time_out) ?? 0;
    const overtimeHours =
      hours > FULL_DAY_HOURS ? Math.round((hours - FULL_DAY_HOURS) * 100) / 100 : 0;

    // Eligible OT is stored but stays 'none' until the employee requests approval in their portal.
    await this.databaseService.query(
      `UPDATE pcmazing_attendance
       SET overtime_hours = $2,
           overtime_status = 'none',
           overtime_reviewed_by = NULL,
           overtime_reviewed_at = NULL,
           overtime_review_note = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [punched.id, overtimeHours],
    );

    return this.getTimeClockStatus(user.username);
  }

  async requestOvertime(
    userId: number,
    userSource: AdminUserRecord['source'],
    attendanceId: number,
  ) {
    await this.ensureReady();

    if (!Number.isFinite(attendanceId) || attendanceId <= 0) {
      throw new BadRequestException('Invalid attendance id.');
    }

    const existing = await this.databaseService.query<{
      id: number;
      overtime_hours: string | number;
      overtime_status: string;
      time_in: string | null;
      time_out: string | null;
      work_date: string;
    }>(
      `SELECT id, overtime_hours, overtime_status,
              time_in::text AS time_in, time_out::text AS time_out,
              work_date::text AS work_date
       FROM pcmazing_attendance
       WHERE id = $1
         AND user_id = $2
         AND user_source = $3
       LIMIT 1`,
      [attendanceId, userId, userSource],
    );

    const row = existing.rows[0];
    if (!row) {
      throw new NotFoundException('Attendance record not found.');
    }

    const hours = this.computeHours(row.time_in, row.time_out) ?? 0;
    const overtimeHours =
      hours > FULL_DAY_HOURS
        ? Math.round((hours - FULL_DAY_HOURS) * 100) / 100
        : Number(row.overtime_hours) || 0;

    if (overtimeHours <= 0) {
      throw new BadRequestException(
        `Overtime can only be requested when you work more than ${FULL_DAY_HOURS} hours.`,
      );
    }

    const currentStatus = this.normalizeOvertimeStatus(row.overtime_status);
    if (currentStatus === 'pending') {
      throw new BadRequestException('Overtime approval is already pending.');
    }
    if (currentStatus === 'approved') {
      throw new BadRequestException('Overtime for this day is already approved.');
    }

    const result = await this.databaseService.query<{
      id: number;
      overtime_hours: string | number;
      overtime_status: string;
      work_date: string;
    }>(
      `UPDATE pcmazing_attendance
       SET overtime_hours = $2,
           overtime_status = 'pending',
           overtime_reviewed_by = NULL,
           overtime_reviewed_at = NULL,
           overtime_review_note = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, overtime_hours, overtime_status, work_date::text AS work_date`,
      [attendanceId, overtimeHours],
    );

    const updated = result.rows[0];
    return {
      id: updated.id,
      workDate: updated.work_date,
      overtimeHours: Number(updated.overtime_hours) || 0,
      overtimeStatus: this.normalizeOvertimeStatus(updated.overtime_status),
      message: 'Overtime request submitted. Waiting for admin approval.',
    };
  }

  private async getTodayAttendance(
    userId: number,
    userSource: AdminUserRecord['source'],
    workDate: string,
  ) {
    const result = await this.databaseService.query<{
      time_in: string | null;
      time_out: string | null;
    }>(
      `SELECT time_in::text AS time_in, time_out::text AS time_out
       FROM pcmazing_attendance
       WHERE user_id = $1 AND user_source = $2 AND work_date = $3::date
       LIMIT 1`,
      [userId, userSource, workDate],
    );

    return result.rows[0] ?? null;
  }

  private async findActiveUserByUsername(username: string): Promise<AdminUserRecord | null> {
    const trimmed = username.trim();
    if (!trimmed) {
      return null;
    }

    if (await usesTblusers(this.databaseService)) {
      const result = await this.databaseService.query<{
        id: number;
        username: string;
        fullname: string | null;
        email: string | null;
        rolename: string | null;
        avatar: string | null;
        status: number | null;
        created_at: string | null;
        updated_at: string | null;
      }>(
        `${buildTblusersSelectSql()}
         WHERE LOWER(TRIM(u.username)) = LOWER(TRIM($1))
           AND ${ACTIVE_FILTER_SQL}
         LIMIT 1`,
        [trimmed],
      );

      return result.rows[0] ? mapTblusersRow(result.rows[0]) : null;
    }

    await ensureUserManagementTable(this.databaseService);
    const result = await this.databaseService.query<{
      id: number;
      username: string;
      full_name: string;
      email: string | null;
      role: string;
      profile_image_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, username, full_name, email, role, profile_image_url, is_active, created_at,
              COALESCE(updated_at, created_at) AS updated_at
       FROM pcmazing_admin_users
       WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
       LIMIT 1`,
      [trimmed],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      profileImageUrl: row.profile_image_url,
      isActive: row.is_active,
      source: 'pcmazing_admin_users',
      readOnly: false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async resolveFullName(
    userId: number,
    userSource: AdminUserRecord['source'],
    fallbackUsername: string,
  ): Promise<string> {
    try {
      if (userSource === 'tblusers') {
        const result = await this.databaseService.query<{ fullname: string | null }>(
          `SELECT COALESCE(
             to_jsonb(u)->>'fullname',
             to_jsonb(u)->>'fullName',
             to_jsonb(u)->>'full_name',
             u.username
           ) AS fullname
           FROM tblusers u
           WHERE u.id = $1
           LIMIT 1`,
          [userId],
        );
        return result.rows[0]?.fullname?.trim() || fallbackUsername;
      }

      const result = await this.databaseService.query<{ full_name: string }>(
        `SELECT full_name FROM pcmazing_admin_users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      return result.rows[0]?.full_name?.trim() || fallbackUsername;
    } catch {
      return fallbackUsername;
    }
  }

  private mapProfile(row: {
    employee_code: string | null;
    department: string | null;
    position_title: string | null;
    salary_type?: string | null;
    monthly_salary: string | null;
    payroll_enabled: boolean;
  }): PayrollProfile {
    return {
      employeeCode: row.employee_code,
      department: row.department,
      positionTitle: row.position_title,
      salaryType: this.normalizeSalaryType(row.salary_type),
      monthlySalary: row.monthly_salary == null ? null : Number(row.monthly_salary),
      payrollEnabled: Boolean(row.payroll_enabled),
    };
  }

  private normalizeSalaryType(value?: string | null): PayrollSalaryType {
    switch ((value ?? '').trim().toLowerCase()) {
      case 'weekly':
        return 'weekly';
      case 'semi_monthly':
      case 'semi-monthly':
      case 'semimonthly':
        return 'semi_monthly';
      case 'cutoff':
        return 'cutoff';
      default:
        return 'monthly';
    }
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

  private countInclusiveDays(dateFrom: string, dateTo: string): number {
    const start = new Date(`${dateFrom}T00:00:00+08:00`).getTime();
    const end = new Date(`${dateTo}T00:00:00+08:00`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return 0;
    }

    return Math.floor((end - start) / 86_400_000) + 1;
  }

  private estimatePay(input: {
    salaryType: PayrollSalaryType;
    salaryAmount: number | null;
    regularHours: number;
    paidDayUnits: number;
    periodDays: number;
    approvedOvertimeHours: number;
  }): number {
    const amount = input.salaryAmount;
    if (amount == null || amount <= 0) {
      return 0;
    }

    let basePay = 0;
    let hourlyRate = 0;

    switch (input.salaryType) {
      case 'weekly': {
        hourlyRate = amount / 40;
        basePay = input.regularHours * hourlyRate;
        break;
      }
      case 'semi_monthly': {
        // Amount is the daily rate. Full day (9h+) = 1×, half day (4–<9h) = 0.5×.
        basePay = input.paidDayUnits * amount;
        hourlyRate = amount / FULL_DAY_HOURS;
        break;
      }
      case 'cutoff': {
        // Salary amount is the full pay for the selected cutoff date range.
        if (input.periodDays <= 0) {
          return 0;
        }
        const daily = amount / input.periodDays;
        basePay = input.paidDayUnits * daily;
        hourlyRate = daily / FULL_DAY_HOURS;
        break;
      }
      case 'monthly':
      default: {
        const daily = amount / 22;
        basePay = input.paidDayUnits * daily;
        hourlyRate = daily / FULL_DAY_HOURS;
        break;
      }
    }

    const overtimePay =
      input.approvedOvertimeHours > 0 && hourlyRate > 0
        ? input.approvedOvertimeHours * hourlyRate * OVERTIME_MULTIPLIER
        : 0;

    return basePay + overtimePay;
  }

  /**
   * Full day (≥9h) = 1.0 unit.
   * Half day (≥4h and &lt;9h, including 4.5h) = 0.5 unit.
   * Below 4h = unpaid.
   */
  private dayPayUnits(hours: number | null | undefined): number {
    if (hours == null || !Number.isFinite(hours) || hours <= 0) {
      return 0;
    }
    if (hours >= FULL_DAY_HOURS) {
      return 1;
    }
    if (hours >= HALF_DAY_MIN_HOURS) {
      return 0.5;
    }
    return 0;
  }

  private normalizeOvertimeStatus(value: string | null | undefined): OvertimeStatus {
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

  private async resolveUserIdentity(
    userId: number,
    userSource: AdminUserRecord['source'],
  ): Promise<{ username: string; fullName: string; isActive: boolean } | null> {
    try {
      if (userSource === 'tblusers') {
        const result = await this.databaseService.query<{
          username: string;
          fullname: string | null;
          status: number | null;
        }>(
          `SELECT u.username,
                  COALESCE(
                    to_jsonb(u)->>'fullname',
                    to_jsonb(u)->>'fullName',
                    to_jsonb(u)->>'full_name',
                    u.username
                  ) AS fullname,
                  CASE
                    WHEN to_jsonb(u) ? 'status' THEN NULLIF(to_jsonb(u)->>'status', '')::int
                    ELSE 1
                  END AS status
           FROM tblusers u
           WHERE u.id = $1
           LIMIT 1`,
          [userId],
        );
        const row = result.rows[0];
        if (!row) {
          return null;
        }

        return {
          username: row.username,
          fullName: row.fullname?.trim() || row.username,
          isActive: row.status == null ? true : Number(row.status) !== 0,
        };
      }

      const result = await this.databaseService.query<{
        username: string;
        full_name: string;
        is_active: boolean;
      }>(
        `SELECT username, full_name, is_active
         FROM pcmazing_admin_users
         WHERE id = $1
         LIMIT 1`,
        [userId],
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return {
        username: row.username,
        fullName: row.full_name,
        isActive: Boolean(row.is_active),
      };
    } catch {
      return null;
    }
  }
}
