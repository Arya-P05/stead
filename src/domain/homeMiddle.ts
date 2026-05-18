import type { Recommendation } from "./recommendations";

export type RemainingItem = {
  id: string;
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
      detail?: string;
    };

export function chooseHomeMiddle({
  minutesWorked,
  recommendation,
  remainingItems,
  workoutMeta,
}: {
  minutesWorked: number;
  recommendation: Recommendation;
  remainingItems: RemainingItem[];
  workoutMeta?: string;
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
      meta: workoutMeta ?? "planned workout",
      action: "start now",
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
