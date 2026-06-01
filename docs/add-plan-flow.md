# add a workout plan

This flow follows the design handoff in `/Users/arya/Downloads/design_handoff_add_plan`.
Use this document as the in-repo source when working on workout-plan creation.

## intent

The add-plan surface is a black sheet for creating a lightweight workout plan. It should feel like the rest of stead: sparse, calm, mostly lowercase, white opacity steps, and transient green feedback only when something succeeds.

## routes

- `describe`: ask three quiet questions, draft a split, then review.
- `snap`: attach a photo or screenshot, parse it, then review.
- `write`: name a day, add lifts inline, then review.

The current production slice ships the `write` path first. Keep `describe` and `snap` visually present in the root, but do not pretend AI/photo parsing is complete until those backends exist.

## plan model

Plans are intentionally lightweight:

- plan name.
- lift name.
- target sets.
- target reps.

Weights, actual reps, RPE, and rest outcomes are logged during the workout. Do not add persistent starting weight to the add-plan flow unless the live logging model changes.

## interaction rules

- Start screen: wordmark top-left, centered intro, three indexed rows, faint footer.
- Builder: title is the day name, list uses index rows, add row is inline.
- Review: show the plan name, a mono summary, then the lift list.
- Saved: centered confirmation with a short success line.
- Back affordance uses the small `‹` in the top-left inside this flow only. Any text navigation elsewhere should say `back`.
- Screen transitions fade in over about `360ms`.
- Disabled text actions use opacity `0.22`; enabled actions use `0.52`.
