# stead — engineering backlog

Assignable work items for **stead**. Each ticket has a stable **ID** (`STEAD-###`), **priority**, **acceptance criteria**, and **dependencies** so it can be picked up without re-auditing the codebase.

## How to use

- Track status in your tool of choice (Linear, GitHub Projects, Jira): create one issue per `STEAD-###` and paste the **Acceptance criteria** block verbatim.
- In PRs, reference the ID in the title or description (e.g. `STEAD-003: surface HealthKit errors`).
- **Priority**: P0 = correctness / trust / data risk; P1 = core product honesty vs `docs/plan.md`; P2 = polish / tech debt that affects maintainability or App Store readiness; P3 = roadmap features.
- **Estimate**: S ≤ 0.5 day, M ≤ 2 days, L ≤ 1 week (rough).

## Related docs

- Product intent: `docs/plan.md`
- UX constraints: `docs/design-system.md`

---

## Summary (PM view)

| ID        | Title                                            | P   | Est |
| --------- | ------------------------------------------------ | --- | --- |
| STEAD-001 | Dynamic “today” + date rollover                  | 0   | M   |
| STEAD-002 | Clarify `saveAppState` call API                  | 0   | S   |
| STEAD-003 | HealthKit sync: user-visible success/failure     | 0   | S   |
| STEAD-004 | Single source of truth for step goal in UI       | 0   | S   |
| STEAD-010 | Introduce persisted / computed day context model | 1   | L   |
| STEAD-011 | Replace static `dayItems` / `remainingItems`     | 1   | M   |
| STEAD-012 | Home middle: real meta from plan + session       | 1   | M   |
| STEAD-013 | Daily outcome counts from real completion rules  | 1   | M   |
| STEAD-014 | Day surface: no fake timeline without data       | 1   | M   |
| STEAD-015 | “plan tomorrow”: ship, hide, or disable          | 1   | S   |
| STEAD-016 | Workout completion gating (repeat sessions)      | 1   | M   |
| STEAD-017 | Calendar: past empty days / selection rules      | 1   | M   |
| STEAD-018 | `workout.planned` from data, not hardcoded       | 1   | S   |
| STEAD-020 | Voice capture: MVP decision + UX + copy          | 2   | M   |
| STEAD-021 | Schedule recommendation nudges (notifications)   | 2   | L   |
| STEAD-022 | Migrate off deprecated `SafeAreaView`            | 2   | S   |
| STEAD-023 | Workout sheet: a11y + focus + gesture pass       | 2   | M   |
| STEAD-030 | Split `App.tsx` into screens + hooks + styles    | 3   | L   |
| STEAD-031 | App state schema versioning for new day fields   | 3   | M   |
| STEAD-032 | Tests: midnight rollover + persistence hooks     | 3   | M   |
| STEAD-040 | Weather provider for walk recommendation         | 3   | L   |
| STEAD-041 | Calendar read for “minutes until next event”     | 3   | L   |
| STEAD-042 | Supabase sync (deferred)                         | 3   | L   |

---

## P0 — Correctness & trust

### STEAD-001 — Dynamic “today” and midnight rollover

#### Problem (STEAD-001)

`today` in `App.tsx` is a module-level constant; date labels and `today.date` used for persistence do not advance if the app stays open across midnight or resumes the next day without reload.

#### Scope (STEAD-001)

`App.tsx` (and any code assuming frozen `today`).

#### Acceptance criteria (STEAD-001)

- [ ] “Today” date key used for `addDailyOutcome`, comparisons to `selectedDate`, and header copy is derived from **current** calendar date, not bundle load time.
- [ ] Documented behavior: either **timer-based midnight refresh** or **refresh on `AppState` foreground** (or both); no silent wrong-date writes after midnight.
- [ ] Manual QA steps written in PR: leave app backgrounded across local midnight (or simulate date change in dev), confirm new date on home and that new saves use the new `YYYY-MM-DD`.

#### Dependencies (STEAD-001)

