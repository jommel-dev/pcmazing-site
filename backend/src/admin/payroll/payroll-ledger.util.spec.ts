import {
  computeLateMinutes,
  computeLateDeduction,
  computeEqualInstallmentAmount,
  computeLoanPeriodAmount,
  computePayslipNet,
} from './payroll-ledger.util';

describe('payroll-ledger.util', () => {
  it('late minutes after grace', () => {
    // workDate 2026-10-08, shift 09:00, grace 15 → late after 09:15
    const timeIn = new Date('2026-10-08T01:30:00.000Z'); // adjust to project TZ handling — use same convention as attendance
    expect(computeLateMinutes(timeIn, '2026-10-08', '09:00', 15)).toBeGreaterThan(0);
  });
  it('on-time is zero', () => {
    expect(computeLateDeduction(0, 50, 2)).toBe(0);
  });
  it('late deduction fixed + per minute', () => {
    expect(computeLateDeduction(10, 50, 2)).toBe(70);
  });
  it('equal installment rounds money', () => {
    expect(computeEqualInstallmentAmount(6000, 6)).toBe(1000);
  });
  it('skip loan returns 0', () => {
    expect(
      computeLoanPeriodAmount({
        balance: 3000,
        termStyle: 'fixed_per_cutoff',
        installmentCount: null,
        fixedInstallmentAmount: 500,
        override: { action: 'skip' },
      }),
    ).toBe(0);
  });
  it('net floors at 0', () => {
    const r = computePayslipNet({
      basePay: 100,
      overtimePay: 0,
      lines: [
        { lineType: 'manual_deduction', label: 'x', amount: 500, source: 'manual' },
      ],
    });
    expect(r.netPay).toBe(0);
    expect(r.totalDeductions).toBe(500);
  });
});
