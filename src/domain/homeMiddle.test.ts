import { chooseHomeMiddle } from "./homeMiddle";
import type { Recommendation } from "./recommendations";

const walkRecommendation: Recommendation = {
  action: "take a 10 min walk",
  reason: "sunny window before calls",
  type: "walk",
};

describe("chooseHomeMiddle", () => {
  it("shows the moment when focus has run long and walking is useful", () => {
    expect(
      chooseHomeMiddle({
        minutesWorked: 190,
        recommendation: walkRecommendation,
        remainingItems: [],
      }),
    ).toEqual({
      type: "moment",
      meta: "focused · 3h 10m",
      phrase: "you've been at it three hours.\nthe sun is out.",
      action: "walk · ten min",
    });
  });

  it("shows today's three when the day has several remaining items", () => {
    expect(
      chooseHomeMiddle({
        minutesWorked: 80,
        recommendation: {
          action: "keep going",
          reason: "day is on track",
          type: "steady",
        },
        remainingItems: [
          { title: "walk" },
          { title: "push day", action: "workout" },
          { title: "read" },
        ],
      }),
    ).toEqual({
      type: "today",
      meta: "three left today",
      items: [
        { title: "walk" },
        { title: "push day", action: "workout" },
        { title: "read" },
      ],
    });
  });

  it("shows what's next when the next item is a workout", () => {
    expect(
      chooseHomeMiddle({
        minutesWorked: 80,
        recommendation: {
          action: "start push day",
          reason: "planned session still open",
          type: "workout",
        },
        remainingItems: [{ title: "push day", action: "workout" }],
      }),
    ).toEqual({
      type: "next",
      label: "next",
      title: "push day",
      meta: "6:30 · 5 lifts · 17 sets · ~47 min",
      action: "start now",
      detail: "walk · ten min · sun is out",
    });
  });
});
