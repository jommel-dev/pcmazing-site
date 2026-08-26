import PDFDocument from 'pdfkit';

export interface PayslipDayBreakdownRow {
  workDate: string;
  timeInLabel: string;
  timeOutLabel: string;
  hoursWorked: number;
  dayType: string;
  paidUnits: number;
  dayPay: number;
  overtimeHours: number;
  overtimeStatus: string;
  overtimePay: number;
}

export interface PayslipPdfPayload {
  companyName: string;
  label: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  employee: {
    fullName: string;
    positionTitle: string | null;
  };
  days: PayslipDayBreakdownRow[];
  totals: {
    daysPresent: number;
    daysCompleted: number;
    paidDayUnits: number;
    totalHours: number;
    approvedOvertimeHours: number;
    pendingOvertimeHours: number;
    basePay: number;
    overtimePay: number;
    estimatedPay: number;
    periodDays?: number;
    salaryTypeLabel?: string;
    payBasis?: string;
  };
}

function money(value: number): string {
  return `PHP ${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function buildPayslipPdfBuffer(payload: PayslipPdfPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pageMargin = { top: 48, bottom: 72, left: 48, right: 48 };
    const doc = new PDFDocument({
      size: 'A4',
      margins: pageMargin,
      bufferPages: true,
      info: {
        Title: `Payslip - ${payload.label}`,
        Author: payload.companyName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const right = left + pageWidth;
    const contentBottom = () => doc.page.height - doc.page.margins.bottom;
    const resetCursor = (y?: number) => {
      doc.x = left;
      if (y != null) {
        doc.y = y;
      }
    };
    const writeLine = (
      text: string,
      options?: { underline?: boolean; align?: 'left' | 'center' | 'right' },
    ) => {
      resetCursor();
      doc.text(text, left, doc.y, {
        width: pageWidth,
        align: 'left',
        lineBreak: true,
        ...options,
      });
    };

    doc.fontSize(18).fillColor('#0047FF');
    writeLine(payload.companyName);
    doc.moveDown(0.15);
    doc.fontSize(12).fillColor('#0f172a');
    writeLine('Employee Payslip');

    doc.moveDown(0.7);
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
    doc.moveDown(0.7);

    doc.fontSize(10).fillColor('#0f172a');
    writeLine(`Employee: ${payload.employee.fullName}`);
    writeLine(`Position: ${payload.employee.positionTitle?.trim() || '—'}`);
    writeLine(`Payroll Period: ${payload.dateFrom} - ${payload.dateTo}`);

    doc.moveDown(0.9);
    doc.fontSize(11).fillColor('#0f172a');
    writeLine('Compensation Summary', { underline: true });
    doc.moveDown(0.35);

    const col = {
      date: left,
      shift: left + 70,
      hours: left + 160,
      type: left + 210,
      dayPay: left + 275,
      ot: left + 350,
      otPay: left + 430,
    };
    const rowHeight = 16;

    const drawTableHeader = () => {
      const y = doc.y;
      doc.fontSize(8).fillColor('#64748b');
      doc.text('Date', col.date, y, { width: 65, lineBreak: false });
      doc.text('Shift', col.shift, y, { width: 85, lineBreak: false });
      doc.text('Hours', col.hours, y, { width: 45, lineBreak: false });
      doc.text('Day', col.type, y, { width: 60, lineBreak: false });
      doc.text('Day pay', col.dayPay, y, { width: 70, lineBreak: false });
      doc.text('OT hrs', col.ot, y, { width: 75, lineBreak: false });
      doc.text('OT pay', col.otPay, y, { width: 70, lineBreak: false });
      resetCursor(y + 12);
      doc.strokeColor('#e2e8f0').moveTo(left, doc.y).lineTo(right, doc.y).stroke();
      resetCursor(doc.y + 6);
    };

    const ensureRowSpace = (needed: number) => {
      if (doc.y > contentBottom() - needed) {
        doc.addPage();
        resetCursor(doc.page.margins.top);
        drawTableHeader();
      }
    };

    drawTableHeader();

    for (const day of payload.days) {
      ensureRowSpace(rowHeight);
      const y = doc.y;
      doc.fontSize(8).fillColor('#0f172a');
      doc.text(day.workDate, col.date, y, { width: 65, lineBreak: false });
      doc.text(`${day.timeInLabel}-${day.timeOutLabel}`, col.shift, y, { width: 85, lineBreak: false });
      doc.text(day.hoursWorked.toFixed(2), col.hours, y, { width: 45, lineBreak: false });
      doc.text(day.dayType, col.type, y, { width: 60, lineBreak: false });
      doc.text(money(day.dayPay), col.dayPay, y, { width: 70, lineBreak: false });
      doc.text(
        day.overtimeHours > 0 ? `${day.overtimeHours.toFixed(2)} (${day.overtimeStatus})` : '-',
        col.ot,
        y,
        { width: 75, lineBreak: false },
      );
      doc.text(day.overtimePay > 0 ? money(day.overtimePay) : '-', col.otPay, y, { width: 70, lineBreak: false });
      resetCursor(y + rowHeight);
    }

    if (payload.days.length === 0) {
      doc.fontSize(9).fillColor('#64748b');
      writeLine('No attendance punches in this period.');
    }

    doc.moveDown(0.8);
    if (doc.y > contentBottom() - 160) {
      doc.addPage();
      resetCursor(doc.page.margins.top);
    }

    doc.fontSize(11).fillColor('#0f172a');
    writeLine('Summary', { underline: true });
    doc.moveDown(0.4);

    const t = payload.totals;
    doc.fontSize(10).fillColor('#0f172a');
    if (t.salaryTypeLabel) {
      writeLine(`Pay schedule: ${t.salaryTypeLabel}`);
    }
    if (t.payBasis) {
      writeLine(`Pay basis: ${t.payBasis}`);
    }
    if (t.periodDays != null) {
      writeLine(`Days in period: ${t.periodDays}`);
    }
    writeLine(`Days present / completed: ${t.daysPresent} / ${t.daysCompleted}`);
    writeLine(`Paid day units: ${t.paidDayUnits.toFixed(2)} (full=1.0, half=0.5)`);
    writeLine(`Total hours: ${t.totalHours.toFixed(2)} h`);
    writeLine(`Approved overtime: ${t.approvedOvertimeHours.toFixed(2)} h`);
    if (t.pendingOvertimeHours > 0) {
      doc.fillColor('#b45309');
      writeLine(`Pending overtime (not paid): ${t.pendingOvertimeHours.toFixed(2)} h`);
      doc.fillColor('#0f172a');
    }
    doc.moveDown(0.35);
    writeLine(`Base pay: ${money(t.basePay)}`);
    writeLine(`Overtime pay: ${money(t.overtimePay)}`);
    doc.moveDown(0.25);
    doc.fontSize(13).fillColor('#0047FF');
    writeLine(`Net estimated pay: ${money(t.estimatedPay)}`);

    const range = doc.bufferedPageRange();
    const pageCount = range.count;
    for (let i = 0; i < pageCount; i += 1) {
      doc.switchToPage(range.start + i);
      // Draw in the bottom margin so PDFKit does not flow this onto extra pages.
      doc.page.margins.bottom = 0;

      const footerWidth = doc.page.width - pageMargin.left - pageMargin.right;
      const disclaimerY = doc.page.height - 50;
      const pageLineY = doc.page.height - 36;

      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#64748b');
      doc.text(
        'This payslip is system-generated by PCmazing Payroll and for employee reference only.',
        pageMargin.left,
        disclaimerY,
        { width: footerWidth, align: 'center', lineBreak: false },
      );
      doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
      doc.text(
        `Page ${i + 1} of ${pageCount}  |  Generated ${payload.generatedAt}`,
        pageMargin.left,
        pageLineY,
        { width: footerWidth, align: 'center', lineBreak: false },
      );

      doc.page.margins.bottom = pageMargin.bottom;
    }

    doc.font('Helvetica');
    doc.end();
  });
}
