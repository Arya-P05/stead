# stead product plan

## name

**stead**

Short for staying steady. It fits the minimal, lowercase feel of `glance` while being more personal and durable. The app should feel like a calm personal EA: aware of your day, your goals, and your energy, but never loud.

## product thesis

For the next four months, stead helps you lock in by turning goals into tiny timely prompts. It watches the practical context around you: schedule, steps, workouts, weather, work blocks, and planned routines. Then it suggests the next useful action in a short phrase.

## first build

- A black iOS-first home surface.
- Daily commitment summary.
- One recommended next action.
- Step progress toward 10k.
- Focus/work block state.
- Workout launch surface.
- Compact action feedback with haptics.

## near-term milestones

1. Local model of goals, habits, routines, and day plan.
2. Workout mode with current exercise, set logging, rest countdown, and voice-first input.
3. Notification permissions and scheduled local prompts.
4. Weather-aware walk recommendation.
5. HealthKit step import and workout history.
6. Calendar integration for context-aware recommendations.
7. Voice parsing for phrases like "3 sets of 40 on incline dumbbell press".

## operating principles

- The app should recommend, not nag.
- The main screen should never become settings.
- A prompt must be immediately actionable.
- Voice is for capture; the UI is for confirmation and momentum.
- Every interaction should feel faster than opening Notes, Reminders, or Fitness.

## first data model sketch

- `Goal`: title, cadence, target, metric, priority.
- `DayState`: date, steps, focusMinutes, meetings, openTasks, weather.
- `Recommendation`: phrase, reason, actionType, confidence, expiresAt.
- `WorkoutPlan`: name, exercises, defaultRestSeconds.
- `WorkoutSession`: startedAt, activeExercise, completedSets, restEndsAt.
- `VoiceLog`: transcript, parsedIntent, linkedEntity, confidence.
