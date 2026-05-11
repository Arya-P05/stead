import { createCalendarMonth } from "./calendarDays";
import type { DailyOutcome } from "./appState";

const outcomes: DailyOutcome[] = [
  {
    date: "2026-05-09",
    completedItems: 6,
    plannedItems: 7,
    steps: 10000,
    focusMinutes: 180,
  },
  {
    date: "2026-05-11",
    completedItems: 4,
    plannedItems: 7,
    steps: 7200,
    focusMinutes: 90,
  },
];

describe("createCalendarMonth", () => {
  it("builds a centered month grid with leading blanks", () => {
    const month = createCalendarMonth(outcomes, "2026-05-11", "2026-05-01");

    expect(month.label).toBe("may 2026");
    expect(month.meta).toBe("11 days in");
    expect(month.weeks[0]).toEqual([
      null,
      null,
      null,
      null,
      null,
      {
        date: "2026-05-01",
        label: "01",
        tracked: false,
        selectable: false,
        future: false,
      },
      {
        date: "2026-05-02",
        label: "02",
        tracked: false,
        selectable: false,
        future: false,
      },
    ]);
  });

  it("marks tracked days selectable and untracked days dimmed", () => {
    const month = createCalendarMonth(outcomes, "2026-05-11", "2026-05-01");
    const days = month.weeks.flat().filter((day) => day !== null);

    expect(days.find((day) => day.date === "2026-05-09")).toMatchObject({
      tracked: true,
      selectable: true,
    });
    expect(days.find((day) => day.date === "2026-05-10")).toMatchObject({
      tracked: false,
      selectable: false,
    });
    expect(days.find((day) => day.date === "2026-05-11")).toMatchObject({
      tracked: true,
      selectable: true,
    });
  });

  it("includes the full month and marks future days unavailable", () => {
    const month = createCalendarMonth(outcomes, "2026-05-11", "2026-05-01");
    const days = month.weeks.flat().filter((day) => day !== null);

    expect(days.at(-1)).toMatchObject({
      date: "2026-05-31",
      future: true,
      selectable: false,
    });
  });

  it("pads the final week so columns stay aligned", () => {
    const month = createCalendarMonth(outcomes, "2026-05-11", "2026-05-01");

    expect(month.weeks.at(-1)).toEqual([
      {
        date: "2026-05-31",
        label: "31",
        tracked: false,
        selectable: false,
        future: true,
      },
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("can build a previous visible month", () => {
    const month = createCalendarMonth(outcomes, "2026-05-11", "2026-04-01");
    const days = month.weeks.flat().filter((day) => day !== null);

    expect(month.label).toBe("april 2026");
    expect(month.meta).toBe("0 days tracked");
    expect(days.at(-1)?.date).toBe("2026-04-30");
  });
});