None.

#### Estimate (STEAD-001)

M

---

### STEAD-002 — Clarify `saveAppState` public API

#### Problem (STEAD-002)

`saveAppState(undefined, appState)` relies on default-parameter behavior; easy to misuse and confusing in review.

#### Scope (STEAD-002)

`src/data/storage.ts`, all call sites (currently `App.tsx`).

#### Acceptance criteria (STEAD-002)

- [ ] Preferred API is either `saveAppState(state)` only, or **named** overload / object param so storage is never passed as positional `undefined`.
- [ ] All call sites updated; `storage.test.ts` still passes.
- [ ] No behavior change to persistence keys or JSON shape.

#### Dependencies (STEAD-002)

None.

#### Estimate (STEAD-002)

S

---

### STEAD-003 — HealthKit step sync: visible outcomes

#### Problem (STEAD-003)

`syncHealthSteps` swallows errors with `.catch(() => undefined)`; permission denial and failures are invisible.

#### Scope (STEAD-003)

`App.tsx`, optionally `src/services/healthkit.ts` / `healthkitNative.ts` for error typing.

#### Acceptance criteria (STEAD-003)

- [ ] User sees **distinct** outcomes: success (steps updated), denied (short copy + link to Settings if appropriate), transient error (retry).
- [ ] No unhandled promise rejections from the sync path.
- [ ] Matches product rule: steps from HealthKit only (`docs/plan.md`).

#### Dependencies (STEAD-003)

None (can ship before STEAD-010).

#### Estimate (STEAD-003)

S

---

### STEAD-004 — Step goal: single source of truth in UI

#### Problem (STEAD-004)

`today.stepGoal` exists but the home steps label hardcodes `10,000`; progress uses `today.stepGoal` — inconsistency risk.

#### Scope (STEAD-004)

`App.tsx` (steps block).

#### Acceptance criteria (STEAD-004)

- [ ] Label denominator and progress bar both use the **same** goal value (constant or state field).
- [ ] If goal becomes user-configurable later, only one field drives UI + `chooseRecommendation` input.

#### Dependencies (STEAD-004)

Optional pairing with STEAD-010 if goal moves into app state.

#### Estimate (STEAD-004)

S

---

## P1 — Real “day” vs demo data

### STEAD-010 — Day context model (persisted or computed)

#### Problem (STEAD-010)

Focus minutes, calendar lead time, weather, and “remaining items” are largely hardcoded; engine input does not match `docs/plan.md`.

#### Scope (STEAD-010)

New module under `src/data` or `src/domain`, `AppState` / storage version bump (see STEAD-031), `App.tsx` consumers.

#### Acceptance criteria (STEAD-010)

- [ ] One typed structure (e.g. `DayContext` / `DayState`) holds fields currently faked in the module `today` object **that affect copy or recommendations**.
- [ ] Values load from persistence with sane defaults for first-run.
- [ ] `chooseRecommendation` and `chooseHomeMiddle` consume this structure, not literals in `App.tsx`.
- [ ] Unit tests for merge/update rules (pure functions).

#### Dependencies (STEAD-010)

STEAD-001 strongly recommended first.

#### Estimate (STEAD-010)

L

---

### STEAD-011 — Remove static `dayItems` and `remainingItems`

#### Problem (STEAD-011)

Schedule rows are fixed demo arrays.

#### Scope (STEAD-011)

`App.tsx`, day model from STEAD-010.

#### Acceptance criteria (STEAD-011)

- [ ] No `dayItems` / `remainingItems` constants driving production UI.
- [ ] Home “today” list items come from day model (or explicit empty state).
- [ ] If list is empty, UI shows calm empty copy (design-system tone), not fake rows.

#### Dependencies (STEAD-011)

STEAD-010.

#### Estimate (STEAD-011)

M

---

### STEAD-012 — Home middle: honest meta strings

#### Problem (STEAD-012)

