/** Payroll ledger line types and net/gross math (Asia/Manila wall clock for lateness). */

export type PayslipLedgerLineType =
  | 'commission'
  | 'late_deduction'
  | 'loan_deduction'
  | 'manual_deduction';

export type PayslipLedgerLine = {
  lineType: PayslipLedgerLineType;
  label: string;
  amount: number;
  source: 'auto' | 'manual' | 'override';
  meta?: Record<string, unknown>;
};

const MANILA_TZ = 'Asia/Manila';

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseHhmm(hhmm: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) {
    throw new Error(`Invalid shift time (expected HH:mm): ${hhmm}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid shift time (expected HH:mm): ${hhmm}`);
  }
  return { hour, minute };
}

/** Calendar date + clock in Asia/Manila as minutes from local midnight. */
function manilaMinutesFromMidnight(d: Date): { ymd: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const ymd = `${pick('year')}-${pick('month')}-${pick('day')}`;
  const hour = Number(pick('hour'));
  const minute = Number(pick('minute'));
  return { ymd, minutes: hour * 60 + minute };
}

/**
 * Minutes late after shift start + grace on the given work date (Asia/Manila local wall clock).
 * Returns 0 if on time, early, or clock-in is not on workDateYmd.
 */
export function computeLateMinutes(
  timeIn: Date,
  workDateYmd: string,
  shiftStartHhmm: string,
  graceMinutes: number,
): number {
  const { ymd, minutes: inMinutes } = manilaMinutesFromMidnight(timeIn);
  if (ymd !== workDateYmd) {
    return 0;
  }

  const { hour, minute } = parseHhmm(shiftStartHhmm);
  const deadlineMinutes = hour * 60 + minute + Math.max(0, graceMinutes);
  const late = inMinutes - deadlineMinutes;
  return late > 0 ? late : 0;
}

export function computeLateDeduction(
  minutesLate: number,
  fixed: number,
  perMinute: number,
): number {
  if (minutesLate <= 0) {
    return 0;
  }
  return roundMoney(fixed + minutesLate * perMinute);
}

export function computeEqualInstallmentAmount(
  principal: number,
  installmentCount: number,
): number {
  if (installmentCount <= 0 || principal <= 0) {
    return 0;
  }
  return roundMoney(principal / installmentCount);
}

export function computeLoanPeriodAmount(args: {
  balance: number;
  termStyle: 'equal_installments' | 'fixed_per_cutoff';
  installmentCount: number | null;
  fixedInstallmentAmount: number | null;
  override: null | { action: 'skip' | 'custom'; customAmount?: number };
}): number {
  const balance = Math.max(0, args.balance);
  if (balance <= 0) {
    return 0;
  }

  if (args.override?.action === 'skip') {
    return 0;
  }

  if (args.override?.action === 'custom') {
    const custom = args.override.customAmount ?? 0;
    return roundMoney(Math.min(Math.max(0, custom), balance));
  }

  let scheduled = 0;
  if (args.termStyle === 'fixed_per_cutoff') {
    scheduled = args.fixedInstallmentAmount ?? 0;
  } else if (args.termStyle === 'equal_installments') {
    // Prefer stored principal/N (fixedInstallmentAmount at loan create); else split current balance.
    if (args.fixedInstallmentAmount != null) {
      scheduled = args.fixedInstallmentAmount;
    } else if (args.installmentCount != null && args.installmentCount > 0) {
      scheduled = computeEqualInstallmentAmount(balance, args.installmentCount);
    }
  }

  return roundMoney(Math.min(Math.max(0, scheduled), balance));
}

export function computePayslipNet(args: {
  basePay: number;
  overtimePay: number;
  lines: PayslipLedgerLine[];
}): {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  commissionsTotal: number;
  lateTotal: number;
  loanTotal: number;
  manualTotal: number;
} {
  let commissionsTotal = 0;
  let lateTotal = 0;
  let loanTotal = 0;
  let manualTotal = 0;

  for (const line of args.lines) {
    const amount = roundMoney(Math.max(0, line.amount));
    switch (line.lineType) {
      case 'commission':
        commissionsTotal = roundMoney(commissionsTotal + amount);
        break;
      case 'late_deduction':
        lateTotal = roundMoney(lateTotal + amount);
        break;
      case 'loan_deduction':
        loanTotal = roundMoney(loanTotal + amount);
        break;
      case 'manual_deduction':
        manualTotal = roundMoney(manualTotal + amount);
        break;
      default:
        break;
    }
  }

  const grossPay = roundMoney(args.basePay + args.overtimePay + commissionsTotal);
  const totalDeductions = roundMoney(lateTotal + loanTotal + manualTotal);
  const netPay = roundMoney(Math.max(0, grossPay - totalDeductions));

  return {
    grossPay,
    totalDeductions,
    netPay,
    commissionsTotal,
    lateTotal,
    loanTotal,
    manualTotal,
  };
}
