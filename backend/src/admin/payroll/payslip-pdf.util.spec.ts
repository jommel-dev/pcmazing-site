import { inflateSync } from 'node:zlib';
import {
  buildPayslipPdfBuffer,
  PayslipPdfPayload,
  shouldRenderPayslipRemarks,
} from './payslip-pdf.util';

function extractPdfText(buffer: Buffer): string {
  const source = buffer.toString('latin1');
  const text: string[] = [];
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;

  for (const match of source.matchAll(streamPattern)) {
    try {
      const stream = inflateSync(Buffer.from(match[1], 'latin1')).toString(
        'latin1',
      );
      for (const hex of stream.matchAll(/<([0-9a-f]+)>/gi)) {
        text.push(Buffer.from(hex[1], 'hex').toString('latin1'));
      }
    } catch {
      // Ignore non-Flate PDF streams.
    }
  }

  return text.join('');
}

function makePayload(
  overrides: Partial<PayslipPdfPayload> = {},
): PayslipPdfPayload {
  return {
    companyName: 'PCmazing',
    label: 'October 1-15',
    dateFrom: '2026-10-01',
    dateTo: '2026-10-15',
    generatedAt: 'Oct 15, 2026, 5:00 PM',
    remarks: 'Confidential payroll note',
    employee: {
      fullName: 'Test Employee',
      positionTitle: 'Technician',
    },
    days: [],
    totals: {
      daysPresent: 0,
      daysCompleted: 0,
      paidDayUnits: 0,
      totalHours: 0,
      approvedOvertimeHours: 0,
      pendingOvertimeHours: 0,
      basePay: 10_000,
      overtimePay: 500,
      estimatedPay: 11_500,
    },
    ...overrides,
  };
}

describe('shouldRenderPayslipRemarks', () => {
  it('renders non-empty remarks only when explicitly included', () => {
    expect(shouldRenderPayslipRemarks('Great work', true)).toBe(true);
    expect(shouldRenderPayslipRemarks('Great work', false)).toBe(false);
    expect(shouldRenderPayslipRemarks('   ', true)).toBe(false);
    expect(shouldRenderPayslipRemarks(null, true)).toBe(false);
  });
});

describe('buildPayslipPdfBuffer', () => {
  it('includes payslip ledger lines in the generated PDF', async () => {
    const buffer = await buildPayslipPdfBuffer(
      makePayload({
        lines: [
          {
            lineType: 'commission',
            label: 'Performance commission',
            amount: 1_000,
          },
        ],
      }),
    );

    expect(extractPdfText(buffer)).toContain('Performance commission');
  });

  it('omits remarks from the generated PDF when includeRemarks is false', async () => {
    const buffer = await buildPayslipPdfBuffer(makePayload(), {
      includeRemarks: false,
    });

    expect(extractPdfText(buffer)).not.toContain('Confidential payroll note');
  });
});