`src/domain/homeMiddle.ts` embeds hardcoded duration / weather strings unrelated to actual plan or weather.

#### Scope (STEAD-012)

`homeMiddle.ts`, inputs from plan + session + weather slice.

#### Acceptance criteria (STEAD-012)

- [ ] Workout “next” card shows **computed** duration/set/lift summary from `WorkoutPlan` + optional session progress, or omits numbers until computable.
- [ ] “Walk / sun” style strings only appear when **weather + recommendation** justify them (or show neutral copy).
- [ ] Unit tests updated: no assertions on magic strings unless they are intentional static fallbacks documented in code.

#### Dependencies (STEAD-012)

STEAD-010, STEAD-040 (weather) optional for full fidelity.

#### Estimate (STEAD-012)

M

---

### STEAD-013 — Daily outcome: real completion counts

#### Problem (STEAD-013)

`completeLooseItem` uses `?? 5`; `finishWorkout` hardcodes `6` / `7` completed vs planned.

#### Scope (STEAD-013)

`App.tsx`, possibly `src/data/appState.ts` helpers.

#### Acceptance criteria (STEAD-013)

- [ ] `completedItems` / `plannedItems` reflect **defined** product rules (e.g. count of checkable items that day, or explicit user plan length).
- [ ] No unexplained magic numbers; constants named or derived from model.
- [ ] Tests for reducer-style updates if logic moves to `src/data`.

#### Dependencies (STEAD-013)

STEAD-010 / STEAD-011 (needs defined list length).

#### Estimate (STEAD-013)

M

---

### STEAD-014 — Day surface: empty vs workout recap

#### Problem (STEAD-014)

Without `selectedWorkoutOutcome`, UI shows `dayItems` demo and placeholder `5 / 7`.

#### Scope (STEAD-014)

`DaySurface` in `App.tsx`.

#### Acceptance criteria (STEAD-014)

- [ ] If no workout outcome for that date: show **real** schedule from model OR a single honest empty state (no fake timeline).
- [ ] Remove or replace placeholder `5 / 7` with copy tied to real data or remove the metric.
- [ ] Tapping workout row still opens workout when applicable.

#### Dependencies (STEAD-014)

STEAD-010, STEAD-011.

#### Estimate (STEAD-014)

M

---

### STEAD-015 — “plan tomorrow” control

#### Problem (STEAD-015)

Button calls `() => undefined` — dead interaction.

#### Scope (STEAD-015)

`DaySurface` in `App.tsx`.

#### Acceptance criteria (STEAD-015)

- [ ] Either: **implemented** minimal flow (e.g. opens edit tomorrow plan stub with save), **or** removed / hidden / disabled with explanation in UI spec.
- [ ] No press handler that is a no-op.

#### Dependencies (STEAD-015)

None (can hide before STEAD-010).

#### Estimate (STEAD-015)

S

---

### STEAD-016 — Workout completion gating for repeat sessions

#### Problem (STEAD-016)

`hasCompletedWorkout(planId)` hides workout from “remaining” after any completion for that plan id forever.

#### Scope (STEAD-016)

`src/data/appState.ts`, `App.tsx` where `openItems` is built.

#### Acceptance criteria (STEAD-016)

- [ ] Documented rule: e.g. “completed **today** for this plan”, or “session already logged today”, or explicit user “rest day” — pick one and implement.
- [ ] After completing a workout, user can still see **correct** next action for subsequent days or same-day edge cases per product.
- [ ] Unit tests for gating function(s).

#### Dependencies (STEAD-016)

STEAD-001 (date correctness).

#### Estimate (STEAD-016)

M

---

### STEAD-017 — Calendar selection rules for past days

#### Problem (STEAD-017)

`selectable: tracked && !future` prevents opening many past cells.

#### Scope (STEAD-017)

`src/data/calendarDays.ts`, `CalendarSurface` UX copy.

#### Acceptance criteria (STEAD-017)

