import type { Recommendation } from "./recommendations";

export type RemainingItem = {
  title: string;
  action?: "workout";
};

export type HomeMiddle =
  | {
      type: "moment";
      meta: string;
      phrase: string;
      action: string;
    }
  | {
      type: "today";
      meta: string;
      items: RemainingItem[];
    }
  | {
      type: "next";
      label: string;
      title: string;
      meta: string;
      action: string;
      detail: string;
    };

export function chooseHomeMiddle({
  minutesWorked,
  recommendation,
  remainingItems,
}: {
  minutesWorked: number;
  recommendation: Recommendation;
  remainingItems: RemainingItem[];
}): HomeMiddle {
  if (recommendation.type === "walk" && minutesWorked >= 180) {
    return {
      type: "moment",
      meta: `focused · ${formatWorked(minutesWorked)}`,
      phrase: "you've been at it three hours.\nthe sun is out.",
      action: "walk · ten min",
    };
  }

  if (recommendation.type === "workout") {
    return {
      type: "next",
      label: "next",
      title: recommendation.action.replace("start ", ""),
      meta: "6:30 · 5 lifts · 17 sets · ~47 min",
      action: "start now",
      detail: "walk · ten min · sun is out",
    };
  }

  return {
    type: "today",
    meta: `${remainingItems.length === 3 ? "three" : remainingItems.length} left today`,
    items: remainingItems.slice(0, 3),
  };
}

function formatWorked(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes === 0
    ? `${hours}h`
    : `${hours}h ${remainingMinutes}m`;
}
