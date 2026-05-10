import type { DailyOutcome } from './appState';

export type CalendarDay = {
  date: string;
  label: string;
  tracked: boolean;
};

export function createCalendarDays(
  outcomes: DailyOutcome[],
  todayDate: string,
): CalendarDay[] {
  const trackedDates = new Set(outcomes.map((outcome) => outcome.date));
  const sortedDates = [...trackedDates].sort();
  const startDate = sortedDates[0] ?? todayDate;
  const days: CalendarDay[] = [];
  const cursor = parseDate(startDate);
  const end = parseDate(todayDate);

  while (cursor.getTime() <= end.getTime()) {
    const date = formatDate(cursor);

    days.push({
      date,
      label: date.slice(-2),
      tracked: trackedDates.has(date),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