- [ ] Product rule documented in PR: e.g. “past days always viewable read-only” vs “only days with outcomes”.
- [ ] Grid behavior matches rule; empty past days show honest empty day view (aligned with STEAD-014).
- [ ] Future days remain non-selectable unless product explicitly allows planning.

#### Dependencies (STEAD-017)

STEAD-014 for empty day UX.

#### Estimate (STEAD-017)

M

---

### STEAD-018 — `workout.planned` from data

#### Problem (STEAD-018)

`chooseRecommendation` always receives `planned: true`.

#### Scope (STEAD-018)

`App.tsx` + day model.

#### Acceptance criteria (STEAD-018)

- [ ] `workout.planned` reflects stored intent or inferred schedule from day model.
- [ ] When not planned, workout branch of recommendation does not fire inappropriately.

#### Dependencies (STEAD-018)

STEAD-010.

#### Estimate (STEAD-018)

S

---

## P2 — Polish, platform, nudges

### STEAD-020 — Voice capture: MVP decision and UX

#### Problem (STEAD-020)

Workout “voice” is keyboard dictation; copy says so, but `docs/plan.md` describes voice-first capture.

#### Scope (STEAD-020)

Workout voice UI in `App.tsx`, optional new `src/services/` adapter.

#### Acceptance criteria (STEAD-020)

- [ ] Written **decision** in PR: ship dictation MVP vs integrate OS speech APIs.
- [ ] Onboarding line matches reality; parser errors already surfaced — verify copy on failure paths.
- [ ] If staying on dictation: **accessibility** pass (labels, focus order).

#### Dependencies (STEAD-020)

None.

#### Estimate (STEAD-020)

M

---

### STEAD-021 — Recommendation nudges via notifications

#### Problem (STEAD-021)

`scheduleRecommendationNudge` is implemented and tested but **not** invoked from the app lifecycle.

#### Scope (STEAD-021)

`App.tsx` or a small `src/services/recommendationNudges.ts`, align with `docs/plan.md` milestone 4.

#### Acceptance criteria (STEAD-021)

- [ ] At least one **concrete** user-visible path schedules a local notification (e.g. after enabling, or when recommendation type X appears).
- [ ] Respects denied permissions (no crash; clear state).
- [ ] Cancels or replaces scheduled nudges when recommendation changes, if applicable (document behavior).

#### Dependencies (STEAD-021)

Product spec for _when_ to nudge (avoid nagging per plan principles).

#### Estimate (STEAD-021)

L

---

### STEAD-022 — Replace deprecated `SafeAreaView`

#### Problem (STEAD-022)

`react-native` `SafeAreaView` is deprecated; Metro warns; plan is iOS-first safe areas.

#### Scope (STEAD-022)

`App.tsx`, use `react-native-safe-area-context` (already a dependency).

#### Acceptance criteria (STEAD-022)

- [ ] No `SafeAreaView` import from `react-native` for main chrome.
- [ ] Home / calendar / day / workout surfaces respect notch + home indicator in dev build.
- [ ] No new layout regressions on small devices (spot-check).

#### Dependencies (STEAD-022)

None.

#### Estimate (STEAD-022)

S

---

### STEAD-023 — Workout modal: a11y + focus + gestures

#### Problem (STEAD-023)

Large modal workout surface — risk of focus trap, scroll, and back gesture conflicts.

#### Scope (STEAD-023)

`App.tsx` `Modal` + `WorkoutSurface`.

#### Acceptance criteria (STEAD-023)

- [ ] VoiceOver / TalkBack spot-check: focus order, button labels, modal announcement.
- [ ] Android back / iOS swipe behavior documented and tested for close vs accidental dismiss.
- [ ] No keyboard covering primary actions on small phones (if applicable).

#### Dependencies (STEAD-023)

None.

#### Estimate (STEAD-023)

M

---

## P3 — Engineering hygiene & roadmap

### STEAD-030 — Decompose `App.tsx`

#### Problem (STEAD-030)

Single ~1.5k+ line file mixes state, surfaces, and styles — high regression cost.

