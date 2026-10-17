import { manilaWorkDate } from './payroll.schema';

export const LUNCH_CONFIRM_HOUR_MANILA = 11;
export const MAX_LUNCH_MINUTES = 60;

export type PunchOutIntent = 'lunch' | 'end_of_day';
export type BypassAction = 'time_in' | 'lunch_out' | 'lunch_in' | 'time_out';

export type AttendancePunchRow = {
  timeIn: string | null;
  lunchOut: string | null;
  lunchIn: string | null;
  timeOut: string | null;
  workDate?: string | null;
};

export function manilaHour(value: string | Date): number {
  const d = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const hourRaw = parts.find((p) => p.type === 'hour')?.value ?? '0';
  // en-US hour12:false can still emit "24" for midnight in some engines
  const hour = Number(hourRaw);
  return hour === 24 ? 0 : hour;
}

export function punchOutRequiresLunchConfirm(
  serverNow: string | Date,
  row: Pick<AttendancePunchRow, 'timeIn' | 'lunchOut' | 'timeOut'>,
): boolean {
  if (!row.timeIn || row.lunchOut || row.timeOut) {
    return false;
  }
  return manilaHour(serverNow) >= LUNCH_CONFIRM_HOUR_MANILA;
}

export function lunchMinutes(
  lunchOut: string | null,
  lunchIn: string | null,
  now = new Date(),
): number | null {
  if (!lunchOut) {
    return null;
  }
  const end = lunchIn ? new Date(lunchIn) : now;
  const ms = end.getTime() - new Date(lunchOut).getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return null;
  }
  return Math.floor(ms / 60000);
}

export function overbreakMinutes(lunchMins: number | null): number {
  if (lunchMins == null) {
    return 0;
  }
  return Math.max(0, lunchMins - MAX_LUNCH_MINUTES);
}

function stampAfter(
  earlier: string | null,
  at: Date,
  label: string,
): void {
  if (!earlier) {
    return;
  }
  if (at.getTime() < new Date(earlier).getTime()) {
    throw new Error(`${label} must be after the previous punch.`);
  }
}

export function assertBypassAllowed(
  action: BypassAction,
  row: AttendancePunchRow,
  at: Date,
): void {
  if (!Number.isFinite(at.getTime())) {
    throw new Error('Invalid bypass time.');
  }

  if (row.workDate) {
    const atWorkDate = manilaWorkDate(at);
    if (atWorkDate !== row.workDate) {
      throw new Error('Bypass time must fall on the attendance work date.');
    }
  }

  switch (action) {
    case 'time_in':
      if (row.timeIn) {
        throw new Error('Time in is already recorded.');
      }
      return;
    case 'lunch_out':
      if (!row.timeIn) {
        throw new Error('Time in is required before lunch out.');
      }
      if (row.lunchOut) {
        throw new Error('Lunch out is already recorded.');
      }
      if (row.timeOut) {
        throw new Error('Cannot lunch out after time out.');
      }
      stampAfter(row.timeIn, at, 'Lunch out');
      return;
    case 'lunch_in':
      if (!row.lunchOut) {
        throw new Error('Lunch out is required before lunch in.');
      }
      if (row.lunchIn) {
        throw new Error('Lunch in is already recorded.');
      }
      if (row.timeOut) {
        throw new Error('Cannot lunch in after time out.');
      }
      stampAfter(row.lunchOut, at, 'Lunch in');
      return;
    case 'time_out':
      if (!row.timeIn) {
        throw new Error('Time in is required before time out.');
      }
      if (row.timeOut) {
        throw new Error('Time out is already recorded.');
      }
      if (row.lunchOut && !row.lunchIn) {
        throw new Error('Lunch in is required before time out.');
      }
      stampAfter(row.lunchIn ?? row.timeIn, at, 'Time out');
      return;
    default:
      throw new Error('Unknown bypass action.');
  }
}

