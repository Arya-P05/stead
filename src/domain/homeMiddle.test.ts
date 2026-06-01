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
          { id: "walk", title: "walk" },
          { id: "push", title: "push day", action: "workout" },
          { id: "read", title: "read" },
        ],
      }),
    ).toEqual({
      type: "today",
      meta: "three left today",
      items: [
        { id: "walk", title: "walk" },
        { id: "push", title: "push day", action: "workout" },
        { id: "read", title: "read" },
      ],
    });
  });

  it("shows a calm cleared state when nothing is left", () => {
    expect(
      chooseHomeMiddle({
        minutesWorked: 80,
        recommendation: {
          action: "keep going",
          reason: "day is on track",
          type: "steady",
        },
        remainingItems: [],
      }),
    ).toEqual({
      type: "today",
      meta: "clear today",
      items: [],
    });
  });

  it("keeps completed items visible while counting only open items", () => {
    expect(
      chooseHomeMiddle({
        minutesWorked: 80,
        recommendation: {
          action: "keep going",
          reason: "day is on track",
          type: "steady",
        },
        remainingItems: [
          { completed: true, id: "walk", title: "walk" },
          { id: "push", title: "push day", action: "workout" },
          { id: "read", title: "read" },
        ],
      }),
    ).toEqual({
      type: "today",
      meta: "2 left today",
      items: [
        { completed: true, id: "walk", title: "walk" },
        { id: "push", title: "push day", action: "workout" },
        { id: "read", title: "read" },
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
        remainingItems: [{ id: "push", title: "push day", action: "workout" }],
        workoutMeta: "5 lifts · 16 sets",
      }),
    ).toEqual({
      type: "next",
      label: "next",
      title: "push day",
      meta: "5 lifts · 16 sets",
      action: "start now",
    });
  });

  it("uses continue copy for an active workout", () => {
    expect(
      chooseHomeMiddle({
        minutesWorked: 80,
        recommendation: {
          action: "continue push day",
          reason: "session in progress",
          type: "workout",
        },
        remainingItems: [{ id: "push", title: "push day", action: "workout" }],
        workoutMeta: "5 lifts · 16 sets",
      }),
    ).toEqual({
      type: "next",
      label: "next",
      title: "push day",
      meta: "5 lifts · 16 sets",
      action: "continue",
    });
  });
});
