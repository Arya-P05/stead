# stead

A minimal iOS-first React Native app for staying locked in.

stead is meant to become a quiet personal EA: it knows your day, your goals, your workouts, and your context, then gives you the next useful action without turning life into a dashboard.

## why the name

`stead` is short, lowercase, and calm. It sits near the same simple world as `glance`, but it is more active: the app keeps you steady.

## current build

- Expo + React Native + TypeScript.
- Pure black visual system with white opacity steps.
- Living design-system doc at `docs/design-system.md`.
- Product plan at `docs/plan.md`.
- Home surface with next action, step progress, focus state, and workout entry.
- Tested recommendation engine for the next action.
- Workout sheet with real set logging, exercise progress, and rest countdown copy.
- Haptic and visual feedback for text actions.

## run

```sh
npm install
npm run ios
```

For a local dev server:

```sh
npm start
```

## scripts

```sh
npm run typecheck
npm test
```
