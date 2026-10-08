import { shouldRenderPayslipRemarks } from './payslip-pdf.util';

describe('shouldRenderPayslipRemarks', () => {
  it('renders non-empty remarks only when explicitly included', () => {
    expect(shouldRenderPayslipRemarks('Great work', true)).toBe(true);
    expect(shouldRenderPayslipRemarks('Great work', false)).toBe(false);
    expect(shouldRenderPayslipRemarks('   ', true)).toBe(false);
    expect(shouldRenderPayslipRemarks(null, true)).toBe(false);
  });
});
