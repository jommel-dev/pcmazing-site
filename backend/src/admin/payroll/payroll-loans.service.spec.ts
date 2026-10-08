import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PayrollService } from './payroll.service';

describe('PayrollService loans', () => {
  const createService = (query: jest.Mock) => {
    const service = new PayrollService({ query } as unknown as DatabaseService);
    jest.spyOn(service, 'ensureReady').mockResolvedValue();
    return service;
  };

  it('stores principal divided by count as the stable equal installment amount', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        id: '7', user_id: '12', user_source: 'tblusers', principal: '1000.00',
        balance: '1000.00', term_style: 'equal_installments', installment_count: 3,
        fixed_installment_amount: '333.33', status: 'active', notes: null,
        created_at: '2026-10-08T01:00:00.000Z', updated_at: '2026-10-08T01:00:00.000Z',
      }],
    });
    const service = createService(query);

    await expect(service.createLoan({
      userId: 12,
      userSource: 'tblusers',
      principal: 1000,
      termStyle: 'equal_installments',
      installmentCount: 3,
    })).resolves.toEqual(expect.objectContaining({
      fixedInstallmentAmount: 333.33,
      balance: 1000,
    }));
    expect(query.mock.calls[0][1]).toEqual([
      12, 'tblusers', 1000, 1000, 'equal_installments', 3, 333.33, null,
    ]);
  });

  it('rejects term fields that do not match the selected style', async () => {
    const service = createService(jest.fn());
    await expect(service.createLoan({
      userId: 12,
      userSource: 'tblusers',
      principal: 1000,
      termStyle: 'fixed_per_cutoff',
      installmentCount: 3,
      fixedInstallmentAmount: 200,
    })).rejects.toBeInstanceOf(BadRequestException);
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
