/**
 * Seeds test clock-in/out attendance for payroll-enabled employees.
 *
 * Patterns (weekdays only, current Manila semi-monthly half):
 * - full day: 9.0h
 * - half day: 4.5h
 * - overtime eligible (not yet requested): 10.5h → OT 1.5h, status none
 * - overtime pending: 11.0h → OT 2.0h, status pending
 * - below half: 3.0h (unpaid day)
 *
 * Usage (from backend/):
 *   node scripts/seed-attendance-test-data.mjs
 *   node scripts/seed-attendance-test-data.mjs --replace
 */
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
config({ path: resolve(root, '.env') });

const REPLACE = process.argv.includes('--replace');
const FULL_DAY_HOURS = 9;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});

function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Weekdays in the current Manila semi-monthly half, excluding today. */
function seedWorkDates(todayIso) {
  const [y, m, d] = todayIso.split('-').map(Number);
  const halfStart = d <= 15 ? 1 : 16;
  const halfEnd = d <= 15 ? Math.min(15, d - 1) : Math.min(d - 1, new Date(y, m, 0).getDate());
  const dates = [];

  for (let day = halfStart; day <= halfEnd; day += 1) {
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const localWeekday = new Date(`${iso}T00:00:00+08:00`).getDay();
    if (localWeekday === 0 || localWeekday === 6) {
      continue;
    }
    dates.push(iso);
  }

  // If half just started and no prior weekdays, seed a few recent weekdays before today.
  if (dates.length === 0) {
    const cursor = new Date(`${todayIso}T12:00:00+08:00`);
    while (dates.length < 6) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      const iso = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(cursor);
      const wd = new Date(`${iso}T00:00:00+08:00`).getDay();
      if (wd !== 0 && wd !== 6) {
        dates.unshift(iso);
      }
    }
  }

  return dates;
}

function shiftPattern(index) {
  const patterns = [
    {
      key: 'full',
      label: 'full day 9h',
      inHour: 9,
      inMinute: 0,
      outHour: 18,
      outMinute: 0,
      overtimeStatus: 'none',
    },
    {
      key: 'half',
      label: 'half day 4.5h',
      inHour: 9,
      inMinute: 0,
      outHour: 13,
      outMinute: 30,
      overtimeStatus: 'none',
    },
    {
      key: 'ot_eligible',
      label: 'OT eligible 10.5h (request in portal)',
      inHour: 8,
      inMinute: 30,
      outHour: 19,
      outMinute: 0,
      overtimeStatus: 'none',
    },
    {
      key: 'ot_pending',
      label: 'OT pending 11h',
      inHour: 8,
      inMinute: 0,
      outHour: 19,
      outMinute: 0,
      overtimeStatus: 'pending',
    },
    {
      key: 'below_half',
      label: 'below half 3h',
      inHour: 9,
      inMinute: 0,
      outHour: 12,
      outMinute: 0,
      overtimeStatus: 'none',
    },
    {
      key: 'ot_eligible_long',
      label: 'OT eligible 12h (request in portal)',
      inHour: 8,
      inMinute: 0,
      outHour: 20,
      outMinute: 0,
      overtimeStatus: 'none',
    },
  ];
  return patterns[index % patterns.length];
}