export function nextBypassActions(row: AttendancePunchRow): BypassAction[] {
  const actions: BypassAction[] = [];
  if (!row.timeIn) {
    actions.push('time_in');
    return actions;
  }
  if (row.timeOut) {
    return actions;
  }
  if (row.lunchOut && !row.lunchIn) {
    actions.push('lunch_in');
    return actions;
  }
  if (!row.lunchOut) {
    actions.push('lunch_out');
  }
  if (!row.lunchOut || row.lunchIn) {
    actions.push('time_out');
  }
  return actions;
}

export type AdminEditPunchField =
  | 'time_in'
  | 'lunch_out'
  | 'lunch_in'
  | 'time_out';

export type AdminEditChange = {
  field: AdminEditPunchField;
  oldValue: string;
  newValue: string;
};

function normalizePunchIso(value: string | null | undefined): string | null {
  if (value == null || !String(value).trim()) {
    return null;
  }
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

/**
 * Validates an admin punch edit (change-only, no clear).
 * `next` must already be the fully merged row state after applying requested fields.
 * Returns the list of actual changes (normalized ISO).
 */
export function assertAdminEditAllowed(
  current: AttendancePunchRow,
  next: AttendancePunchRow,
  workDate: string,
): AdminEditChange[] {
  const fields: Array<{
    key: AdminEditPunchField;
    label: string;
    cur: string | null;
    nxt: string | null;
  }> = [
    {
      key: 'time_in',
      label: 'Time in',
      cur: current.timeIn,
      nxt: next.timeIn,
    },
    {
      key: 'lunch_out',
      label: 'Lunch out',
      cur: current.lunchOut,
      nxt: next.lunchOut,
    },
    {
      key: 'lunch_in',
      label: 'Lunch in',
      cur: current.lunchIn,
      nxt: next.lunchIn,
    },
    {
      key: 'time_out',
      label: 'Time out',
      cur: current.timeOut,
      nxt: next.timeOut,
    },
  ];

  const changes: AdminEditChange[] = [];
  for (const field of fields) {
    const oldValue = normalizePunchIso(field.cur);
    const newValue = normalizePunchIso(field.nxt);
    if (oldValue === newValue) {
      continue;
    }
    if (!oldValue) {
      throw new Error(
        `${field.label} is not recorded. Use Bypass to fill missing punches.`,
      );
    }
    if (!newValue) {
      throw new Error(`${field.label} cannot be cleared.`);
    }
    if (manilaWorkDate(new Date(newValue)) !== workDate) {
      throw new Error(`${field.label} must fall on the attendance work date.`);
    }
    changes.push({ field: field.key, oldValue, newValue });
  }

  if (changes.length === 0) {
    throw new Error('No punch changes provided.');
  }

  const timeIn = normalizePunchIso(next.timeIn);
  const lunchOut = normalizePunchIso(next.lunchOut);
  const lunchIn = normalizePunchIso(next.lunchIn);
  const timeOut = normalizePunchIso(next.timeOut);

  if (timeIn && lunchOut && new Date(lunchOut).getTime() < new Date(timeIn).getTime()) {
    throw new Error('Lunch out must be after time in.');
  }
  if (lunchOut && lunchIn && new Date(lunchIn).getTime() < new Date(lunchOut).getTime()) {
    throw new Error('Lunch in must be after lunch out.');
  }
  if (lunchOut && !lunchIn && timeOut) {
    throw new Error('Lunch in is required before time out.');
  }
  const timeOutFloor = lunchIn ?? timeIn;
  if (
    timeOut &&
    timeOutFloor &&
    new Date(timeOut).getTime() < new Date(timeOutFloor).getTime()
  ) {
    throw new Error('Time out must be after the previous punch.');
  }
  if (timeIn && timeOut && !lunchOut && new Date(timeOut).getTime() < new Date(timeIn).getTime()) {
    throw new Error('Time out must be after time in.');
  }

  return changes;
}
