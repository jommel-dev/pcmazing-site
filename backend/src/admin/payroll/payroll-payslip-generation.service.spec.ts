import { DatabaseService } from '../../database/database.service';
import {
  PayrollPeriodRow,
  PayrollService,
  PayrollSettings,
} from './payroll.service';

describe('PayrollService payslip generation', () => {
  const settings: PayrollSettings = {
    workWeek: 'mon_fri',
    undertimeGraceMinutes: 30,
    shiftStartTime: '09:00',
    lateGraceMinutes: 15,
    lateDeductionFixed: 0,
    lateDeductionPerMinute: 0,
  };
  const row: PayrollPeriodRow = {
    userId: 4,
    userSource: 'pcmazing_admin_users',
    username: 'employee',
    fullName: 'Employee',
    employeeCode: 'EMP-4',
    department: 'Support',
    salaryType: 'semi_monthly',
    salaryAmount: 20_000,
    fixedMonthlySalary: 20_000,
    daysPresent: 10,
    daysCompleted: 10,
    paidDayUnits: 10,
    totalHours: 80,
    approvedOvertimeHours: 0,
    pendingOvertimeHours: 0,
    basePay: 10_000,
    overtimePay: 0,
    estimatedPay: 10_000,
    payslipPeriod: 'semi_monthly',
    periodDateFrom: '2026-10-01',
    periodDateTo: '2026-10-15',
  };

  it('keeps payslip upsert and locked ledger replacement in one transaction', async () => {
    const outsideQuery = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT id FROM pcmazing_payroll_runs')) {
        return { rows: [{ id: 12 }] };
      }
      if (sql.includes('UPDATE pcmazing_payroll_runs')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO pcmazing_generated_payslips')) {
        return { rows: [{ id: 99 }] };
      }
      throw new Error(`Unexpected outside-transaction query: ${sql}`);
    });
    const transactionQuery = jest.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO pcmazing_generated_payslips')) {
        return { rows: [{ id: 99 }] };
      }
      if (
        sql.includes('FROM pcmazing_generated_payslips') &&
        sql.includes('FOR UPDATE')
      ) {
        return { rows: [{ id: 99 }] };
      }
      if (sql.includes('DELETE FROM pcmazing_payroll_payslip_ledger')) {
        throw new Error('ledger replace failed');
      }
      if (sql.includes('FROM pcmazing_payroll_payslip_ledger')) {
        return { rows: [] };
      }
      if (
        sql.includes('FROM pcmazing_payroll_commission_entries') ||
        sql.includes('FROM pcmazing_payroll_manual_deductions') ||
        sql.includes('FROM pcmazing_attendance') ||
        sql.includes('FROM pcmazing_payroll_loans')
      ) {
        return { rows: [] };
      }
      return { rows: [] };
    });
    const withTransaction = jest.fn(
      async (
        callback: (client: {
          query: typeof transactionQuery;
        }) => Promise<unknown>,
      ) => callback({ query: transactionQuery }),
    );
    const service = new PayrollService({
      query: outsideQuery,
      withTransaction,
    } as unknown as DatabaseService);
    jest.spyOn(service, 'getSettings').mockResolvedValue(settings);
    Object.assign(service as unknown as Record<string, unknown>, {
      findOverlappingPayslips: jest.fn().mockResolvedValue([]),
      computeRunRows: jest.fn().mockResolvedValue({ rows: [row], totals: {} }),
    });

    await expect(
      service.generatePayslips(
        '2026-10-01',
        '2026-10-15',
        undefined,
        undefined,
        'semi_monthly',
      ),
    ).rejects.toThrow('ledger replace failed');

    const outsideSql = outsideQuery.mock.calls.map(([sql]) => sql).join('\n');
    const transactionSql = transactionQuery.mock.calls.map(([sql]) => sql);
    const lockIndex = transactionSql.findIndex(
      (sql) =>
        sql.includes('FROM pcmazing_generated_payslips') &&
        sql.includes('FOR UPDATE'),
    );
    const priorLedgerIndex = transactionSql.findIndex((sql) =>
      sql.includes('FROM pcmazing_payroll_payslip_ledger'),
    );

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(outsideSql).not.toContain('INSERT INTO pcmazing_generated_payslips');
    expect(transactionSql.join('\n')).toContain(
      'INSERT INTO pcmazing_generated_payslips',
    );
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(priorLedgerIndex).toBeGreaterThan(lockIndex);
  });
});
