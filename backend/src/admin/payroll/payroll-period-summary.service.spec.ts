import { DatabaseService } from '../../database/database.service';
import {
  PayrollPeriodRow,
  PayrollService,
  PayrollSettings,
} from './payroll.service';

describe('PayrollService period summary', () => {
  const settings: PayrollSettings = {
    workWeek: 'mon_fri',
    undertimeGraceMinutes: 30,
    shiftStartTime: '09:00',
    lateGraceMinutes: 15,
    lateDeductionFixed: 50,
    lateDeductionPerMinute: 2,
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
    overtimePay: 500,
    estimatedPay: 10_500,
    payslipPeriod: 'semi_monthly',
    periodDateFrom: '2026-10-01',
    periodDateTo: '2026-10-15',
  };

  it('includes assembled ledger totals and exact-period payslip metadata', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM pcmazing_generated_payslips')) {
        return {
          rows: [
            {
              id: '99',
              user_id: '4',
              user_source: 'pcmazing_admin_users',
              estimated_pay: '10500.00',
              remarks: 'Great work',
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const service = new PayrollService({
      query,
    } as unknown as DatabaseService);
    jest.spyOn(service, 'ensureReady').mockResolvedValue();
    jest.spyOn(service, 'getSettings').mockResolvedValue(settings);
    const assembleLedgerForPeriod = jest.fn().mockResolvedValue({
      lines: [],
      net: {
        commissionsTotal: 1_000,
        lateTotal: 80,
        loanTotal: 300,
        manualTotal: 250,
        grossPay: 11_500,
        totalDeductions: 630,
        netPay: 10_870,
      },
      loanDeductions: [],
    });
    Object.assign(service as unknown as Record<string, unknown>, {
      computeRunRows: jest.fn().mockResolvedValue({
        rows: [row],
        totals: { employees: 1, estimatedPay: 10_500 },
        dayOffsByUser: new Map([
          ['pcmazing_admin_users:4', new Set(['2026-10-08'])],
        ]),
      }),
      findOverlappingPayslips: jest.fn().mockResolvedValue([]),
      assembleLedgerForPeriod,
    });

    const result = await service.getPeriodSummary(
      '2026-10-01',
      '2026-10-15',
      'semi_monthly',
    );

    expect(result.items).toEqual([
      expect.objectContaining({
        commissionsTotal: 1_000,
        totalDeductions: 630,
        netPay: 10_870,
        payslipId: 99,
        deductionsExceedGross: false,
        regenerationNeeded: true,
        remarks: 'Great work',
      }),
    ]);
    expect(assembleLedgerForPeriod).toHaveBeenCalledWith(
      expect.any(Function),
      row,
      '2026-10-01',
      '2026-10-15',
      settings,
      false,
      new Set(['2026-10-08']),
    );
    expect(query.mock.calls[0]?.[1]).toEqual([
      '2026-10-01',
      '2026-10-15',
    ]);
  });

  it('flags deductions that exceed gross pay', async () => {
    const service = new PayrollService({
      query: jest.fn(async () => ({ rows: [] })),
    } as unknown as DatabaseService);
    jest.spyOn(service, 'ensureReady').mockResolvedValue();
    jest.spyOn(service, 'getSettings').mockResolvedValue(settings);
    Object.assign(service as unknown as Record<string, unknown>, {
      computeRunRows: jest.fn().mockResolvedValue({
        rows: [row],
        totals: { employees: 1, estimatedPay: 10_500 },
        dayOffsByUser: new Map(),
      }),
      findOverlappingPayslips: jest.fn().mockResolvedValue([]),
      assembleLedgerForPeriod: jest.fn().mockResolvedValue({
        lines: [],
        net: {
          commissionsTotal: 0,
          lateTotal: 0,
          loanTotal: 11_000,
          manualTotal: 0,
          grossPay: 10_500,
          totalDeductions: 11_000,
          netPay: 0,
        },
        loanDeductions: [],
      }),
    });

    const result = await service.getPeriodSummary(
      '2026-10-01',
      '2026-10-15',
      'semi_monthly',
    );

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        grossPay: 10_500,
        deductionsExceedGross: true,
      }),
    );
  });
});
