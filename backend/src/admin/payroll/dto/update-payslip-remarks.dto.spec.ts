import { validate } from 'class-validator';
import { UpdatePayslipRemarksDto } from './update-payslip-remarks.dto';

describe('UpdatePayslipRemarksDto', () => {
  it('requires the remarks key', async () => {
    const dto = new UpdatePayslipRemarksDto();

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('allows an explicit null remarks value', async () => {
    const dto = new UpdatePayslipRemarksDto();
    dto.remarks = null;

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
