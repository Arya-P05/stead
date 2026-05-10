import type { DailyOutcome } from './appState';

export type CalendarDay = {
  date: string;
  label: string;
  tracked: boolean;
  selectable: boolean;
  future: boolean;
};

export type CalendarMonth = {
  label: string;
  meta: string;
  weeks: Array<Array<CalendarDay | null>>;
};

const monthNames = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export function createCalendarMonth(
  outcomes: DailyOutcome[],
  todayDate: string,
  visibleMonthDate = todayDate,
): CalendarMonth {
  const trackedDates = new Set(outcomes.map((outcome) => outcome.date));
  const today = parseDate(todayDate);
  const visibleMonth = parseDate(visibleMonthDate);
  const year = visibleMonth.getUTCFullYear();
  const month = visibleMonth.getUTCMonth();
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));
  const weeks: Array<Array<CalendarDay | null>> = [[]];

  for (let index = 0; index < firstOfMonth.getUTCDay(); index += 1) {
    weeks[0].push(null);
  }

  const cursor = new Date(firstOfMonth);

  while (cursor.getTime() <= lastOfMonth.getTime()) {
    const date = formatDate(cursor);
    const tracked = trackedDates.has(date);
    const future = cursor.getTime() > today.getTime();
    const currentWeek = weeks[weeks.length - 1];

    currentWeek.push({
      date,
      label: date.slice(-2),
      tracked,
      selectable: tracked && !future,
      future,
    });

    if (currentWeek.length === 7) {
      weeks.push([]);
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    label: `${monthNames[month]} ${year}`,
    meta: createMonthMeta({ month, today, trackedDates, year }),
    weeks: weeks.filter((week) => week.length > 0),
  };
}

function createMonthMeta({
  month,
  today,
  trackedDates,
  year,
}: {
  month: number;
  today: Date;
  trackedDates: Set<string>;
  year: number;
}) {
  if (today.getUTCFullYear() === year && today.getUTCMonth() === month) {
    return `${today.getUTCDate()} days in`;
  }

  const trackedDays = [...trackedDates].filter((date) => {
    const parsed = parseDate(date);

    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month;
  }).length;

  return `${trackedDays} days tracked`;
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
