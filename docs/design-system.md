# stead design system

stead is a quiet iOS command surface for personal momentum. It should feel calm, direct, and almost invisible until it needs to help.

## visual language

- Background: pure black (`#000000`) across the main app and sheets.
- Foreground: white with opacity steps instead of multiple hues.
- Type: San Francisco system font only.
- Case: sentence case, mostly lowercase, short phrases.
- Corners: app and sheet surfaces are pure black. If a captured phone mock or photo is shown outside the app, use restrained `16pt` continuous radius.
- Spacing: generous vertical whitespace; horizontal padding is usually `24-28pt`.
- Color accents: use accent color only for transient feedback.
  - Success: soft green (`#9fe6b4`).
  - Warning/failure: soft amber (`#f2c675`).

## opacity scale

- Title: `0.92`.
- Body: `0.78`.
- Enabled action: `0.52`.
- Metadata: `0.36`.
- Disabled action: `0.22`.
- Hint: `0.10`.

## type scale

- Primary title: `20pt`, semibold.
- Body: `17pt`, regular.
- Intro/onboarding/supporting text: `16-18pt`, regular.
- Actions: `16pt`, regular.
- Index labels: `12pt`, monospaced.
- Metadata: `13-14pt`, regular, high transparency.
- Countdown: `56pt`, light, monospaced.

## surface shapes

- Day schedule and recap use the same index-list shape.
- Workout is a live surface: exercise card, set log, rest timer, voice log.
- Nudges are lockscreen-shaped: one phrase, one text action.
- Lists use monospaced indexes on the left and time/status metadata on the right.
- Large centered timers are allowed only for active rest.

## text actions

- Inline lowercase words separated by a middle dot.
- Default opacity is `0.52` when enabled and `0.22` when unavailable.
- Press lifts `1pt` and brightens.
- Success/failure uses a short color pulse for about `480ms`.

## sheets

- Black background, dark color scheme.
- Centered content when informational.
- Use compact controls.
- Avoid card-heavy UI or settings surfaces.
- Bottom actions sit close to the safe area and remain text-only.

## interaction rules

- Tap actions should produce immediate haptic and visual feedback when possible.
- Destructive or complex settings do not belong in the main surface.
- If a feature needs more than a short phrase to explain, it probably does not belong.

## avoid

- Bright palettes.
- Decorative gradients.
- Gamification.
- Heavy dashboards.
- Explanatory UI copy.

## implementation notes

- Prefer a single theme module before adding component libraries.
- Keep the primary screen sparse: next action, current state, and one or two compact controls.
- Integrations should appear only after they can reduce friction: calendar, reminders, weather, HealthKit, notifications, voice logging.
