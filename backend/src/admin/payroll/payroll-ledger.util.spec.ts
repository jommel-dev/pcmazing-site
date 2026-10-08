import {
  computeLateMinutes,
  computeLateDeduction,
  computeEqualInstallmentAmount,
  computeLoanPeriodAmount,
  computePayslipNet,
} from './payroll-ledger.util';

describe('payroll-ledger.util', () => {
  it('late minutes after grace', () => {
    // 2026-10-08T01:30:00Z = 09:30 Asia/Manila; shift 09:00 + 15 grace → 15 min late
    const timeIn = new Date('2026-10-08T01:30:00.000Z');
    expect(computeLateMinutes(timeIn, '2026-10-08', '09:00', 15)).toBe(15);
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
  it('custom loan override caps at balance', () => {
    expect(
      computeLoanPeriodAmount({
        balance: 300,
        termStyle: 'fixed_per_cutoff',
        installmentCount: null,
        fixedInstallmentAmount: 500,
        override: { action: 'custom', customAmount: 800 },
      }),
    ).toBe(300);
    expect(
      computeLoanPeriodAmount({
        balance: 3000,
        termStyle: 'fixed_per_cutoff',
        installmentCount: null,
        fixedInstallmentAmount: 500,
        override: { action: 'custom', customAmount: 250 },
      }),
    ).toBe(250);
  });
  it('fixed_per_cutoff uses fixed amount when not skipped', () => {
    expect(
      computeLoanPeriodAmount({
        balance: 3000,
        termStyle: 'fixed_per_cutoff',
        installmentCount: null,
        fixedInstallmentAmount: 500,
        override: null,
      }),
    ).toBe(500);
    expect(
      computeLoanPeriodAmount({
        balance: 400,
        termStyle: 'fixed_per_cutoff',
        installmentCount: null,
        fixedInstallmentAmount: 500,
        override: null,
      }),
    ).toBe(400);
  });
  it('equal_installments prefers stored fixed amount', () => {
    expect(
      computeLoanPeriodAmount({
        balance: 2500,
        termStyle: 'equal_installments',
        installmentCount: 5,
        fixedInstallmentAmount: 1000,
        override: null,
      }),
    ).toBe(1000);
  });
  it('equal_installments falls back to balance over count', () => {
    expect(
      computeLoanPeriodAmount({
        balance: 6000,
        termStyle: 'equal_installments',
        installmentCount: 6,
        fixedInstallmentAmount: null,
        override: null,
      }),
    ).toBe(1000);
  });
  it('equal_installments caps scheduled amount at balance', () => {
    expect(
      computeLoanPeriodAmount({
        balance: 500,
        termStyle: 'equal_installments',
        installmentCount: 10,
        fixedInstallmentAmount: 1000,
        override: null,
      }),
    ).toBe(500);
  });
  it('computePayslipNet composes commission and deductions', () => {
    const r = computePayslipNet({
      basePay: 10000,
      overtimePay: 500,
      lines: [
        { lineType: 'commission', label: 'Sales', amount: 200, source: 'auto' },
        { lineType: 'late_deduction', label: 'Late', amount: 70, source: 'auto' },
        { lineType: 'loan_deduction', label: 'Loan', amount: 1000, source: 'auto' },
        { lineType: 'manual_deduction', label: 'Adj', amount: 30, source: 'manual' },
      ],
    });
    expect(r.commissionsTotal).toBe(200);
    expect(r.lateTotal).toBe(70);
    expect(r.loanTotal).toBe(1000);
    expect(r.manualTotal).toBe(30);
    expect(r.grossPay).toBe(10700);
    expect(r.totalDeductions).toBe(1100);
    expect(r.netPay).toBe(9600);
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
