import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PayrollService } from './payroll.service';

describe('PayrollService manual deductions', () => {
  const createService = (query: jest.Mock) => {
    const service = new PayrollService({ query } as unknown as DatabaseService);
    jest.spyOn(service, 'ensureReady').mockResolvedValue();
    return service;
  };

  it('maps manual deductions from database rows', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: '7',
          user_id: '12',
          user_source: 'tblusers',
          payroll_run_id: null,
          date_from: '2026-10-01',
          date_to: '2026-10-15',
          label: 'Uniform',
          amount: '350.50',
          created_by: '3',
          created_at: '2026-10-08T01:00:00.000Z',
          updated_at: '2026-10-08T01:00:00.000Z',
        },
      ],
    });
    const service = createService(query);

    await expect(
      service.listManualDeductions(12, 'tblusers', '2026-10-01', '2026-10-15'),
    ).resolves.toEqual([
      {
        id: 7,
        userId: 12,
        userSource: 'tblusers',
        payrollRunId: null,
        dateFrom: '2026-10-01',
        dateTo: '2026-10-15',
        label: 'Uniform',
        amount: 350.5,
        createdBy: 3,
        createdAt: '2026-10-08T01:00:00.000Z',
        updatedAt: '2026-10-08T01:00:00.000Z',
      },
    ]);
  });

  it('trims labels when creating a manual deduction', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: '8',
          user_id: '12',
          user_source: 'tblusers',
          payroll_run_id: null,
          date_from: '2026-10-01',
          date_to: '2026-10-15',
          label: 'Cash advance',
          amount: '100.00',
          created_by: null,
          created_at: '2026-10-08T01:00:00.000Z',
          updated_at: '2026-10-08T01:00:00.000Z',
        },
      ],
    });
    const service = createService(query);

    await service.createManualDeduction(
      12,
      'tblusers',
      '2026-10-01',
      '2026-10-15',
      { label: '  Cash advance  ', amount: 100 },
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), [
      12,
      'tblusers',
      '2026-10-01',
      '2026-10-15',
      'Cash advance',
      100,
      null,
    ]);
  });

  it('rejects an invalid deduction period', async () => {
    const service = createService(jest.fn());

    await expect(
      service.listManualDeductions(12, 'tblusers', '2026-10-16', '2026-10-15'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports missing manual deductions when deleting', async () => {
    const service = createService(jest.fn().mockResolvedValue({ rows: [] }));

    await expect(service.deleteManualDeduction(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
