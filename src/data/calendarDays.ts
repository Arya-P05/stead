import type { DailyOutcome } from './appState';

export type CalendarDay = {
  date: string;
  label: string;
  tracked: boolean;
  selectable: boolean;
};

export type CalendarMonth = {
  label: string;
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
): CalendarMonth {
  const trackedDates = new Set(outcomes.map((outcome) => outcome.date));
  const today = parseDate(todayDate);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const weeks: Array<Array<CalendarDay | null>> = [[]];

  for (let index = 0; index < firstOfMonth.getUTCDay(); index += 1) {
    weeks[0].push(null);
  }

  const cursor = new Date(firstOfMonth);

  while (cursor.getTime() <= today.getTime() && cursor.getUTCMonth() === month) {
    const date = formatDate(cursor);
    const tracked = trackedDates.has(date);
    const currentWeek = weeks[weeks.length - 1];

    currentWeek.push({
      date,
      label: date.slice(-2),
      tracked,
      selectable: tracked,
    });

    if (currentWeek.length === 7) {
      weeks.push([]);
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    label: `${monthNames[month]} ${year}`,
    weeks: weeks.filter((week) => week.length > 0),
  };
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