function manilaTimestamp(workDate, hour, minute) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${workDate} ${hh}:${mm}:00+08`;
}

function hoursBetween(workDate, inH, inM, outH, outM) {
  const start = new Date(`${workDate}T${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:00+08:00`).getTime();
  const end = new Date(`${workDate}T${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:00+08:00`).getTime();
  return Math.round(((end - start) / 3_600_000) * 100) / 100;
}

async function resolveUsername(userId, userSource) {
  if (userSource === 'tblusers') {
    const result = await client.query(
      `SELECT username FROM tblusers WHERE id = $1 LIMIT 1`,
      [userId],
    );
    return result.rows[0]?.username ?? `user${userId}`;
  }

  const result = await client.query(
    `SELECT username FROM pcmazing_admin_users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.username ?? `user${userId}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing in backend/.env');
  }

  await client.connect();

  const employees = await client.query(
    `SELECT user_id, user_source
     FROM pcmazing_user_payroll
     WHERE payroll_enabled = TRUE
     ORDER BY user_id ASC`,
  );

  if (employees.rows.length === 0) {
    console.log('[seed-attendance] No payroll-enabled employees found. Enable payroll on users first.');
    return;
  }

  const today = manilaToday();
  const workDates = seedWorkDates(today);
  if (workDates.length === 0) {
    console.log('[seed-attendance] No work dates to seed.');
    return;
  }

  console.log(`[seed-attendance] Today (Manila): ${today}`);
  console.log(`[seed-attendance] Employees: ${employees.rows.length}`);
  console.log(`[seed-attendance] Work dates: ${workDates.join(', ')}`);
  console.log(`[seed-attendance] Mode: ${REPLACE ? 'replace existing rows' : 'skip existing rows'}`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const [empIndex, emp] of employees.rows.entries()) {
    const username = await resolveUsername(emp.user_id, emp.user_source);

    for (const [dayIndex, workDate] of workDates.entries()) {
      const pattern = shiftPattern(empIndex + dayIndex);
      const totalHours = hoursBetween(
        workDate,
        pattern.inHour,
        pattern.inMinute,
        pattern.outHour,
        pattern.outMinute,
      );
      const overtimeHours =
        totalHours > FULL_DAY_HOURS
          ? Math.round((totalHours - FULL_DAY_HOURS) * 100) / 100
          : 0;
      const overtimeStatus =
        overtimeHours > 0
          ? pattern.overtimeStatus === 'pending'
            ? 'pending'
            : 'none'
          : 'none';

      const timeIn = manilaTimestamp(workDate, pattern.inHour, pattern.inMinute);
      const timeOut = manilaTimestamp(workDate, pattern.outHour, pattern.outMinute);

      if (!REPLACE) {
        const existing = await client.query(
          `SELECT id FROM pcmazing_attendance
           WHERE user_id = $1 AND user_source = $2 AND work_date = $3::date
           LIMIT 1`,
          [emp.user_id, emp.user_source, workDate],
        );
        if (existing.rows[0]) {
          skipped += 1;
          continue;
        }
      }

      const result = await client.query(
        `INSERT INTO pcmazing_attendance (
           user_id, user_source, username, work_date,
           time_in, time_out,
           overtime_hours, overtime_status,
           overtime_reviewed_by, overtime_reviewed_at, overtime_review_note,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4::date,
           $5::timestamptz, $6::timestamptz,
           $7, $8,
           NULL, NULL, NULL,
           NOW(), NOW()
         )
         ON CONFLICT (user_id, user_source, work_date) DO UPDATE SET
           username = EXCLUDED.username,
           time_in = EXCLUDED.time_in,
           time_out = EXCLUDED.time_out,
           overtime_hours = EXCLUDED.overtime_hours,
           overtime_status = EXCLUDED.overtime_status,
           overtime_reviewed_by = NULL,
           overtime_reviewed_at = NULL,
           overtime_review_note = NULL,
           updated_at = NOW()
         RETURNING (xmax = 0) AS inserted`,
        [
          emp.user_id,
          emp.user_source,
          username,
          workDate,
          timeIn,
          timeOut,
          overtimeHours,
          overtimeStatus,
        ],
      );

      if (result.rows[0]?.inserted) {
        inserted += 1;
      } else {
        updated += 1;
      }

      console.log(
        `  @${username} ${workDate}: ${pattern.label} (${totalHours}h, OT ${overtimeHours}h / ${overtimeStatus})`,
      );
    }
  }

  console.log(
    `[seed-attendance] Done. inserted=${inserted} updated=${updated} skipped=${skipped}`,
  );
  console.log(
    '[seed-attendance] Tip: employees with OT status "none" can Request approval in their portal.',
  );
}

main()
  .catch((error) => {
    console.error('[seed-attendance] Failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => undefined);
  });
