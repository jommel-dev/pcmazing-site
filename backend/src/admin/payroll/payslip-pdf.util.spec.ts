import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import {
  getUploadSubdir,
  toPublicUploadUrl,
} from '../../common/uploads-path.util';
import {
  buildPayslipPdfBuffer,
  PayslipPdfPayload,
  shouldRenderPayslipRemarks,
} from './payslip-pdf.util';

const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const MINIMAL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

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

  describe('Scan to pay QR block', () => {
    const qrFilename = 'payslip-spec-qr.png';
    let qrPublicUrl: string;

    beforeAll(() => {
      const dir = getUploadSubdir('payroll-qr');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, qrFilename), MINIMAL_PNG);
      qrPublicUrl = toPublicUploadUrl('payroll-qr', qrFilename);
    });

    afterAll(() => {
      try {
        rmSync(join(getUploadSubdir('payroll-qr'), qrFilename), {
          force: true,
        });
      } catch {
        // ignore cleanup errors
      }
    });

    it('includes Scan to pay when qrImageUrl points to an existing file', async () => {
      const buffer = await buildPayslipPdfBuffer(
        makePayload({ qrImageUrl: qrPublicUrl }),
      );

      expect(extractPdfText(buffer)).toContain('Scan to pay');
    });

    it('omits Scan to pay when qrImageUrl is null', async () => {
      const buffer = await buildPayslipPdfBuffer(
        makePayload({ qrImageUrl: null }),
      );

      expect(extractPdfText(buffer)).not.toContain('Scan to pay');
    });

    it('omits Scan to pay when image format is unsupported (e.g. GIF)', async () => {
      const gifFilename = 'payslip-spec-qr.gif';
      const dir = getUploadSubdir('payroll-qr');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, gifFilename), MINIMAL_GIF);
      const gifPublicUrl = toPublicUploadUrl('payroll-qr', gifFilename);

      try {
        const buffer = await buildPayslipPdfBuffer(
          makePayload({ qrImageUrl: gifPublicUrl }),
        );

        expect(extractPdfText(buffer)).not.toContain('Scan to pay');
      } finally {
        try {
          rmSync(join(dir, gifFilename), { force: true });
        } catch {
          // ignore cleanup errors
        }
      }
    });

    it('omits Scan to pay when qrImageUrl points to a missing file', async () => {
      const buffer = await buildPayslipPdfBuffer(
        makePayload({ qrImageUrl: '/uploads/payroll-qr/missing.png' }),
      );

      expect(extractPdfText(buffer)).not.toContain('Scan to pay');
    });

    it('breaks to a new page when QR block would overflow content bottom', async () => {
      const days = Array.from({ length: 18 }, (_, i) => ({
        workDate: `2026-10-${String(i + 1).padStart(2, '0')}`,
        timeInLabel: '09:00 AM',
        timeOutLabel: '06:00 PM',
        hoursWorked: 8,
        dayType: 'REGULAR',
        paidUnits: 1,
        dayPay: 500,
        overtimeHours: 0,
        overtimeStatus: 'NONE',
        overtimePay: 0,
      }));
      const lines = Array.from({ length: 6 }, (_, i) => ({
        lineType: 'commission' as const,
        label: `Commission ${i + 1}`,
        amount: 250,
      }));

      const withoutQr = await buildPayslipPdfBuffer(
        makePayload({ days, lines, qrImageUrl: null }),
      );
      expect(extractPdfText(withoutQr)).toContain('Page 1 of 1');

      const withQr = await buildPayslipPdfBuffer(
        makePayload({ days, lines, qrImageUrl: qrPublicUrl }),
      );
      expect(extractPdfText(withQr)).toContain('Page 2 of 2');
    });
  });
});