#### Scope (STEAD-030)

New folders under `src/` (e.g. `src/screens/`, `src/hooks/`, `src/styles/`).

#### Acceptance criteria (STEAD-030)

- [ ] No behavior change; `npm test` + `npm run typecheck` green.
- [ ] Each extracted screen has a clear props interface; shared hooks for hydration + persistence.
- [ ] PR describes file map for reviewers.

#### Dependencies (STEAD-030)

Best after P0/P1 batch to avoid merge pain.

#### Estimate (STEAD-030)

L

---

### STEAD-031 — App state schema versioning

#### Problem (STEAD-031)

`AppState` is `version: 1`; adding day fields requires migration strategy.

#### Scope (STEAD-031)

`src/data/appState.ts`, `src/data/storage.ts`.

#### Acceptance criteria (STEAD-031)

- [ ] Documented migration: bump version, migrate or reset with user-safe defaults.
- [ ] Tests for load of v1 JSON into v2 shape (or explicit reset with log).
- [ ] No silent data wipe without product sign-off (if wipe: show one-time notice — optional stretch).

#### Dependencies (STEAD-031)

STEAD-010.

#### Estimate (STEAD-031)

M

---

### STEAD-032 — Integration-style tests for date + persistence

#### Scope (STEAD-032)

Jest tests, possibly lightweight hook tests.

#### Acceptance criteria (STEAD-032)

- [ ] Test simulating date change or `AppState` active → verifies “today” key used in writes updates.
- [ ] Test save → load round-trip for extended `AppState` (after STEAD-031 if applicable).

#### Dependencies (STEAD-032)

STEAD-001, STEAD-002, STEAD-031 as applicable.

#### Estimate (STEAD-032)

M

---

### STEAD-040 — Weather for walk recommendation

#### Scope (STEAD-040)

API client, caching, failure UI, `chooseRecommendation` inputs.

#### Acceptance criteria (STEAD-040)

- [ ] Weather unavailable → neutral recommendation path; no fake “sunny” claims.
- [ ] Privacy: disclose location or city-level data in App Store privacy labels as required.

#### Dependencies (STEAD-040)

STEAD-010.

#### Estimate (STEAD-040)

L

---

### STEAD-041 — Calendar integration for next-event lead time

#### Scope (STEAD-041)

OS calendar read, permissions, `minutesUntilNextEvent` from real data.

#### Acceptance criteria (STEAD-041)

- [ ] Permission denied path does not break home; recommendation falls back per rules.
- [ ] Tests use adapter mock (match `HealthKitAdapter` pattern).

#### Dependencies (STEAD-041)

STEAD-010.

#### Estimate (STEAD-041)

L

---

### STEAD-042 — Supabase sync (deferred)

#### Scope (STEAD-042)

Out of near-term scope per `docs/plan.md` milestone 8; ticket exists to avoid duplicate discovery.

#### Acceptance criteria (STEAD-042)

- [ ] Not started until auth + conflict model approved; link design doc when created.

#### Dependencies (STEAD-042)

Full local model stable (STEAD-010+).

#### Estimate (STEAD-042)

L

---

## Suggested sprint order (assignable batches)

1. **Sprint A (trust):** STEAD-001, STEAD-002, STEAD-003, STEAD-004
2. **Sprint B (honest day):** STEAD-010 → STEAD-011 → STEAD-018 → STEAD-016
3. **Sprint C (surfaces):** STEAD-012, STEAD-013, STEAD-014, STEAD-015, STEAD-017
4. **Sprint D (platform):** STEAD-022, STEAD-020, STEAD-023
5. **Sprint E (growth):** STEAD-021, STEAD-040, STEAD-041
6. **Sprint F (engineering):** STEAD-030, STEAD-031, STEAD-032
7. **Future:** STEAD-042

---

## Changelog

| Date       | Change                     |
| ---------- | -------------------------- |
| 2026-05-11 | Initial backlog from audit |
