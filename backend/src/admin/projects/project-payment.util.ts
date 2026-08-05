export type ProjectPaymentStatus = 'paid' | 'overdue' | 'unpaid' | 'none';

export type PaymentScheduleSettlementItem = {
  id: number;
  paymentScheduleId: number;
  amount: number;
  settledOn: string;
  paymentMethod: string;
  referenceNumber: string | null;
  checkDate: string | null;
  remainingBalance: number;
  createdAt: string;
};

export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function computeProjectPaymentStatus(input: {
  totalAmount: number;
  settledAmount: number;
  hasOverdueUnpaid: boolean;
}): ProjectPaymentStatus {
  const total = roundMoney(input.totalAmount);
  const settled = roundMoney(input.settledAmount);
  if (total <= 0) {
    return 'none';
  }
  if (settled >= total) {
    return 'paid';
  }
  if (input.hasOverdueUnpaid) {
    return 'overdue';
  }
  return 'unpaid';
}

export function remainingForSchedule(scheduleAmount: number, settledAmount: number): number {
  return Math.max(0, roundMoney(scheduleAmount - settledAmount));
}
