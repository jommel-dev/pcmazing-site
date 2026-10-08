import { NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PayrollService } from './payroll.service';

describe('PayrollService payslip remarks', () => {
  const createService = (query: jest.Mock) => {
    const service = new PayrollService({ query } as unknown as DatabaseService);
    jest.spyOn(service, 'ensureReady').mockResolvedValue();
    return service;
  };

  it('trims and updates payslip remarks', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ id: 9, remarks: 'Great work' }],
    });
    const service = createService(query);

    await expect(
      service.updatePayslipRemarks(9, '  Great work  '),
    ).resolves.toEqual({
      id: '9',
      remarks: 'Great work',
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), [
      9,
      'Great work',
    ]);
  });

  it('reports a missing payslip', async () => {
    const service = createService(jest.fn().mockResolvedValue({ rows: [] }));
    await expect(service.updatePayslipRemarks(99, null)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('selects remarks when loading employee payslip detail', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = createService(query);

    await expect(
      service.getEmployeePayslipDetail(9, 4, 'pcmazing_admin_users'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain('p.remarks');
  });
});
