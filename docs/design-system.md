# stead design system

stead is a quiet iOS command surface for personal momentum. It should feel calm, direct, and almost invisible until it needs to help.

## visual language

- Background: pure black (`#000000`) across the main app and sheets.
- Foreground: white with opacity steps instead of multiple hues.
- Type: San Francisco system font only.
- Case: sentence case, mostly lowercase, short phrases.
- Corners: photo corners are soft but restrained: `16pt` continuous radius.
- Spacing: generous vertical whitespace; horizontal padding is usually `24-28pt`.
- Color accents: use accent color only for transient feedback.
  - Success: soft green (`#9fe6b4`).
  - Warning/failure: soft amber (`#f2c675`).

## type scale

- Intro/onboarding/supporting text: `15-18pt`, regular.
- Primary sheet title: `20pt`, semibold.
- Actions: `16pt`, regular.
- Index labels: `12pt`, monospaced.
- Metadata: `13-14pt`, regular, high transparency.

## text actions

- Inline lowercase words separated by a middle dot.
- Default opacity is `0.52` when enabled and `0.22` when unavailable.
- Success/failure uses a short color pulse and small vertical motion.

## sheets

- Black background, dark color scheme.
- Centered content when informational.
- Use compact controls.
- Avoid card-heavy UI or settings surfaces.

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
