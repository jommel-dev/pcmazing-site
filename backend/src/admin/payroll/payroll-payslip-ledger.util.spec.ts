import { assemblePayslipLedger } from './payroll-payslip-ledger.util';

describe('assemblePayslipLedger', () => {
  const settings = {
    shiftStartTime: '09:00',
    lateGraceMinutes: 15,
    lateDeductionFixed: 50,
    lateDeductionPerMinute: 2,
  };

  it('assembles commissions, deductions, one late line per day, and loan overrides', () => {
    const result = assemblePayslipLedger({
      basePay: 10_000,
      overtimePay: 500,
      settings,
      commissions: [
        { id: 1, label: 'Enterprise sale', typeName: 'Sales', amount: 1_000 },
      ],
      manualDeductions: [{ id: 2, label: 'Uniform', amount: 250 }],
      attendance: [
        {
          workDate: '2026-10-08',
          timeIn: '2026-10-08T01:30:00.000Z',
        },
      ],
      loans: [
        {
          id: 3,
          balance: 2_000,
          termStyle: 'fixed_per_cutoff',
          installmentCount: null,
          fixedInstallmentAmount: 500,
          override: { action: 'custom', customAmount: 300 },
        },
      ],
    });

    expect(result.lines).toEqual([
      expect.objectContaining({
        lineType: 'commission',
        label: 'Enterprise sale',
        amount: 1_000,
        source: 'manual',
      }),
      expect.objectContaining({
        lineType: 'manual_deduction',
        label: 'Uniform',
        amount: 250,
        source: 'manual',
      }),
      expect.objectContaining({
        lineType: 'late_deduction',
        amount: 80,
        source: 'auto',
        meta: expect.objectContaining({
          workDate: '2026-10-08',
          minutesLate: 15,
        }),
      }),
      expect.objectContaining({
        lineType: 'loan_deduction',
        amount: 300,
        source: 'override',
        meta: expect.objectContaining({ loanId: 3 }),
      }),
    ]);
    expect(result.net).toEqual(
      expect.objectContaining({
        grossPay: 11_500,
        totalDeductions: 630,
        netPay: 10_870,
      }),
    );
    expect(result.loanDeductions).toEqual([{ loanId: 3, amount: 300 }]);
  });

  it('omits on-time punches and skipped loans', () => {
    const result = assemblePayslipLedger({
      basePay: 100,
      overtimePay: 0,
      settings,
      commissions: [],
      manualDeductions: [],
      attendance: [
        { workDate: '2026-10-08', timeIn: '2026-10-08T01:10:00.000Z' },
      ],
      loans: [
        {
          id: 3,
          balance: 2_000,
          termStyle: 'fixed_per_cutoff',
          installmentCount: null,
          fixedInstallmentAmount: 500,
          override: { action: 'skip' },
        },
      ],
    });

    expect(result.lines).toEqual([]);
    expect(result.net.netPay).toBe(100);
    expect(result.loanDeductions).toEqual([]);
  });

  it('omits late deductions on rest days and plotted days off', () => {
    const result = assemblePayslipLedger({
      basePay: 100,
      overtimePay: 0,
      settings,
      commissions: [],
      manualDeductions: [],
      attendance: [
        { workDate: '2026-10-10', timeIn: '2026-10-10T01:30:00.000Z' },
        { workDate: '2026-10-11', timeIn: '2026-10-11T01:30:00.000Z' },
        { workDate: '2026-10-12', timeIn: '2026-10-12T01:30:00.000Z' },
      ],
      lateExcludedDates: new Set(['2026-10-10', '2026-10-11']),
      loans: [],
    });

    expect(result.lines).toEqual([
      expect.objectContaining({
        lineType: 'late_deduction',
        meta: expect.objectContaining({ workDate: '2026-10-12' }),
      }),
    ]);
  });
});
