import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  colors,
  opacity,
  spacing,
  typeScale,
  typography,
} from "./src/designSystem";
import {
  AnimatedProgressFill,
  PressableScale,
  PulsingDot,
} from "./src/ui/motion";
import { useSequentialCrossfade } from "./src/ui/sequentialCrossfade";
import { chooseRecommendation } from "./src/domain/recommendations";
import { chooseHomeMiddle } from "./src/domain/homeMiddle";
import type { HomeMiddle } from "./src/domain/homeMiddle";
import {
  addRestTime,
  completeSet,
  getActiveExercise,
  getExerciseProgress,
  getRestRemainingSeconds,
  selectExercise,
  skipRest,
  startWorkoutSession,
} from "./src/domain/workoutSession";
import type { WorkoutPlan, WorkoutSession } from "./src/domain/workoutSession";
import {
  addDailyOutcome,
  addWorkoutOutcome,
  addStepSample,
  clearActiveWorkoutSession,
  createInitialAppState,
  hasCompletedWorkout,
  saveActiveWorkoutSession,
  saveWorkoutPlan,
  upsertExerciseWeight,
} from "./src/data/appState";
import type { AppState } from "./src/data/appState";
import { loadAppState, saveAppState } from "./src/data/storage";
import { createWorkoutOutcome } from "./src/data/workoutOutcome";
import { createCalendarMonth } from "./src/data/calendarDays";
import type { CalendarMonth } from "./src/data/calendarDays";
import { syncTodaySteps } from "./src/services/healthkit";
import {
  createDefaultWorkoutPlan,
  normalizeWorkoutPlan,
  updateExercise,
} from "./src/data/workoutPlan";
import {
  applyWorkoutVoiceLog,
  parseWorkoutVoiceLog,
} from "./src/domain/voiceLog";

const today = {
  date: formatDateKey(new Date()),
  dateLabel: new Date()
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase(),
  dateMeta: new Date()
    .toLocaleDateString("en-US", { month: "long", day: "numeric" })
    .toLowerCase(),
  stepGoal: 10000,
  focusMinutes: 154,
  workout: "push day",
  minutesUntilNextEvent: 90,
  weather: {
    condition: "sunny" as const,
    temperatureF: 72,
    precipitationChance: 0.05,
  },
};

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimestampDate(timestamp: number) {
  return formatDateKey(new Date(timestamp));
}

type DayItem = {
  title: string;
  detail: string;
  time: string;
  active?: boolean;
  action?: "workout";
};

const dayItems: DayItem[] = [
  { title: "walk", detail: "ten min", time: "8:30" },
  { title: "focus", detail: "2h 14m", time: "9:00" },
  { title: "walk", detail: "ten min", time: "12:30" },
  { title: "lunch", detail: "20 min", time: "1:00" },
  { title: "focus", detail: "in flow", time: "now", active: true },
  { title: "push day", detail: "47 min", time: "6:30", action: "workout" },
  { title: "read", detail: "30 min", time: "9:00" },
];

const remainingItems = [
  { title: "walk" },
  { title: "push day", action: "workout" as const },
  { title: "read" },
];

type FeedbackState = "idle" | "success" | "warning";
type WorkoutMode = "overview" | "exercise" | "voice" | "plan";
type Surface = "home" | "calendar" | "day";

function parseWorkoutVisualKey(key: string): {
  mode: WorkoutMode;
  isResting: boolean;
} {
  if (key.endsWith("-true")) {
    return { mode: key.slice(0, -5) as WorkoutMode, isResting: true };
  }

  return { mode: key.slice(0, -6) as WorkoutMode, isResting: false };
}

function ActionText({
  children,
  disabled,
  tone = "success",
  onPress,
}: {
  children: string;
  disabled?: boolean;
  tone?: Exclude<FeedbackState, "idle">;
  onPress: () => void;
}) {
  const translateY = useSharedValue(0);
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const runFeedback = async () => {
    if (disabled) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setFeedback("warning");
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setFeedback(tone);
      onPress();
    }

    translateY.value = withSequence(
      withTiming(-1, { duration: 90 }),
      withTiming(0, { duration: 150, easing: Easing.out(Easing.cubic) }),
    );

    setTimeout(() => setFeedback("idle"), 480);
  };

  const color =
    feedback === "success"
      ? colors.success
      : feedback === "warning"
        ? colors.warning
        : colors.foreground;

  return (
    <Pressable onPress={runFeedback} hitSlop={12}>
      <Animated.Text
        style={[
          styles.actionText,
          liftStyle,
          {
            color,
            opacity: disabled ? opacity.disabled : opacity.enabled,
          },
        ]}
      >
        {children}
      </Animated.Text>
    </Pressable>
  );
}

function IndexText({
  children,
  active,
}: {
  children: string;
  active?: boolean;
}) {
  return (
    <Text style={[styles.indexText, active && styles.activeText]}>
      {children}
    </Text>
  );
}

