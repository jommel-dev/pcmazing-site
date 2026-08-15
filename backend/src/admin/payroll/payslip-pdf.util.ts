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
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 48, bottom: 64, left: 48, right: 48 },
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
    const contentBottom = () => doc.page.height - doc.page.margins.bottom - 8;

    doc
      .fontSize(18)
      .fillColor('#0047FF')
      .text(payload.companyName, { align: 'left' });
    doc
      .moveDown(0.15)
      .fontSize(12)
      .fillColor('#0f172a')
      .text('Employee Payslip');

    doc.moveDown(0.7);
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .stroke();
    doc.moveDown(0.7);

    doc.fontSize(10).fillColor('#0f172a');
    doc.text(`Employee: ${payload.employee.fullName}`);
    doc.text(`Position: ${payload.employee.positionTitle?.trim() || '—'}`);
    doc.text(`Payroll Period: ${payload.dateFrom} - ${payload.dateTo}`);

    doc.moveDown(0.9);
    doc.fontSize(11).fillColor('#0f172a').text('Compensation Summary', { underline: true });
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

    const drawTableHeader = () => {
      const y = doc.y;
      doc.fontSize(8).fillColor('#64748b');
      doc.text('Date', col.date, y, { width: 65 });
      doc.text('Shift', col.shift, y, { width: 85 });
      doc.text('Hours', col.hours, y, { width: 45 });
      doc.text('Day', col.type, y, { width: 60 });
      doc.text('Day pay', col.dayPay, y, { width: 70 });
      doc.text('OT hrs', col.ot, y, { width: 75 });
      doc.text('OT pay', col.otPay, y, { width: 70 });
      doc.moveDown(0.35);
      doc
        .strokeColor('#e2e8f0')
        .moveTo(left, doc.y)
        .lineTo(right, doc.y)
        .stroke();
      doc.moveDown(0.25);
    };

    drawTableHeader();

    for (const day of payload.days) {
      if (doc.y > contentBottom() - 24) {
        doc.addPage();
        drawTableHeader();
      }

      const y = doc.y;
      doc.fontSize(8).fillColor('#0f172a');
      doc.text(day.workDate, col.date, y, { width: 65 });
      doc.text(`${day.timeInLabel}-${day.timeOutLabel}`, col.shift, y, { width: 85 });
      doc.text(day.hoursWorked.toFixed(2), col.hours, y, { width: 45 });
      doc.text(day.dayType, col.type, y, { width: 60 });
      doc.text(money(day.dayPay), col.dayPay, y, { width: 70 });
      doc.text(
        day.overtimeHours > 0 ? `${day.overtimeHours.toFixed(2)} (${day.overtimeStatus})` : '-',
        col.ot,
        y,
        { width: 75 },
      );
      doc.text(day.overtimePay > 0 ? money(day.overtimePay) : '-', col.otPay, y, { width: 70 });
      doc.moveDown(0.55);
    }

    if (payload.days.length === 0) {
      doc.fontSize(9).fillColor('#64748b').text('No attendance punches in this period.');
    }

    doc.moveDown(0.8);
    if (doc.y > contentBottom() - 140) {
      doc.addPage();
    }

    doc.x = left;
    doc.fontSize(11).fillColor('#0f172a').text('Summary', left, doc.y, {
      underline: true,
      width: pageWidth,
      align: 'left',
    });
    doc.moveDown(0.4);

    const t = payload.totals;
    doc.fontSize(10).fillColor('#0f172a');
    doc.text(`Days present / completed: ${t.daysPresent} / ${t.daysCompleted}`, {
      align: 'left',
      width: pageWidth,
    });
    doc.text(`Paid day units: ${t.paidDayUnits.toFixed(2)} (full=1.0, half=0.5)`, {
      align: 'left',
      width: pageWidth,
    });
    doc.text(`Total hours: ${t.totalHours.toFixed(2)} h`, { align: 'left', width: pageWidth });
    doc.text(`Approved overtime: ${t.approvedOvertimeHours.toFixed(2)} h`, {
      align: 'left',
      width: pageWidth,
    });
    if (t.pendingOvertimeHours > 0) {
      doc
        .fillColor('#b45309')
        .text(`Pending overtime (not paid): ${t.pendingOvertimeHours.toFixed(2)} h`, {
          align: 'left',
          width: pageWidth,
        });
      doc.fillColor('#0f172a');
    }
    doc.moveDown(0.35);
    doc.text(`Base pay: ${money(t.basePay)}`, { align: 'left', width: pageWidth });
    doc.text(`Overtime pay: ${money(t.overtimePay)}`, { align: 'left', width: pageWidth });
    doc.moveDown(0.25);
    doc
      .fontSize(13)
      .fillColor('#0047FF')
      .text(`Net estimated pay: ${money(t.estimatedPay)}`, {
        align: 'left',
        width: pageWidth,
      });

    // Draw footer on existing pages only — never let text wrapping create a new page.
    const range = doc.bufferedPageRange();
    const pageCount = range.count;
    for (let i = 0; i < pageCount; i += 1) {
      doc.switchToPage(range.start + i);
      const footerTop = doc.page.height - 48;
      doc.save();
      doc.fontSize(7).fillColor('#94a3b8');
      doc.text(
        'This payslip is system-generated by PCmazing Payroll and for employee reference only.',
        left,
        footerTop,
        { width: pageWidth, lineBreak: false },
      );
      doc.text(
        `Page ${i + 1} of ${pageCount}  |  Generated ${payload.generatedAt}`,
        left,
        footerTop + 12,
        { width: pageWidth, lineBreak: false },
      );
      doc.restore();
    }

    doc.end();
  });
}
