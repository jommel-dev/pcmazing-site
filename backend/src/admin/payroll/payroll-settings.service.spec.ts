import { DatabaseService } from '../../database/database.service';
import { PayrollService } from './payroll.service';

describe('PayrollService settings', () => {
  const createService = (query: jest.Mock) => {
    const service = new PayrollService({ query } as unknown as DatabaseService);
    jest.spyOn(service, 'ensureReady').mockResolvedValue();
    return service;
  };

  it('reads late settings from the database', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          work_week: 'mon_sat',
          undertime_grace_minutes: '25',
          shift_start_time: '08:30:00',
          late_grace_minutes: '10',
          late_deduction_fixed: '75.50',
          late_deduction_per_minute: '1.25',
        },
      ],
    });
    const service = createService(query);

    await expect(service.getSettings()).resolves.toEqual({
      workWeek: 'mon_sat',
      undertimeGraceMinutes: 25,
      shiftStartTime: '08:30',
      lateGraceMinutes: 10,
      lateDeductionFixed: 75.5,
      lateDeductionPerMinute: 1.25,
    });
  });

  it('persists all late settings while retaining omitted values', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = createService(query);
    jest.spyOn(service, 'getSettings').mockResolvedValue({
      workWeek: 'mon_fri',
      undertimeGraceMinutes: 30,
      shiftStartTime: '09:00',
      lateGraceMinutes: 15,
      lateDeductionFixed: 0,
      lateDeductionPerMinute: 2,
    });

    await service.updateSettings({
      shiftStartTime: '08:45',
      lateGraceMinutes: 20,
      lateDeductionFixed: 100,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('late_deduction_per_minute = EXCLUDED.late_deduction_per_minute'),
      ['mon_fri', 30, '08:45', 20, 100, 2],
    );
  });
});
