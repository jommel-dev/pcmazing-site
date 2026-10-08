import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PayrollService } from './payroll.service';

describe('PayrollService loans', () => {
  const createService = (query: jest.Mock) => {
    const service = new PayrollService({ query } as unknown as DatabaseService);
    jest.spyOn(service, 'ensureReady').mockResolvedValue();
    return service;
  };

  const loanRow = (overrides: Record<string, unknown> = {}) => ({
    id: '7',
    user_id: '12',
    user_source: 'tblusers',
    principal: '1000.00',
    balance: '1000.00',
    term_style: 'equal_installments',
    installment_count: 3,
    fixed_installment_amount: '333.33',
    status: 'active',
    label: 'Laptop advance',
    notes: null,
    created_at: '2026-10-08T01:00:00.000Z',
    updated_at: '2026-10-08T01:00:00.000Z',
    ...overrides,
  });

  it('stores principal divided by count as the stable equal installment amount', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [loanRow()],
    });
    const service = createService(query);

    await expect(service.createLoan({
      userId: 12,
      userSource: 'tblusers',
      label: 'Laptop advance',
      principal: 1000,
      termStyle: 'equal_installments',
      installmentCount: 3,
    })).resolves.toEqual(expect.objectContaining({
      fixedInstallmentAmount: 333.33,
      balance: 1000,
      label: 'Laptop advance',
    }));
    expect(query.mock.calls[0][1]).toEqual([
      12, 'tblusers', 1000, 1000, 'equal_installments', 3, 333.33, 'Laptop advance', null,
    ]);
  });

  it('rejects term fields that do not match the selected style', async () => {
    const service = createService(jest.fn());
    await expect(service.createLoan({
      userId: 12,
      userSource: 'tblusers',
      label: 'Bad loan',
      principal: 1000,
      termStyle: 'fixed_per_cutoff',
      installmentCount: 3,
      fixedInstallmentAmount: 200,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('excludes deleted loans from the employee list', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = createService(query);
    await service.listLoans(12, 'tblusers');
    expect(query.mock.calls[0][0]).toMatch(/status\s*<>\s*'deleted'/i);
  });

  it('cancels then restores an active loan', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [loanRow({ status: 'active' })] })
      .mockResolvedValueOnce({ rows: [loanRow({ status: 'cancelled' })] })
      .mockResolvedValueOnce({ rows: [loanRow({ status: 'cancelled' })] })
      .mockResolvedValueOnce({ rows: [loanRow({ status: 'active' })] });
    const service = createService(query);

    await expect(service.updateLoan(7, { status: 'cancelled' })).resolves.toEqual(
      expect.objectContaining({ status: 'cancelled' }),
    );
    await expect(service.updateLoan(7, { status: 'active' })).resolves.toEqual(
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('returns loan detail with deduction breakdown', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [loanRow({ balance: '700.00', principal: '1000.00' })] })
      .mockResolvedValueOnce({
        rows: [{
          id: '11',
          amount: '300.00',
          source: 'auto',
          label: 'Laptop advance',
          meta: { loanId: 7, balanceBefore: 1000 },
          created_at: '2026-10-01T01:00:00.000Z',
          date_from: '2026-10-01',
          date_to: '2026-10-15',
          run_label: 'Oct 1–15',
        }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const service = createService(query);

    await expect(service.getLoanDetail(7)).resolves.toEqual(
      expect.objectContaining({
        deductedTotal: 300,
        remainingBalance: 700,
        scheduledInstallmentAmount: 333.33,
        estimatedRemainingInstallments: 3,
        deductions: [
          expect.objectContaining({
            amount: 300,
            runLabel: 'Oct 1–15',
            balanceBefore: 1000,
          }),
        ],
      }),
    );
  });

  it('updates remaining balance within principal', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [loanRow({ balance: '1000.00', principal: '1000.00' })] })
      .mockResolvedValueOnce({ rows: [loanRow({ balance: '750.00', principal: '1000.00' })] });
    const service = createService(query);

    await expect(service.updateLoan(7, { balance: 750 })).resolves.toEqual(
      expect.objectContaining({ balance: 750 }),
    );
    expect(query.mock.calls[1][1]).toEqual(
      expect.arrayContaining([true, 750]),
    );
  });

  it('rejects balance above principal', async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [loanRow({ balance: '500.00', principal: '1000.00' })],
    });
    const service = createService(query);
    await expect(service.updateLoan(7, { balance: 1200 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('soft-deletes a loan and rejects restoring deleted loans', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [loanRow({ status: 'cancelled' })] })
      .mockResolvedValueOnce({ rows: [loanRow({ status: 'deleted' })] })
      .mockResolvedValueOnce({ rows: [loanRow({ status: 'deleted' })] });
    const service = createService(query);

    await expect(service.updateLoan(7, { status: 'deleted' })).resolves.toEqual(
      expect.objectContaining({ status: 'deleted' }),
    );
    await expect(service.updateLoan(7, { status: 'active' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('upserts an override without changing the loan balance', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: '7' }] })
      .mockResolvedValueOnce({
        rows: [{
          id: '2', loan_id: '7', payroll_run_id: null, date_from: '2026-10-01',
          date_to: '2026-10-15', action: 'custom', custom_amount: '125.50',
          created_at: '2026-10-08T01:00:00.000Z', updated_at: '2026-10-08T01:00:00.000Z',
        }],
      });
    const service = createService(query);

    await expect(service.upsertLoanPeriodOverride(7, {
      dateFrom: '2026-10-01',
      dateTo: '2026-10-15',
      action: 'custom',
      customAmount: 125.5,
    })).resolves.toEqual(expect.objectContaining({ loanId: 7, customAmount: 125.5 }));
    expect(query.mock.calls[1][0]).not.toMatch(/balance\s*=/i);
  });

  it('reports missing loans when deleting an override', async () => {
    const service = createService(jest.fn().mockResolvedValue({ rows: [] }));
    await expect(
      service.deleteLoanPeriodOverride(999, '2026-10-01', '2026-10-15'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
