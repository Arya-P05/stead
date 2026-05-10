import { createCalendarDays } from './calendarDays';
import type { DailyOutcome } from './appState';

const outcomes: DailyOutcome[] = [
  {
    date: '2026-05-09',
    completedItems: 6,
    plannedItems: 7,
    steps: 10000,
    focusMinutes: 180,
  },
  {
    date: '2026-05-11',
    completedItems: 4,
    plannedItems: 7,
    steps: 7200,
    focusMinutes: 90,
  },
];

describe('createCalendarDays', () => {
  it('builds every day since tracking started through today', () => {
    expect(createCalendarDays(outcomes, '2026-05-11')).toEqual([
      { date: '2026-05-09', label: '09', tracked: true },
      { date: '2026-05-10', label: '10', tracked: false },
      { date: '2026-05-11', label: '11', tracked: true },
    ]);
  });

  it('starts at today when no outcomes exist', () => {
    expect(createCalendarDays([], '2026-05-11')).toEqual([
      { date: '2026-05-11', label: '11', tracked: false },
    ]);
  });

  it('sorts unsorted outcomes before creating the range', () => {
    expect(createCalendarDays([...outcomes].reverse(), '2026-05-11')[0]).toEqual({
      date: '2026-05-09',
      label: '09',
      tracked: true,
    });
  });
});
