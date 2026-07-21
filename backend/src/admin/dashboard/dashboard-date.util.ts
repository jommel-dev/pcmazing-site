import { BadRequestException } from '@nestjs/common';
import { DashboardPeriod } from './dto/dashboard-overview-query.dto';

export interface DashboardDateRange {
  period: DashboardPeriod;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  label: string;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(date: Date): Date {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfMonth(date: Date): Date {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

function parseIsoDate(value: string, label: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${label} is invalid.`);
  }

  return parsed;
}

export function resolveDashboardDateRange(input: {
  period?: DashboardPeriod;
  startDate?: string;
  endDate?: string;
}): DashboardDateRange {
  const period = input.period ?? 'weekly';
  const now = new Date();

  if (period === 'custom') {
    if (!input.startDate || !input.endDate) {
      throw new BadRequestException('startDate and endDate are required for custom period.');
    }

    const start = startOfDay(parseIsoDate(input.startDate, 'startDate'));
    const end = endOfDay(parseIsoDate(input.endDate, 'endDate'));

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('startDate must be before or equal to endDate.');
    }

    const durationMs = end.getTime() - start.getTime() + 1;
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - durationMs + 1);

    return {
      period,
      start,
      end,
      previousStart,
      previousEnd,
      label: `${input.startDate} to ${input.endDate}`,
    };
  }

  if (period === 'daily') {
    const start = startOfDay(now);
    const end = endOfDay(now);
    const previousStart = startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const previousEnd = endOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    return {
      period,
      start,
      end,
      previousStart,
      previousEnd,
      label: 'Today',
    };
  }

  if (period === 'monthly') {
    const start = startOfMonth(now);
    const end = endOfDay(now);
    const previousMonthEnd = new Date(start.getTime() - 1);
    const previousStart = startOfMonth(previousMonthEnd);
    const previousEnd = endOfDay(previousMonthEnd);

    return {
      period,
      start,
      end,
      previousStart,
      previousEnd,
      label: now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
    };
  }

  const start = startOfWeek(now);
  const end = endOfDay(now);
  const previousEnd = endOfDay(new Date(start.getTime() - 1));
  const previousStart = startOfWeek(previousEnd);

  return {
    period: 'weekly',
    start,
    end,
    previousStart,
    previousEnd,
    label: 'This week',
  };
}
