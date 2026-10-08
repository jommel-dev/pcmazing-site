import {
  computeLateDeduction,
  computeLateMinutes,
  computeLoanPeriodAmount,
  computePayslipNet,
  PayslipLedgerLine,
} from './payroll-ledger.util';

type LoanOverride = null | {
  action: 'skip' | 'custom';
  customAmount?: number;
};

export interface PayslipLedgerAssemblyInput {
  basePay: number;
  overtimePay: number;
  settings: {
    shiftStartTime: string;
    lateGraceMinutes: number;
    lateDeductionFixed: number;
    lateDeductionPerMinute: number;
  };
  commissions: Array<{
    id: number;
    label: string | null;
    typeName: string | null;
    amount: number;
  }>;
  manualDeductions: Array<{ id: number; label: string; amount: number }>;
  attendance: Array<{ workDate: string; timeIn: string | null }>;
  lateExcludedDates?: ReadonlySet<string>;
  loans: Array<{
    id: number;
    label?: string | null;
    balance: number;
    termStyle: 'equal_installments' | 'fixed_per_cutoff';
    installmentCount: number | null;
    fixedInstallmentAmount: number | null;
    override: LoanOverride;
  }>;
}

export function assemblePayslipLedger(input: PayslipLedgerAssemblyInput): {
  lines: PayslipLedgerLine[];
  net: ReturnType<typeof computePayslipNet>;
  loanDeductions: Array<{ loanId: number; amount: number }>;
} {
  const lines: PayslipLedgerLine[] = [];
  const loanDeductions: Array<{ loanId: number; amount: number }> = [];

  for (const commission of input.commissions) {
    lines.push({
      lineType: 'commission',
      label:
        commission.label?.trim() || commission.typeName?.trim() || 'Commission',
      amount: commission.amount,
      source: 'manual',
      meta: { commissionEntryId: commission.id },
    });
  }

  for (const deduction of input.manualDeductions) {
    lines.push({
      lineType: 'manual_deduction',
      label: deduction.label,
      amount: deduction.amount,
      source: 'manual',
      meta: { manualDeductionId: deduction.id },
    });
  }

  for (const punch of input.attendance) {
    if (!punch.timeIn || input.lateExcludedDates?.has(punch.workDate)) continue;
    const minutesLate = computeLateMinutes(
      new Date(punch.timeIn),
      punch.workDate,
      input.settings.shiftStartTime,
      input.settings.lateGraceMinutes,
    );
    const amount = computeLateDeduction(
      minutesLate,
      input.settings.lateDeductionFixed,
      input.settings.lateDeductionPerMinute,
    );
    if (amount <= 0) continue;
    lines.push({
      lineType: 'late_deduction',
      label: `Late — ${punch.workDate} (${minutesLate} min)`,
      amount,
      source: 'auto',
      meta: { workDate: punch.workDate, minutesLate },
    });
  }

  for (const loan of input.loans) {
    const amount = computeLoanPeriodAmount({
      balance: loan.balance,
      termStyle: loan.termStyle,
      installmentCount: loan.installmentCount,
      fixedInstallmentAmount: loan.fixedInstallmentAmount,
      override: loan.override,
    });
    if (amount <= 0) continue;
    const loanLabel = loan.label?.trim();
    lines.push({
      lineType: 'loan_deduction',
      label: loanLabel || `Loan #${loan.id}`,
      amount,
      source: loan.override ? 'override' : 'auto',
      meta: { loanId: loan.id, balanceBefore: loan.balance },
    });
    loanDeductions.push({ loanId: loan.id, amount });
  }

  return {
    lines,
    net: computePayslipNet({
      basePay: input.basePay,
      overtimePay: input.overtimePay,
      lines,
    }),
    loanDeductions,
  };
}
