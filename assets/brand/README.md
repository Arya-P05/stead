# stead — brand assets

Drop-in SVGs for the app, marketing site, and dev tooling.

## Files

| file | use |
| --- | --- |
| `wordmark.svg` | primary wordmark, transparent bg |
| `wordmark-dark.svg` | wordmark on black plate |
| `wordmark-light.svg` | wordmark on white plate |
| `wordmark-pulse.svg` | wordmark + animated green pulse (animation in SVG) |
| `wordmark-anchor.svg` | wordmark with baseline rule |
| `wordmark-block.svg` | block + wordmark lockup |
| `monogram-s.svg` | single-letter mark (transparent bg) |
| `icon-app-dark.svg` | iOS app icon, 1024×1024, dark |
| `icon-app-light.svg` | iOS app icon, 1024×1024, light |
| `icon-monogram.svg` | iOS app icon, 1024×1024, monogram |
| `icon-pulse.svg` | iOS app icon, 1024×1024, with pulse |

## Spec

- **Type**: SF Pro (system font on iOS / macOS). Weight 500, tracking ≈ −2.5% of size.
- **All marks are lowercase.** Never capitalize, never set in italics.
- **Colors**: black `#000000`, white `#ffffff`, success green `#9fe6b4`.
- **Opacity**: title text uses `0.92` against black. The wordmark is never set at full opacity.
- **Clear space**: minimum padding around the mark = the height of the lowercase 's'.
- **Minimum size**: wordmark 64px tall on screen, 12mm in print. Below that, switch to the monogram.

## Notes for the iOS team

- SVGs reference the system font stack — they render correctly on Apple platforms with no additional font shipping.
- For App Store submission, rasterize `icon-app-*` to PNG at 1024×1024 (Xcode handles other sizes).
- The pulse animation in `wordmark-pulse.svg` is SMIL — works in Safari and most browsers, but for native iOS use a `CAReplicatorLayer` or Lottie equivalent (timing: 1.6s loop, opacity 0.3 → 1.0 → 0.3, radius 8 → 10 → 8).

## Notes for the web/marketing team

- For environments where SF Pro isn't available, swap the font-family to `Inter, ui-sans-serif, system-ui, sans-serif` — visually close enough at this scale.
- For pixel-perfect cross-platform fidelity, outline the type in your design tool (Figma → Outline Stroke).
