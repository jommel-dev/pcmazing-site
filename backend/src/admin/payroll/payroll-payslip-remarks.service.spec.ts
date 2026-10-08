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

  it('uses the stored net pay for a legacy payslip without ledger lines', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM pcmazing_generated_payslips')) {
        return Promise.resolve({
          rows: [
            {
              id: 9,
              username: 'legacy.employee',
              full_name: 'Legacy Employee',
              employee_code: null,
              department: null,
              position_title: null,
              salary_type: 'cutoff',
              salary_amount: '10000',
              wfh_salary: null,
              fixed_monthly_salary: null,
              weekly_location_schedule: null,
              days_present: 0,
              days_completed: 0,
              total_hours: '0',
              estimated_pay: '4321.50',
              label: 'Legacy cutoff',
              date_from: '2026-09-16',
              date_to: '2026-09-30',
              period_days: 15,
              created_at: '2026-09-30T00:00:00.000Z',
              remarks: null,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
    const service = createService(query);

    const detail = await service.getEmployeePayslipDetail(
      9,
      4,
      'pcmazing_admin_users',
    );

    expect(detail.netPay).toBe(4321.5);
    expect(detail.breakdown.netPay).toBe(4321.5);
    expect(detail.totals.estimatedPay).toBe(4321.5);
  });
});
