import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PayrollService } from './payroll.service';

describe('PayrollService commissions', () => {
  const createService = (query: jest.Mock) => {
    const service = new PayrollService({ query } as unknown as DatabaseService);
    jest.spyOn(service, 'ensureReady').mockResolvedValue();
    return service;
  };

  it('maps commission types and entries from database rows', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: '4',
            name: 'Sales',
            is_active: true,
            created_at: '2026-10-08T01:00:00.000Z',
            updated_at: '2026-10-08T01:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '9',
            user_id: '12',
            user_source: 'tblusers',
            payroll_run_id: null,
            date_from: '2026-10-01',
            date_to: '2026-10-15',
            type_id: '4',
            type_name: 'Sales',
            label: null,
            amount: '1250.50',
            created_by: '3',
            created_at: '2026-10-08T01:00:00.000Z',
            updated_at: '2026-10-08T01:00:00.000Z',
          },
        ],
      });
    const service = createService(query);

    await expect(service.listCommissionTypes()).resolves.toEqual([
      expect.objectContaining({ id: 4, name: 'Sales', isActive: true }),
    ]);
    await expect(
      service.listCommissionEntries(12, 'tblusers', '2026-10-01', '2026-10-15'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 9,
        userId: 12,
        typeId: 4,
        typeName: 'Sales',
        amount: 1250.5,
      }),
    ]);
  });

  it('requires a custom label when no commission type is selected', async () => {
    const service = createService(jest.fn());

    await expect(
      service.createCommissionEntry(
        12,
        'tblusers',
        '2026-10-01',
        '2026-10-15',
        { typeId: null, amount: 100 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing or inactive selected commission type', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = createService(query);

    await expect(
      service.createCommissionEntry(
        12,
        'tblusers',
        '2026-10-01',
        '2026-10-15',
        { typeId: 999, amount: 100 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reports missing commission entries when deleting', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = createService(query);

    await expect(service.deleteCommissionEntry(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
