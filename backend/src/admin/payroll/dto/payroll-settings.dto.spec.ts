import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePayrollSettingsDto } from './payroll-settings.dto';

describe('UpdatePayrollSettingsDto late settings', () => {
  it('accepts valid late settings and converts money inputs', async () => {
    const dto = plainToInstance(UpdatePayrollSettingsDto, {
      shiftStartTime: '09:00',
      lateGraceMinutes: '15',
      lateDeductionFixed: '100.50',
      lateDeductionPerMinute: '2.25',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      shiftStartTime: '09:00',
      lateGraceMinutes: 15,
      lateDeductionFixed: 100.5,
      lateDeductionPerMinute: 2.25,
    });
  });

  it.each([
    ['shiftStartTime', '9:00'],
    ['lateGraceMinutes', -1],
    ['lateGraceMinutes', 121],
    ['lateDeductionFixed', -0.01],
    ['lateDeductionPerMinute', -0.01],
  ])('rejects invalid %s', async (field, value) => {
    const dto = plainToInstance(UpdatePayrollSettingsDto, { [field]: value });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});
