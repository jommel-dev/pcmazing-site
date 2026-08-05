import {
  computeProjectPaymentStatus,
  remainingForSchedule,
  roundMoney,
  type PaymentScheduleSettlementItem,
  type ProjectPaymentStatus,
} from './project-payment.util';

describe('project-payment.util', () => {
  it('computes paid when settled covers total', () => {
    expect(
      computeProjectPaymentStatus({
        totalAmount: 100,
        settledAmount: 100,
        hasOverdueUnpaid: true,
      }),
    ).toBe('paid');
  });

  it('computes overdue when balance remains and due date passed', () => {
    expect(
      computeProjectPaymentStatus({
        totalAmount: 100,
        settledAmount: 20,
        hasOverdueUnpaid: true,
      }),
    ).toBe('overdue');
  });

  it('computes unpaid when balance remains and not overdue', () => {
    expect(
      computeProjectPaymentStatus({
        totalAmount: 100,
        settledAmount: 20,
        hasOverdueUnpaid: false,
      }),
    ).toBe('unpaid');
  });

  it('computes none when no schedule total', () => {
    expect(
      computeProjectPaymentStatus({
        totalAmount: 0,
        settledAmount: 0,
        hasOverdueUnpaid: false,
      }),
    ).toBe('none');
  });

  it('rounds remaining balance', () => {
    expect(remainingForSchedule(100.1, 30.05)).toBe(70.05);
    expect(roundMoney(10.006)).toBe(10.01);
  });

  it('types settlement item shape', () => {
    const item: PaymentScheduleSettlementItem = {
      id: 1,
      paymentScheduleId: 2,
      amount: 50,
      settledOn: '2026-01-01',
      paymentMethod: 'Cash',
      referenceNumber: null,
      checkDate: null,
      remainingBalance: 50,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    expect(item.amount).toBe(50);
    const status: ProjectPaymentStatus = 'paid';
    expect(status).toBe('paid');
  });
});
