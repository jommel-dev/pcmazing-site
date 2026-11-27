import type {
  EmployeeMemoListItem,
  EmployeeTimesheetMine,
  EmployeeWorkspaceDashboard,
} from '../../../admin/services/admin-api.service';
import type { PortalIconName } from '../ui/portal-icons.data';
import { formatManilaTime, formatMoney } from './portal-format';

export interface PortalNotice {
  id: string;
  title: string;
  message: string;
  whenLabel: string;
  today: boolean;
  icon: PortalIconName;
  /** Router link target inside the portal. */
  link: string;
}

export interface PortalNoticeSource {
  dashboard: EmployeeWorkspaceDashboard | null;
  memos: EmployeeMemoListItem[];
  timesheet: EmployeeTimesheetMine | null;
}

/** Same inbox the app derives from memos, payslips, punches, requests and the timesheet. */
export function buildPortalNotices(source: PortalNoticeSource): PortalNotice[] {
  const { dashboard, memos, timesheet } = source;
  const todayKey = dashboard?.workDate?.slice(0, 10) ?? '';
  const items: PortalNotice[] = [];

  for (const memo of memos) {
    const date = memo.issuedAt?.slice(0, 10) ?? '';
    const isToday = !!date && date === todayKey;
    items.push({
      id: `memo-${memo.id}`,
      title: memo.subject || 'Company memo',
      message: [memo.memoNo, memo.memoTypeLabel].filter(Boolean).join(' · '),
      whenLabel: isToday ? 'Today' : date,
      today: isToday,
      icon: 'shield',
      link: `/user/memos`,
    });
  }

  for (const slip of dashboard?.payslips?.slice(0, 3) ?? []) {
    const date = slip.dateTo.slice(0, 10);
    const isToday = !!todayKey && date === todayKey;
    items.push({
      id: `slip-${slip.id}`,
      title: 'Payslip ready',
      message: `${slip.label || `${slip.dateFrom} – ${slip.dateTo}`} · ${formatMoney(slip.estimatedPay)}`,
      whenLabel: isToday ? 'Today' : date,
      today: isToday,
      icon: 'payslip',
      link: `/user/payslip/${slip.id}`,
    });
  }

  for (const day of dashboard?.attendanceDays ?? []) {
    const date = day.workDate.slice(0, 10);
    const hasIn = !!day.timeIn;
    const noOut = !day.timeOut;
    if (date === todayKey && hasIn && noOut) {
      items.push({
        id: `clock-${date}`,
        title: 'Clocked in',
        message: `You clocked in at ${formatManilaTime(day.timeIn)}. Remember to clock out.`,
        whenLabel: 'Today',
        today: true,
        icon: 'clock',
        link: '/user/clock',
      });
    } else if (date !== todayKey && hasIn && noOut && day.id != null) {
      items.push({
        id: `missing-${day.id}`,
        title: 'Missing punch',
        message: `Your attendance for ${date} is missing a time out.`,
        whenLabel: date,
        today: false,
        icon: 'clock',
        link: `/user/adjust/${day.id}/${date}`,
      });
    }
  }

  const overtime = dashboard?.overtimeNotice?.message;
  if (overtime) {
    items.push({
      id: 'ot',
      title: 'Overtime',
      message: overtime,
      whenLabel: 'Today',
      today: true,
      icon: 'timesheet',
      link: '/user/timesheet',
    });
  }

  const adjustment = dashboard?.adjustmentNotice?.message;
  if (adjustment) {
    items.push({
      id: 'adjust',
      title: 'Time-out request',
      message: adjustment,
      whenLabel: 'Today',
      today: true,
      icon: 'clock',
      link: '/user/attendance',
    });
  }

  const sheet = timesheet?.timesheet;
  if (sheet) {
    const label =
      sheet.status === 'submitted'
        ? 'Your timesheet is with the COO and CEO.'
        : sheet.status === 'reverted'
          ? (sheet.reviewNote ?? 'Your timesheet was sent back for recheck.')
          : sheet.status === 'approved'
            ? 'Your timesheet is approved and waiting for the founder.'
            : sheet.status === 'finalized'
              ? `Your payslip posts on ${sheet.postedOn ?? 'the chosen date'}.`
              : null;
    if (label) {
      items.push({
        id: `timesheet-${sheet.id}`,
        title: 'Timesheet',
        message: label,
        whenLabel: 'Today',
        today: true,
        icon: 'timesheet',
        link: '/user/timesheet',
      });
    }
  }

  return items;
}