function DayRow({
  index,
  item,
  onWorkout,
}: {
  index: number;
  item: DayItem;
  onWorkout: () => void;
}) {
  const row = (
    <View style={styles.dayRow}>
      <IndexText active={item.active}>
        {String(index + 1).padStart(2, "0")}
      </IndexText>
      <View style={styles.dayCopy}>
        <Text style={[styles.dayTitle, item.active && styles.activeText]}>
          {item.title}
        </Text>
        <Text style={styles.dayDetail}>{item.detail}</Text>
      </View>
      <Text style={[styles.dayTime, item.active && styles.activeText]}>
        {item.time}
      </Text>
    </View>
  );

  if (item.action === "workout") {
    return (
      <PressableScale onPress={onWorkout} hitSlop={8}>
        {row}
      </PressableScale>
    );
  }

  return row;
}

function DaySurface({
  loggedSets,
  onBack,
  onWorkout,
  selectedDate,
  selectedOutcome,
  selectedWorkoutOutcome,
}: {
  loggedSets: number;
  onBack: () => void;
  onWorkout: () => void;
  selectedDate: string;
  selectedOutcome?: AppState["dailyOutcomes"][number];
  selectedWorkoutOutcome?: AppState["workoutOutcomes"][number];
}) {
  const isToday = selectedDate === today.date;

  return (
    <View style={styles.calendarContent}>
      <View style={styles.dayHeader}>
        <View style={styles.titleStack}>
          <Text style={styles.titleText}>
            {isToday ? today.dateLabel : selectedDate.slice(5)}
          </Text>
          <Text style={styles.metadataText}>
            {selectedOutcome
              ? `${selectedOutcome.completedItems} / ${selectedOutcome.plannedItems} done`
              : isToday
                ? today.dateMeta
                : "no tracked outcome"}
          </Text>
        </View>
        <Text style={styles.monoMeta}>
          {selectedWorkoutOutcome
            ? `${selectedWorkoutOutcome.totalSets} sets`
            : loggedSets > 0
              ? `${loggedSets} logged`
              : "5 / 7"}
        </Text>
      </View>

      {selectedWorkoutOutcome ? (
        <View style={styles.dayList}>
          <View style={styles.nudgeLine}>
            <Text style={styles.exerciseTitle}>
              {selectedWorkoutOutcome.name}
            </Text>
            <Text style={styles.monoMeta}>
              {Math.round(
                (selectedWorkoutOutcome.completedAt -
                  selectedWorkoutOutcome.startedAt) /
                  60000,
              )}{" "}
              min · {selectedWorkoutOutcome.exercises.length} lifts ·{" "}
              {selectedWorkoutOutcome.totalSets} sets
            </Text>
          </View>
          {selectedWorkoutOutcome.exercises.map((exercise, index) => (
            <View key={exercise.exerciseId} style={styles.dayRow}>
              <IndexText>{String(index + 1).padStart(2, "0")}</IndexText>
              <View style={styles.dayCopy}>
                <Text style={[styles.dayTitle, styles.activeText]}>
                  {exercise.name}
                </Text>
              </View>
              <Text style={styles.recapSetValue}>
                {exercise.sets} × {exercise.reps ?? "-"}
                {exercise.weightLb ? ` · ${exercise.weightLb}` : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.dayList}>
          {dayItems.map((item, index) => (
            <DayRow
              key={`${item.title}-${index}`}
              index={index}
              item={item}
              onWorkout={onWorkout}
            />
          ))}
        </View>
      )}

      <View style={styles.bottomActions}>
        <ActionText onPress={onBack}>back</ActionText>
        <ActionText onPress={() => undefined}>plan tomorrow</ActionText>
      </View>
    </View>
  );
}

function CalendarSurface({
  month,
  onBack,
  onNextMonth,
  onPreviousMonth,
  onSelectDate,
}: {
  month: CalendarMonth;
  onBack: () => void;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onSelectDate: (date: string) => void;
}) {
  return (
    <View style={styles.content}>
      <View style={styles.dayHeader}>
        <View style={styles.titleStack}>
          <Text style={styles.titleText}>{month.label}</Text>
          <Text style={styles.metadataText}>{month.meta}</Text>
        </View>
      </View>

      <View style={styles.calendarSurface}>
        <View style={styles.weekdays}>
          {["s", "m", "t", "w", "t", "f", "s"].map((weekday, index) => (
            <View key={`${weekday}-${index}`}>
              <Text style={styles.weekdayLabel}>{weekday}</Text>
            </View>
          ))}
        </View>
        <View style={styles.monthGrid}>
          {month.weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((day, dayIndex) =>
                day === null ? (
                  <View key={`empty-${dayIndex}`} style={styles.calendarCell} />
                ) : (
                  <PressableScale
                    key={day.date}
                    layout="fill"
                    disabled={!day.selectable}
                    onPress={() => onSelectDate(day.date)}
                    style={styles.calendarCell}
                  >
                    <View>
                      <Text
                        style={[
                          styles.calendarLabel,
                          (!day.tracked || day.future) && styles.untrackedText,
                        ]}
                      >
                        {day.label}
                      </Text>
                    </View>
                  </PressableScale>
                ),
              )}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.bottomActions}>
        <ActionText onPress={onBack}>back</ActionText>
        <View style={styles.monthActions}>
          <ActionText onPress={onPreviousMonth}>prev</ActionText>
          <Text style={styles.dot}>·</Text>
          <ActionText onPress={onNextMonth}>next</ActionText>
        </View>
      </View>
    </View>
  );
}

function addMonths(date: string, offset: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  parsed.setUTCMonth(parsed.getUTCMonth() + offset, 1);

  return parsed.toISOString().slice(0, 10);
}

function HomeMiddleSurface({
  middle,
  onCompleteItem,
  onWorkout,
}: {
  middle: HomeMiddle;
  onCompleteItem: (title: string) => void;
  onWorkout: () => void;
}) {
  if (middle.type === "moment") {
    return (
      <View style={styles.homeMiddle}>
        <Text style={styles.homeMeta}>{middle.meta}</Text>
        <Text style={styles.momentPhrase}>{middle.phrase}</Text>
        <Text style={styles.momentAction}>{middle.action}</Text>
      </View>
    );
  }

  if (middle.type === "next") {
    return (
      <View style={styles.homeMiddle}>
        <Text style={styles.homeMeta}>{middle.label}</Text>
        <Text style={styles.nextTitle}>{middle.title}</Text>
        <Text style={styles.homeMeta}>{middle.meta}</Text>
        <PressableScale onPress={onWorkout} hitSlop={12}>
          <Text style={styles.nextStart}>{middle.action}</Text>
        </PressableScale>
        <Text style={styles.supporting}>{middle.detail}</Text>
      </View>
    );
  }

  return (
    <View style={styles.homeMiddle}>
      <Text style={styles.homeMeta}>{middle.meta}</Text>
      <View style={styles.todayThreeList}>
        {middle.items.map((item, index) => (
          <PressableScale
            key={`${item.title}-${index}`}
            onPress={() =>
              item.action === "workout"
                ? onWorkout()
                : onCompleteItem(item.title)
            }
            style={styles.todayThreeRow}
          >
            <Text style={styles.indexText}>
              {String(index + 1).padStart(2, "0")}
            </Text>
            <Text
              style={[
                styles.todayThreeTitle,
                index > 0 && styles.untrackedText,
              ]}
            >
              {item.title}
            </Text>
            <Text
              style={[
                styles.todayThreeAction,
                index > 0 && styles.untrackedText,
              ]}
            >
              {item.action === "workout" ? "start" : "do"}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function FormatTimer({ seconds }: { seconds: number }) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return (
    <Text style={styles.restTimer}>
      {minutes}:{String(remainingSeconds).padStart(2, "0")}
    </Text>
  );
}

function WorkoutSurface({
  plan,
  session,
  visible,
  onAddRest,
  onBack,
  onFinishWorkout,
  onLogSet,
  onLogVoice,
  onSelectExercise,
  onSkipRest,
  onUpdateExercise,
}: {
  plan: WorkoutPlan;
  session: WorkoutSession;
  visible: boolean;
  onAddRest: () => void;
  onBack: () => void;
  onFinishWorkout: () => void;
  onLogSet: () => void;
  onLogVoice: (transcript: string) => boolean;
  onSelectExercise: (index: number) => void;
  onSkipRest: () => void;
  onUpdateExercise: (
    exerciseId: string,
    patch: Parameters<typeof updateExercise>[2],
  ) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState<WorkoutMode>("overview");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [planExerciseIndex, setPlanExerciseIndex] = useState(0);
  const activeExercise = getActiveExercise(plan, session);
  const exerciseProgress = getExerciseProgress(plan, session);
  const restSeconds = getRestRemainingSeconds(session, now);
  const isResting = restSeconds > 0;
  const completedSets = activeExercise
    ? session.sets.filter((set) => set.exerciseId === activeExercise.id).length
    : 0;
  const exerciseIndex = Math.min(
    session.activeExerciseIndex + 1,
    plan.exercises.length,
  );
  const setLabel = activeExercise
    ? `set  ${Math.min(completedSets + 1, activeExercise.targetSets)} of ${activeExercise.targetSets}`
    : "done";
  const selectedPlanExercise =
    plan.exercises[planExerciseIndex] ?? plan.exercises[0];
  const parsedVoiceLog = parseWorkoutVoiceLog(voiceTranscript);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    setMode("overview");
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, [visible]);

  useEffect(() => {
    if (isResting) {
      setMode("exercise");
    }
  }, [isResting]);

  const targetLine = activeExercise
    ? `${activeExercise.targetSets} × ${activeExercise.targetReps ?? 10} · ${activeExercise.weightLb ?? 50} lb`
    : `${session.sets.length} sets logged`;

  const workoutVisualKey = `${mode}-${isResting}`;
  const { displayKey: workoutStageShown, animatedStyle: workoutStageOpacity } =
    useSequentialCrossfade(workoutVisualKey, { fadeOutMs: 220, fadeInMs: 360 });
  const stageView = parseWorkoutVisualKey(workoutStageShown);

  return (
    <Modal
      animationType="fade"
      visible={visible}
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <Animated.View
          entering={FadeIn.duration(420).easing(Easing.out(Easing.cubic))}
          style={styles.liveContent}
        >
          <View style={styles.liveHeader}>
            <Text style={styles.metadataText}>
              {plan.name}
              {mode === "voice" ? " · live" : ""}
            </Text>
            <Text style={styles.monoMeta}>
              {mode === "voice"
                ? "dictate"
                : isResting
                  ? setLabel
                  : `${String(exerciseIndex).padStart(2, "0")}  of  ${String(plan.exercises.length).padStart(2, "0")}`}
            </Text>
          </View>

          <Animated.View style={[styles.workoutStage, workoutStageOpacity]}>
            {stageView.mode === "overview" ? (
              <View style={styles.workoutOverview}>
                <Text style={styles.metadataText}>
                  {session.sets.length} of{" "}
                  {plan.exercises.reduce(
                    (sum, exercise) => sum + exercise.targetSets,
                    0,
                  )}{" "}
                  sets
                </Text>
                <View style={styles.workoutExerciseList}>
                  {plan.exercises.map((exercise, index) => {
                    const progress = exerciseProgress[index];

                    return (
                      <View key={exercise.id}>
                        <PressableScale
                          disabled={progress.complete}
                          onPress={() => {
                            onSelectExercise(index);
                            setMode("exercise");
                          }}
                          style={styles.workoutExerciseRow}
                        >
                          <IndexText
                            active={
                              !progress.complete &&
                              index === session.activeExerciseIndex
                            }
                          >
                            {String(index + 1).padStart(2, "0")}
                          </IndexText>
                          <View style={styles.workoutExerciseCopy}>
                            <Text
                              style={[
                                styles.workoutExerciseName,
                                progress.complete && styles.untrackedText,
                              ]}
                            >
                              {exercise.name}
                            </Text>
                            <Text style={styles.monoMeta}>
                              {progress.completedSets}/{exercise.targetSets}{" "}
                              sets · {exercise.targetReps ?? 10} reps ·{" "}
                              {exercise.weightLb ?? 50} lb
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.setNow,
                              progress.complete && styles.successText,
                            ]}
                          >
                            {progress.complete ? "done" : ""}
                          </Text>
                        </PressableScale>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : stageView.mode === "voice" ? (
              <View style={styles.voiceSurface}>
                <View style={styles.listeningRow}>
                  <PulsingDot style={styles.listeningDot} />
                  <Text style={styles.bodyText}>dictate or type</Text>
                </View>
                <TextInput
                  autoFocus
                  multiline
                  onChangeText={setVoiceTranscript}
                  placeholder="three sets of forty on incline dumbbell press"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  returnKeyType="done"
                  style={styles.voiceInput}
                  value={voiceTranscript}
                />
                <Text style={styles.metadataText}>
                  uses keyboard dictation today
                </Text>
              </View>
            ) : stageView.mode === "plan" && selectedPlanExercise ? (
              <View style={styles.planSurface}>
                <Text style={styles.metadataText}>edit plan</Text>
                <View style={styles.workoutExerciseList}>
                  {plan.exercises.map((exercise, index) => (
                    <PressableScale
                      key={exercise.id}
                      onPress={() => setPlanExerciseIndex(index)}
                      style={styles.workoutExerciseRow}
                    >
                      <IndexText active={index === planExerciseIndex}>
                        {String(index + 1).padStart(2, "0")}
                      </IndexText>
                      <View style={styles.workoutExerciseCopy}>
                        <Text
                          style={[
                            styles.workoutExerciseName,
                            index !== planExerciseIndex && styles.untrackedText,
                          ]}
                        >
                          {exercise.name}
                        </Text>
                        <Text style={styles.monoMeta}>
                          {exercise.targetSets} × {exercise.targetReps ?? 10} ·{" "}
                          {exercise.weightLb ?? 0} lb · {exercise.restSeconds}s
                        </Text>
                      </View>
                    </PressableScale>
                  ))}
                </View>
                <Text style={styles.supporting}>
                  selected · {selectedPlanExercise.name}
                </Text>
              </View>
            ) : stageView.isResting ? (
              <View style={styles.restSurface}>
                <Text style={styles.metadataText}>rest</Text>
                <FormatTimer seconds={restSeconds} />
                <View style={styles.restTicks}>
                  <View style={styles.restTickActive} />
                  <View style={styles.restTickActive} />
                  <View style={styles.restTick} />
                  <View style={styles.restTick} />
                </View>
                <View style={styles.nextBlock}>
                  <Text style={styles.metadataText}>next</Text>
                  <Text style={styles.bodyText}>{activeExercise?.name}</Text>
                  <Text style={styles.monoMeta}>{targetLine}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.exerciseSurface}>
                <View>
                  <Text style={styles.exerciseTitle}>
                    {activeExercise?.name ?? "workout complete"}
                  </Text>
                  <Text style={styles.monoMeta}>{targetLine}</Text>
                </View>

                <View style={styles.setList}>
                  {Array.from({ length: activeExercise?.targetSets ?? 0 }).map(
                    (_, index) => {
                      const complete = index < completedSets;
                      const current = index === completedSets;

                      return (
                        <View key={index} style={styles.setRow}>
                          <IndexText active={current}>
                            {String(index + 1).padStart(2, "0")}
                          </IndexText>
                          <Text
                            style={[
                              styles.setValue,
                              !complete && !current && styles.disabledText,
                            ]}
                          >
                            {complete || current
                              ? `${activeExercise?.targetReps ?? 10} reps · ${activeExercise?.weightLb ?? 50} lb`
                              : "- reps · - lb"}
                          </Text>
                          <Text
                            style={[
                              styles.setNow,
                              current && styles.successText,
                            ]}
                          >
                            {current ? "now" : complete ? "-" : ""}
                          </Text>
                        </View>
                      );
                    },
                  )}
                </View>
              </View>
            )}
          </Animated.View>

          <View style={styles.bottomActions}>
            {mode === "voice" ? (
              <>
                <ActionText onPress={() => setMode("exercise")}>
                  back
                </ActionText>
                <ActionText
                  disabled={!parsedVoiceLog}
                  onPress={() => {
                    if (onLogVoice(voiceTranscript)) {
                      setVoiceTranscript("");
                      setMode("overview");
                    }
                  }}
                >
                  log
                </ActionText>
              </>
            ) : mode === "plan" && selectedPlanExercise ? (
              <>
                <ActionText onPress={() => setMode("overview")}>
                  back
                </ActionText>
                <ActionText
                  onPress={() =>
                    onUpdateExercise(selectedPlanExercise.id, {
                      targetReps: (selectedPlanExercise.targetReps ?? 10) + 1,
                    })
                  }
                >
                  reps +1
                </ActionText>
                <ActionText
                  onPress={() =>
                    onUpdateExercise(selectedPlanExercise.id, {
                      weightLb: (selectedPlanExercise.weightLb ?? 0) + 5,
                    })
                  }
                >
                  lb +5
                </ActionText>
              </>
            ) : isResting ? (
              <>
                <ActionText onPress={() => setMode("overview")}>
                  back
                </ActionText>
                <ActionText onPress={onSkipRest}>skip</ActionText>
                <ActionText onPress={onAddRest}>+30s</ActionText>
              </>
            ) : mode === "overview" ? (
              <>
                <ActionText onPress={onBack}>back</ActionText>
                <ActionText onPress={() => setMode("plan")}>
                  edit plan
                </ActionText>
                <ActionText onPress={onFinishWorkout}>
                  finish workout
                </ActionText>
              </>
            ) : (
              <>
                <ActionText onPress={() => setMode("overview")}>
                  back
                </ActionText>
                <ActionText onPress={() => setMode("voice")}>voice</ActionText>
                <ActionText onPress={onLogSet}>log set</ActionText>
              </>
            )}
          </View>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

function Home() {
  const [appState, setAppState] = useState<AppState>(() =>
    createInitialAppState(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [surface, setSurfaceState] = useState<Surface>("home");
  const { displayKey: surfaceShown, animatedStyle: surfaceOpacityStyle } =
    useSequentialCrossfade(surface, {
      fadeOutMs: 280,
      fadeInMs: 420,
    });
  const [selectedDate, setSelectedDate] = useState(today.date);
  const [visibleMonthDate, setVisibleMonthDate] = useState(today.date);
  const [workoutVisible, setWorkoutVisible] = useState(false);
  const [workoutSession, setWorkoutSession] = useState(() =>
    startWorkoutSession(createDefaultWorkoutPlan(), Date.now()),
  );
  const workoutPlan = appState.workoutPlan ?? createDefaultWorkoutPlan();
  const loggedSets = workoutSession.sets.length;
  const latestSteps = appState.stepSamples[0]?.steps ?? 0;
  const stepProgress = Math.min(latestSteps / today.stepGoal, 1);
  const workoutComplete = hasCompletedWorkout(appState, workoutPlan.id);
  const calendarMonth = createCalendarMonth(
    appState.dailyOutcomes,
    today.date,
    visibleMonthDate,
  );
  const selectedOutcome = appState.dailyOutcomes.find(
    (outcome) => outcome.date === selectedDate,
  );
  const selectedWorkoutOutcome = appState.workoutOutcomes.find(
    (outcome) => formatTimestampDate(outcome.completedAt) === selectedDate,
  );
  const recommendation = chooseRecommendation({
    steps: latestSteps,
    stepGoal: today.stepGoal,
    minutesWorked: today.focusMinutes,
    minutesUntilNextEvent: today.minutesUntilNextEvent,
    weather: today.weather,
    workout: {
      planned: true,
      completed: workoutComplete,
      name: workoutPlan.name,
    },
  });
  const openItems = workoutComplete
    ? remainingItems.filter((item) => item.title !== workoutPlan.name)
    : remainingItems;
  const homeMiddle = chooseHomeMiddle({
    minutesWorked: today.focusMinutes,
    recommendation,
    remainingItems: openItems,
  });

  useEffect(() => {
    let cancelled = false;

    loadAppState().then((stored) => {
      if (!cancelled) {
        setAppState(stored);
        if (stored.activeWorkoutSession) {
          setWorkoutSession(stored.activeWorkoutSession);
        }
        setHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      saveAppState(undefined, appState);
    }
  }, [appState, hydrated]);

  const syncHealthSteps = () => {
    void import("./src/services/healthkitNative")
      .then(({ healthKitAdapter }) => syncTodaySteps(healthKitAdapter))
      .then((sample) => {
        if (sample) {
          setAppState((state) => addStepSample(state, sample));
        }
      })
      .catch(() => undefined);
  };

  const logWorkoutSet = () => {
    setWorkoutSession((session) => {
      const nextSession = completeSet(session, workoutPlan, Date.now());

      setAppState((state) => saveActiveWorkoutSession(state, nextSession));

      return nextSession;
    });
  };
  const logWorkoutVoice = (transcript: string) => {
    const applied = applyWorkoutVoiceLog(
      workoutPlan,
      workoutSession,
      transcript,
      Date.now(),
    );

    if (!applied.success) {
      return false;
    }

    setWorkoutSession(applied.session);
    setAppState((state) => saveActiveWorkoutSession(state, applied.session));
    return true;
  };
  const selectWorkoutExercise = (index: number) => {
    setWorkoutSession((session) => {
      const nextSession = selectExercise(session, workoutPlan, index);

      setAppState((state) => saveActiveWorkoutSession(state, nextSession));

      return nextSession;
    });
  };
  const closeWorkout = () => {
    setWorkoutVisible(false);
  };
  const completeLooseItem = (title: string) => {
    setAppState((state) =>
      addDailyOutcome(state, {
        date: today.date,
        completedItems: Math.min((selectedOutcome?.completedItems ?? 5) + 1, 7),
        plannedItems: 7,
        steps: latestSteps,
        focusMinutes: today.focusMinutes,
        note: `${title} done`,
      }),
    );
  };
  const finishWorkout = () => {
    const outcome = createWorkoutOutcome(workoutPlan, workoutSession);

    setAppState((state) => {
      const withWorkout = addWorkoutOutcome(state, outcome);
      const withDailyOutcome = addDailyOutcome(withWorkout, {
        date: today.date,
        completedItems: 6,
        plannedItems: 7,
        steps: latestSteps,
        focusMinutes: today.focusMinutes,
        note: `${outcome.name} logged`,
      });
      const withWeights = outcome.exercises.reduce(
        (nextState, exercise) =>
          exercise.weightLb === undefined
            ? nextState
            : upsertExerciseWeight(nextState, {
                exerciseId: exercise.exerciseId,
                weightLb: exercise.weightLb,
                updatedAt: outcome.completedAt,
              }),
        withDailyOutcome,
      );

      return clearActiveWorkoutSession(withWeights);
    });
    setWorkoutSession(startWorkoutSession(workoutPlan, Date.now()));
    setWorkoutVisible(false);
  };
  const editWorkoutExercise = (
    exerciseId: string,
    patch: Parameters<typeof updateExercise>[2],
  ) => {
    setAppState((state) =>
      saveWorkoutPlan(
        state,
        updateExercise(
          normalizeWorkoutPlan(state.workoutPlan),
          exerciseId,
          patch,
        ),
      ),
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <Animated.View style={[styles.surfaceRoot, surfaceOpacityStyle]}>
        {surfaceShown === "home" ? (
          <View style={styles.homeContent}>
            <View style={styles.homeHeader}>
              <Text style={styles.titleText}>stead</Text>
              <PressableScale
                onPress={() => setSurfaceState("calendar")}
                hitSlop={10}
              >
                <Text style={styles.metadataText}>
                  {today.dateLabel} · {today.dateMeta}
                </Text>
              </PressableScale>
            </View>

            <HomeMiddleSurface
              middle={homeMiddle}
              onCompleteItem={completeLooseItem}
              onWorkout={() => setWorkoutVisible(true)}
            />

            <View style={styles.progressBlock}>
              <View style={styles.progressHeader}>
                <Text style={styles.indexText}>steps</Text>
                {latestSteps > 0 ? (
                  <Text style={styles.monoMeta}>
                    {latestSteps.toLocaleString()} / 10,000
                  </Text>
                ) : (
                  <ActionText onPress={syncHealthSteps}>connect</ActionText>
                )}
              </View>
              <View style={styles.progressTrack}>
                <AnimatedProgressFill
                  progress={stepProgress}
                  style={styles.progressFill}
                />
              </View>
            </View>
          </View>
        ) : surfaceShown === "calendar" ? (
          <CalendarSurface
            month={calendarMonth}
            onBack={() => setSurfaceState("home")}
            onNextMonth={() =>
              setVisibleMonthDate((date) => addMonths(date, 1))
            }
            onPreviousMonth={() =>
              setVisibleMonthDate((date) => addMonths(date, -1))
            }
            onSelectDate={(date) => {
              setSelectedDate(date);
              setSurfaceState("day");
            }}
          />
        ) : (
          <DaySurface
            loggedSets={loggedSets}
            onBack={() => setSurfaceState("home")}
            onWorkout={() => setWorkoutVisible(true)}
            selectedDate={selectedDate}
            selectedOutcome={selectedOutcome}
            selectedWorkoutOutcome={selectedWorkoutOutcome}
          />
        )}
      </Animated.View>

      <WorkoutSurface
        plan={workoutPlan}
        session={workoutSession}
        visible={workoutVisible}
        onAddRest={() =>
          setWorkoutSession((session) => {
            const nextSession = addRestTime(session, 30);

            setAppState((state) =>
              saveActiveWorkoutSession(state, nextSession),
            );

            return nextSession;
          })
        }
        onBack={closeWorkout}
        onFinishWorkout={finishWorkout}
        onLogSet={logWorkoutSet}
        onLogVoice={logWorkoutVoice}
        onSelectExercise={selectWorkoutExercise}
        onSkipRest={() =>
          setWorkoutSession((session) => {
            const nextSession = skipRest(session);

            setAppState((state) =>
              saveActiveWorkoutSession(state, nextSession),
            );

            return nextSession;
          })
        }
        onUpdateExercise={editWorkoutExercise}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Home />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingBottom: 34,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
  },
  calendarContent: {
    flex: 1,
    paddingBottom: 34,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
  },
  liveContent: {
    flex: 1,
    paddingBottom: 34,
    paddingHorizontal: spacing.screenX,
    paddingTop: 44,
  },
  surfaceRoot: {
    flex: 1,
  },
  homeContent: {
    flex: 1,
    paddingBottom: 18,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
  },
  workoutStage: {
    flex: 1,
  },
  homeHeader: {
    gap: 6,
  },
  titleStack: {
    gap: 6,
  },
  homeMiddle: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 34,
  },
  homeMeta: {
    color: colors.foreground,
    fontSize: typeScale.metadata,
    letterSpacing: 0,
    lineHeight: 19,
    opacity: opacity.metadata,
  },
  momentPhrase: {
    color: colors.foreground,
    fontSize: typeScale.body,
    letterSpacing: 0,
    lineHeight: 24,
    marginTop: 40,
    opacity: opacity.body,
  },
  momentAction: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 26,
    marginTop: 32,
    opacity: opacity.enabled,
  },
  nextTitle: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 39,
    marginTop: 28,
    opacity: opacity.title,
  },
  nextStart: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 26,
    marginTop: 52,
    opacity: opacity.enabled,
  },
  supporting: {
    color: colors.foreground,
    fontSize: typeScale.body,
    letterSpacing: 0,
    lineHeight: 24,
    marginTop: 18,
    opacity: opacity.metadata,
  },
  todayThreeList: {
    gap: 22,
    marginTop: 40,
  },
  todayThreeRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  todayThreeTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: typeScale.title,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 26,
    opacity: opacity.title,
  },
  todayThreeAction: {
    color: colors.foreground,
    fontSize: typeScale.action,
    letterSpacing: 0,
    lineHeight: 24,
    opacity: opacity.enabled,
  },
  dot: {
    color: colors.foreground,
    fontSize: typeScale.action,
    opacity: opacity.metadata,
  },
  progressBlock: {
    gap: 12,
    paddingBottom: 10,
  },
  progressHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.10)",
    height: 2,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: "rgba(255,255,255,0.72)",
    height: 2,
  },
  calendarSurface: {
    alignSelf: "center",
    flex: 1,
    gap: 18,
    justifyContent: "center",
    width: "100%",
  },
  weekdays: {
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    width: 308,
  },
  weekdayLabel: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: typeScale.index,
    letterSpacing: 0,
    lineHeight: 18,
    opacity: opacity.metadata,
    textAlign: "center",
    width: 32,
  },
  monthGrid: {
    alignSelf: "center",
    gap: 14,
    width: 308,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarCell: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  calendarLabel: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: typeScale.body,
    letterSpacing: 0,
    lineHeight: 24,
    opacity: opacity.body,
  },
  untrackedText: {
    opacity: opacity.disabled,
  },
  monthActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  metrics: {
    flexDirection: "row",
    gap: 28,
  },
  metric: {
    flex: 1,
    gap: 8,
  },
  metricValue: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 25,
    opacity: opacity.title,
  },
  dayHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  liveHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  titleText: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 26,
    opacity: opacity.title,
  },
  bodyText: {
    color: colors.foreground,
    fontSize: typeScale.body,
    letterSpacing: 0,
    lineHeight: 24,
    opacity: opacity.body,
  },
  metadataText: {
    color: colors.foreground,
    fontSize: typeScale.metadata,
    letterSpacing: 0,
    lineHeight: 19,
    opacity: opacity.metadata,
  },
  monoMeta: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: typeScale.metadata,
    letterSpacing: 0,
    lineHeight: 19,
    opacity: opacity.metadata,
  },
  indexText: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: typeScale.index,
    letterSpacing: 0,
    lineHeight: 24,
    opacity: opacity.metadata,
    width: 40,
  },
  activeText: {
    opacity: opacity.title,
  },
  disabledText: {
    opacity: opacity.disabled,
  },
  successText: {
    color: colors.success,
    opacity: opacity.title,
  },
  dayList: {
    gap: 24,
    paddingTop: 64,
  },
  dayRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  dayCopy: {
    alignItems: "baseline",
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  dayTitle: {
    color: colors.foreground,
    fontSize: typeScale.body,
    letterSpacing: 0,
    lineHeight: 24,
    opacity: opacity.metadata,
  },
  dayDetail: {
    color: colors.foreground,
    fontSize: 14,
    letterSpacing: 0,
    lineHeight: 20,
    opacity: opacity.disabled,
  },
  dayTime: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: typeScale.metadata,
    letterSpacing: 0,
    lineHeight: 19,
    opacity: opacity.metadata,
    textAlign: "right",
    width: 52,
  },
  recapSetValue: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: typeScale.metadata,
    letterSpacing: 0,
    lineHeight: 19,
    opacity: opacity.metadata,
    textAlign: "right",
    width: 92,
  },
  nudgeLine: {
    gap: 4,
    marginTop: 42,
  },
  workoutOverview: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 72,
  },
  workoutExerciseList: {
    gap: 24,
    marginTop: 44,
  },
  workoutExerciseRow: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  workoutExerciseCopy: {
    flex: 1,
    gap: 6,
  },
  workoutExerciseName: {
    color: colors.foreground,
    fontSize: typeScale.body,
    letterSpacing: 0,
    lineHeight: 24,
    opacity: opacity.body,
  },
  exerciseSurface: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 120,
  },
  exerciseTitle: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 26,
    opacity: opacity.title,
  },
  setList: {
    gap: 16,
    marginTop: 32,
  },
  setRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  setValue: {
    color: colors.foreground,
    flex: 1,
    fontFamily: typography.mono,
    fontSize: typeScale.body,
    letterSpacing: 0,
    lineHeight: 24,
    opacity: opacity.body,
  },
  setNow: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: typeScale.metadata,
    letterSpacing: 0,
    lineHeight: 19,
    opacity: opacity.metadata,
    textAlign: "right",
    width: 52,
  },
  restSurface: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 84,
  },
  restTimer: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: typeScale.countdown,
    fontWeight: "300",
    letterSpacing: 0,
    lineHeight: 68,
    marginTop: 22,
    opacity: opacity.title,
  },
  restTicks: {
    flexDirection: "row",
    gap: 8,
    marginTop: 28,
  },
  restTick: {
    backgroundColor: colors.foreground,
    height: 2,
    opacity: opacity.hint,
    width: 28,
  },
  restTickActive: {
    backgroundColor: colors.foreground,
    height: 2,
    opacity: opacity.enabled,
    width: 28,
  },
  nextBlock: {
    alignItems: "center",
    gap: 6,
    marginTop: 56,
  },
  voiceSurface: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 80,
  },
  listeningRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 54,
  },
  listeningDot: {
    backgroundColor: colors.foreground,
    borderRadius: 5,
    height: 10,
    opacity: opacity.body,
    width: 10,
  },
  voiceText: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 29,
    marginBottom: 44,
    opacity: opacity.title,
    textAlign: "center",
  },
  voiceInput: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 29,
    marginBottom: 44,
    minHeight: 96,
    opacity: opacity.title,
    textAlign: "center",
    width: "100%",
  },
  planSurface: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 72,
  },
  actionText: {
    fontSize: typeScale.action,
    letterSpacing: 0,
    lineHeight: 24,
  },
  bottomActions: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
