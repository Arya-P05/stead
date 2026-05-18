import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  AppState as NativeAppState,
  Modal,
  Pressable,
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
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
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
  addDailyItem,
  addDailyOutcome,
  addWorkoutOutcome,
  addWorkoutPlan,
  archiveWorkoutPlan,
  addStepSample,
  clearActiveWorkoutSession,
  completeDailyItem,
  createInitialAppState,
  deleteDailyItem,
  duplicateWorkoutPlan,
  getActiveWorkoutPlan,
  getDailyItemsForDate,
  hasCompletedWorkoutOnDate,
  saveActiveWorkoutSession,
  saveWorkoutPlan,
  setActiveWorkoutPlan,
  updateDailyItem,
  upsertExerciseWeight,
} from "./src/data/appState";
import type {
  AppState,
  DailyItem,
  ManagedWorkoutPlan,
} from "./src/data/appState";
import { loadAppState, saveAppState } from "./src/data/storage";
import { createWorkoutOutcome } from "./src/data/workoutOutcome";
import { createCalendarMonth } from "./src/data/calendarDays";
import type { CalendarMonth } from "./src/data/calendarDays";
import { syncTodayStepsWithStatus } from "./src/services/healthkit";
import {
  getAuthState,
  signInWithApple,
  signOut,
  type AuthState,
} from "./src/services/auth";
import { isSupabaseConfigured } from "./src/services/supabaseClient";
import { scheduleRecommendationNudge } from "./src/services/notifications";
import {
  addExercise,
  createDefaultWorkoutPlan,
  moveExercise,
  normalizeWorkoutPlan,
  removeExercise,
  updateExercise,
} from "./src/data/workoutPlan";
import {
  applyWorkoutVoiceLog,
  parseWorkoutVoiceLog,
} from "./src/domain/voiceLog";

const STEP_GOAL = 10000;

function createTodayContext(date = new Date()) {
  return {
    date: formatDateKey(date),
    dateLabel: date
      .toLocaleDateString("en-US", { weekday: "long" })
      .toLowerCase(),
    dateMeta: date
      .toLocaleDateString("en-US", { month: "long", day: "numeric" })
      .toLowerCase(),
    stepGoal: STEP_GOAL,
    focusMinutes: 154,
    workout: "push day",
    minutesUntilNextEvent: 90,
    weather: {
      condition: "sunny" as const,
      temperatureF: 72,
      precipitationChance: 0.05,
    },
  };
}

type TodayContext = ReturnType<typeof createTodayContext>;

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimestampDate(timestamp: number) {
  return formatDateKey(new Date(timestamp));
}

function formatWorkoutPlanMeta(plan: WorkoutPlan) {
  const totalSets = plan.exercises.reduce(
    (sets, exercise) => sets + exercise.targetSets,
    0,
  );

  return `${plan.exercises.length} lifts · ${totalSets} sets`;
}

type FeedbackState = "idle" | "success" | "warning";
type HealthSyncStatus = "idle" | "syncing" | "synced" | "denied" | "error";
type WorkoutMode = "overview" | "exercise" | "voice" | "plan" | "plans";
type Surface = "home" | "calendar" | "day" | "plan" | "settings";

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

function DaySurface({
  loggedSets,
  onBack,
  onPlan,
  onWorkout,
  selectedDate,
  selectedOutcome,
  selectedWorkoutOutcome,
  today,
}: {
  loggedSets: number;
  onBack: () => void;
  onPlan: () => void;
  onWorkout: () => void;
  selectedDate: string;
  selectedOutcome?: AppState["dailyOutcomes"][number];
  selectedWorkoutOutcome?: AppState["workoutOutcomes"][number];
  today: TodayContext;
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
              : ""}
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
        <View style={styles.emptyDay}>
          <Text style={styles.homeMeta}>
            {isToday ? "nothing logged yet" : "empty day"}
          </Text>
          <Text style={styles.momentPhrase}>
            {isToday
              ? "start a workout or mark one of today's actions when you do it."
              : "no outcomes were saved for this date."}
          </Text>
          {isToday ? (
            <PressableScale onPress={onWorkout} hitSlop={12}>
              <Text style={styles.momentAction}>start workout</Text>
            </PressableScale>
          ) : null}
        </View>
      )}

      <View style={styles.bottomActions}>
        <ActionText onPress={onBack}>back</ActionText>
        <ActionText onPress={onPlan}>plan</ActionText>
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

function DayPlanSurface({
  date,
  items,
  onAddItem,
  onBack,
  onCompleteItem,
  onDeleteItem,
  onRenameItem,
  workoutPlan,
}: {
  date: string;
  items: DailyItem[];
  onAddItem: (title: string) => void;
  onBack: () => void;
  onCompleteItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onRenameItem: (itemId: string, title: string) => void;
  workoutPlan: WorkoutPlan;
}) {
  const [draft, setDraft] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = items.find((item) => item.id === selectedItemId);

  useEffect(() => {
    setSelectedItemId(null);
    setDraft("");
  }, [date]);

  const submitDraft = () => {
    const title = draft.trim();

    if (!title) {
      return;
    }

    if (selectedItem) {
      onRenameItem(selectedItem.id, title);
    } else {
      onAddItem(title);
    }

    setSelectedItemId(null);
    setDraft("");
  };

  return (
    <View style={styles.calendarContent}>
      <View style={styles.dayHeader}>
        <View style={styles.titleStack}>
          <Text style={styles.titleText}>plan day</Text>
          <Text style={styles.metadataText}>{date}</Text>
        </View>
      </View>

      <View style={styles.dayList}>
        {items.length === 0 ? (
          <View style={styles.nudgeLine}>
            <Text style={styles.homeMeta}>nothing planned</Text>
            <Text style={styles.bodyText}>add the next thing.</Text>
          </View>
        ) : (
          items.map((item, index) => (
            <PressableScale
              key={item.id}
              onPress={() => {
                setSelectedItemId(item.id);
                setDraft(item.title);
              }}
              style={styles.dayRow}
            >
              <IndexText active={selectedItemId === item.id}>
                {String(index + 1).padStart(2, "0")}
              </IndexText>
              <View style={styles.dayCopy}>
                <Text
                  style={[
                    styles.dayTitle,
                    styles.activeText,
                    item.completedAt !== null && styles.untrackedText,
                  ]}
                >
                  {item.title}
                </Text>
                {item.kind === "workout" ? (
                  <Text style={styles.dayDetail}>{workoutPlan.name}</Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.setNow,
                  item.completedAt !== null && styles.successText,
                ]}
              >
                {item.completedAt === null ? "edit" : "done"}
              </Text>
            </PressableScale>
          ))
        )}
      </View>

      <TextInput
        onChangeText={setDraft}
        placeholder={selectedItem ? "rename item" : "add item"}
        placeholderTextColor="rgba(255,255,255,0.22)"
        returnKeyType="done"
        style={styles.planInput}
        value={draft}
      />

      <View style={styles.bottomActions}>
        <ActionText onPress={onBack}>back</ActionText>
        {selectedItem ? (
          <>
            <ActionText
              disabled={selectedItem.completedAt !== null}
              onPress={() => onCompleteItem(selectedItem.id)}
            >
              done
            </ActionText>
            <ActionText
              tone="warning"
              onPress={() => {
                onDeleteItem(selectedItem.id);
                setSelectedItemId(null);
                setDraft("");
              }}
            >
              delete
            </ActionText>
          </>
        ) : null}
        <ActionText disabled={!draft.trim()} onPress={submitDraft}>
          {selectedItem ? "save" : "add"}
        </ActionText>
      </View>
    </View>
  );
}

function SettingsSurface({
  authMessage,
  authState,
  healthSyncStatus,
  notificationsEnabled,
  onBack,
  onEnableNotifications,
  onSignIn,
  onSignOut,
  supabaseConfigured,
}: {
  authMessage: string | null;
  authState: AuthState;
  healthSyncStatus: HealthSyncStatus;
  notificationsEnabled: boolean;
  onBack: () => void;
  onEnableNotifications: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  supabaseConfigured: boolean;
}) {
  return (
    <View style={styles.calendarContent}>
      <View style={styles.dayHeader}>
        <View style={styles.titleStack}>
          <Text style={styles.titleText}>settings</Text>
          <Text style={styles.metadataText}>account · sync · permissions</Text>
        </View>
      </View>

      <View style={styles.dayList}>
        <View style={styles.nudgeLine}>
          <Text style={styles.homeMeta}>account</Text>
          <Text style={styles.bodyText}>
            {authState.status === "signedIn"
              ? (authState.user.email ?? "signed in with apple")
              : "not signed in"}
          </Text>
          {authMessage ? (
            <Text style={styles.metadataText}>{authMessage}</Text>
          ) : null}
        </View>

        <View style={styles.nudgeLine}>
          <Text style={styles.homeMeta}>sync</Text>
          <Text style={styles.bodyText}>
            {supabaseConfigured ? "supabase ready" : "local mode"}
          </Text>
          <Text style={styles.metadataText}>
            local saves continue even when sync is unavailable.
          </Text>
        </View>

        <View style={styles.nudgeLine}>
          <Text style={styles.homeMeta}>health</Text>
          <Text style={styles.bodyText}>{healthSyncStatus}</Text>
          <Text style={styles.metadataText}>
            steps come from healthkit only.
          </Text>
        </View>

        <View style={styles.nudgeLine}>
          <Text style={styles.homeMeta}>notifications</Text>
          <Text style={styles.bodyText}>
            {notificationsEnabled ? "nudges on" : "nudges off"}
          </Text>
          <Text style={styles.metadataText}>local reminders only for v1.</Text>
        </View>
      </View>

      <View style={styles.bottomActions}>
        <ActionText onPress={onBack}>back</ActionText>
        {authState.status === "signedIn" ? (
          <ActionText tone="warning" onPress={onSignOut}>
            sign out
          </ActionText>
        ) : (
          <ActionText onPress={onSignIn}>apple</ActionText>
        )}
        <ActionText onPress={onEnableNotifications}>nudges</ActionText>
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
  onCompleteItem: (itemId: string) => void;
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
        {middle.detail ? (
          <Text style={styles.supporting}>{middle.detail}</Text>
        ) : null}
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
              item.action === "workout" ? onWorkout() : onCompleteItem(item.id)
            }
            style={styles.todayThreeRow}
          >
            <Text style={styles.indexText}>
              {String(index + 1).padStart(2, "0")}
            </Text>
            <Text style={styles.todayThreeTitle}>{item.title}</Text>
            <Text style={styles.todayThreeAction}>
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
  activePlanId,
  plan,
  plans,
  session,
  visible,
  onAddRest,
  onArchivePlan,
  onBack,
  onCreatePlan,
  onDuplicatePlan,
  onFinishWorkout,
  onLogSet,
  onLogVoice,
  onSelectPlan,
  onSelectExercise,
  onSkipRest,
  onAddExercise,
  onMoveExercise,
  onRemoveExercise,
  onUpdateExercise,
}: {
  activePlanId: string;
  plan: WorkoutPlan;
  plans: ManagedWorkoutPlan[];
  session: WorkoutSession;
  visible: boolean;
  onAddRest: () => void;
  onArchivePlan: (planId: string) => void;
  onBack: () => void;
  onCreatePlan: () => void;
  onDuplicatePlan: (planId: string) => void;
  onFinishWorkout: () => void;
  onLogSet: () => void;
  onLogVoice: (transcript: string) => boolean;
  onSelectPlan: (planId: string) => void;
  onSelectExercise: (index: number) => void;
  onSkipRest: () => void;
  onAddExercise: () => void;
  onMoveExercise: (exerciseId: string, direction: -1 | 1) => void;
  onRemoveExercise: (exerciseId: string) => void;
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
  const activePlans = plans.filter(
    (storedPlan) => storedPlan.archivedAt === null,
  );
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
            ) : stageView.mode === "plans" ? (
              <View style={styles.planSurface}>
                <Text style={styles.metadataText}>workouts</Text>
                <View style={styles.workoutExerciseList}>
                  {activePlans.map((storedPlan, index) => (
                    <PressableScale
                      key={storedPlan.id}
                      onPress={() => onSelectPlan(storedPlan.id)}
                      style={styles.workoutExerciseRow}
                    >
                      <IndexText active={storedPlan.id === activePlanId}>
                        {String(index + 1).padStart(2, "0")}
                      </IndexText>
                      <View style={styles.workoutExerciseCopy}>
                        <Text
                          style={[
                            styles.workoutExerciseName,
                            storedPlan.id !== activePlanId &&
                              styles.untrackedText,
                          ]}
                        >
                          {storedPlan.name}
                        </Text>
                        <Text style={styles.monoMeta}>
                          {formatWorkoutPlanMeta(storedPlan)}
                        </Text>
                      </View>
                    </PressableScale>
                  ))}
                </View>
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
                <View style={styles.inlineActions}>
                  <ActionText
                    onPress={() =>
                      onUpdateExercise(selectedPlanExercise.id, {
                        targetSets: selectedPlanExercise.targetSets + 1,
                      })
                    }
                  >
                    sets +1
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
                </View>
                <View style={styles.inlineActions}>
                  <ActionText
                    onPress={() =>
                      onUpdateExercise(selectedPlanExercise.id, {
                        restSeconds: selectedPlanExercise.restSeconds + 15,
                      })
                    }
                  >
                    rest +15
                  </ActionText>
                  <ActionText
                    disabled={planExerciseIndex === 0}
                    onPress={() => onMoveExercise(selectedPlanExercise.id, -1)}
                  >
                    up
                  </ActionText>
                  <ActionText
                    disabled={planExerciseIndex >= plan.exercises.length - 1}
                    onPress={() => onMoveExercise(selectedPlanExercise.id, 1)}
                  >
                    down
                  </ActionText>
                  <ActionText
                    disabled={plan.exercises.length <= 1}
                    tone="warning"
                    onPress={() => onRemoveExercise(selectedPlanExercise.id)}
                  >
                    remove
                  </ActionText>
                </View>
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
                <ActionText onPress={() => setMode("plans")}>
                  workouts
                </ActionText>
                <ActionText onPress={onAddExercise}>add</ActionText>
              </>
            ) : mode === "plans" ? (
              <>
                <ActionText onPress={() => setMode("plan")}>back</ActionText>
                <ActionText onPress={onCreatePlan}>new</ActionText>
                <ActionText onPress={() => onDuplicatePlan(activePlanId)}>
                  copy
                </ActionText>
                <ActionText
                  disabled={activePlans.length <= 1}
                  tone="warning"
                  onPress={() => onArchivePlan(activePlanId)}
                >
                  archive
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
  const [today, setToday] = useState(() => createTodayContext());
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
  const [selectedDate, setSelectedDate] = useState(() => today.date);
  const [visibleMonthDate, setVisibleMonthDate] = useState(() => today.date);
  const [healthSyncStatus, setHealthSyncStatus] =
    useState<HealthSyncStatus>("idle");
  const [authState, setAuthState] = useState<AuthState>({
    status: "signedOut",
  });
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [workoutVisible, setWorkoutVisible] = useState(false);
  const [workoutSession, setWorkoutSession] = useState(() =>
    startWorkoutSession(createDefaultWorkoutPlan(), Date.now()),
  );
  const workoutPlan = getActiveWorkoutPlan(appState);
  const loggedSets = workoutSession.sets.length;
  const latestSteps = appState.stepSamples[0]?.steps ?? 0;
  const stepProgress = Math.min(latestSteps / today.stepGoal, 1);
  const workoutComplete = hasCompletedWorkoutOnDate(
    appState,
    workoutPlan.id,
    today.date,
  );
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
  const todayItems = getDailyItemsForDate(appState, today.date);
  const selectedDateItems = getDailyItemsForDate(appState, selectedDate);
  const openItems = todayItems
    .filter((item) => item.completedAt === null)
    .map((item) => ({
      id: item.id,
      title: item.title,
      action: item.kind === "workout" ? ("workout" as const) : undefined,
    }));
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
  const homeMiddle = chooseHomeMiddle({
    minutesWorked: today.focusMinutes,
    recommendation,
    remainingItems: openItems,
    workoutMeta: formatWorkoutPlanMeta(workoutPlan),
  });
  const stepGoalLabel = today.stepGoal.toLocaleString();

  useEffect(() => {
    let cancelled = false;

    getAuthState().then((state) => {
      if (!cancelled) {
        setAuthState(state);
      }
    });

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
    const refreshToday = () => {
      const nextToday = createTodayContext();

      setToday((currentToday) =>
        currentToday.date === nextToday.date ? currentToday : nextToday,
      );
    };

    refreshToday();

    const interval = setInterval(refreshToday, 60 * 1000);
    const subscription = NativeAppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          refreshToday();
        }
      },
    );

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      void saveAppState(appState);
    }
  }, [appState, hydrated]);

  const syncHealthSteps = () => {
    setHealthSyncStatus("syncing");

    void import("./src/services/healthkitNative")
      .then(({ healthKitAdapter }) =>
        syncTodayStepsWithStatus(healthKitAdapter),
      )
      .then((result) => {
        if (result.status === "success") {
          setAppState((state) => addStepSample(state, result.sample));
          setHealthSyncStatus("synced");
        } else {
          setHealthSyncStatus("denied");
        }
      })
      .catch(() => setHealthSyncStatus("error"));
  };
  const signIn = () => {
    setAuthMessage(null);

    void signInWithApple()
      .then((state) => {
        setAuthState(state);
        setAuthMessage(
          state.status === "signedIn" ? "sync account ready" : null,
        );
      })
      .catch((error) =>
        setAuthMessage(
          error instanceof Error ? error.message : "sign in failed",
        ),
      );
  };
  const signOutOfAccount = () => {
    void signOut()
      .then(() => {
        setAuthState({ status: "signedOut" });
        setAuthMessage("signed out");
      })
      .catch((error) =>
        setAuthMessage(
          error instanceof Error ? error.message : "sign out failed",
        ),
      );
  };
  const enableNotifications = () => {
    void scheduleRecommendationNudge({
      identifier: `stead-${today.date}`,
      title: "stead",
      body: recommendation.action,
      secondsFromNow: 60 * 30,
    }).then((id) => {
      setNotificationsEnabled(id !== null);
    });
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
  const completeLooseItem = (itemId: string) => {
    const item = todayItems.find((dailyItem) => dailyItem.id === itemId);
    const plannedCount = Math.max(todayItems.length, 1);

    if (!item) {
      return;
    }

    setAppState((state) => {
      const completedState = completeDailyItem(state, itemId);
      const completedItems = getDailyItemsForDate(
        completedState,
        today.date,
      ).filter((dailyItem) => dailyItem.completedAt !== null).length;

      return addDailyOutcome(completedState, {
        date: today.date,
        completedItems,
        plannedItems: plannedCount,
        steps: latestSteps,
        focusMinutes: today.focusMinutes,
        note: `${item.title} done`,
      });
    });
  };
  const finishWorkout = () => {
    const outcome = createWorkoutOutcome(workoutPlan, workoutSession);
    const linkedWorkoutItem = todayItems.find(
      (item) =>
        item.kind === "workout" &&
        item.workoutPlanId === workoutPlan.id &&
        item.completedAt === null,
    );
    const plannedCount = Math.max(todayItems.length, 1);

    setAppState((state) => {
      const withItemComplete = linkedWorkoutItem
        ? completeDailyItem(state, linkedWorkoutItem.id, outcome.completedAt)
        : state;
      const withWorkout = addWorkoutOutcome(withItemComplete, outcome);
      const completedItems = getDailyItemsForDate(
        withWorkout,
        today.date,
      ).filter((item) => item.completedAt !== null).length;
      const withDailyOutcome = addDailyOutcome(withWorkout, {
        date: today.date,
        completedItems,
        plannedItems: plannedCount,
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
  const addWorkoutExercise = () => {
    const createdAt = Date.now();

    setAppState((state) =>
      saveWorkoutPlan(
        state,
        addExercise(getActiveWorkoutPlan(state), {
          id: `exercise-${createdAt}`,
          name: "new exercise",
          targetSets: 3,
          targetReps: 10,
          weightLb: 0,
          restSeconds: 60,
        }),
      ),
    );
  };
  const moveWorkoutExercise = (exerciseId: string, direction: -1 | 1) => {
    setAppState((state) =>
      saveWorkoutPlan(
        state,
        moveExercise(getActiveWorkoutPlan(state), exerciseId, direction),
      ),
    );
  };
  const removeWorkoutExercise = (exerciseId: string) => {
    setAppState((state) => {
      const nextPlan = removeExercise(getActiveWorkoutPlan(state), exerciseId);

      setWorkoutSession(startWorkoutSession(nextPlan, Date.now()));

      return saveWorkoutPlan(state, nextPlan);
    });
  };
  const createWorkoutPlan = () => {
    const createdAt = Date.now();
    const plan: WorkoutPlan = {
      id: `workout-plan-${createdAt}`,
      name: "new workout",
      exercises: [
        {
          id: `exercise-${createdAt}`,
          name: "new exercise",
          targetSets: 3,
          targetReps: 10,
          weightLb: 0,
          restSeconds: 60,
        },
      ],
    };

    setAppState((state) => addWorkoutPlan(state, plan, createdAt));
    setWorkoutSession(startWorkoutSession(plan, createdAt));
  };
  const selectWorkoutPlan = (planId: string) => {
    const plan = appState.workoutPlans.find(
      (storedPlan) =>
        storedPlan.id === planId && storedPlan.archivedAt === null,
    );

    if (!plan) {
      return;
    }

    setAppState((state) => setActiveWorkoutPlan(state, planId));
    setWorkoutSession(startWorkoutSession(plan, Date.now()));
  };
  const duplicateActiveWorkoutPlan = (planId: string) => {
    setAppState((state) => {
      const nextState = duplicateWorkoutPlan(state, planId);
      setWorkoutSession(
        startWorkoutSession(getActiveWorkoutPlan(nextState), Date.now()),
      );
      return nextState;
    });
  };
  const archiveActiveWorkoutPlan = (planId: string) => {
    setAppState((state) => {
      const nextState = archiveWorkoutPlan(state, planId);
      setWorkoutSession(
        startWorkoutSession(getActiveWorkoutPlan(nextState), Date.now()),
      );
      return nextState;
    });
  };
  const addPlanItem = (title: string) => {
    setAppState((state) =>
      addDailyItem(state, {
        date: selectedDate,
        title,
        kind: title.toLowerCase() === workoutPlan.name ? "workout" : "task",
        workoutPlanId:
          title.toLowerCase() === workoutPlan.name ? workoutPlan.id : undefined,
      }),
    );
  };
  const renamePlanItem = (itemId: string, title: string) => {
    setAppState((state) =>
      updateDailyItem(state, itemId, {
        title,
        kind: title.toLowerCase() === workoutPlan.name ? "workout" : "task",
        workoutPlanId:
          title.toLowerCase() === workoutPlan.name ? workoutPlan.id : undefined,
      }),
    );
  };
  const completePlanItem = (itemId: string) => {
    if (selectedDate === today.date) {
      completeLooseItem(itemId);
      return;
    }

    setAppState((state) => completeDailyItem(state, itemId));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <Animated.View style={[styles.surfaceRoot, surfaceOpacityStyle]}>
        {surfaceShown === "home" ? (
          <View style={styles.homeContent}>
            <View style={styles.homeHeader}>
              <View style={styles.homeHeaderRow}>
                <View style={styles.titleStack}>
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
                <View style={styles.headerActions}>
                  <ActionText
                    onPress={() => {
                      setSelectedDate(today.date);
                      setSurfaceState("plan");
                    }}
                  >
                    plan
                  </ActionText>
                  <ActionText onPress={() => setSurfaceState("settings")}>
                    settings
                  </ActionText>
                </View>
              </View>
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
                    {latestSteps.toLocaleString()} / {stepGoalLabel}
                  </Text>
                ) : healthSyncStatus === "syncing" ? (
                  <Text style={styles.monoMeta}>syncing</Text>
                ) : healthSyncStatus === "synced" ? (
                  <Text style={[styles.monoMeta, styles.successText]}>
                    synced
                  </Text>
                ) : healthSyncStatus === "denied" ? (
                  <Text style={styles.monoMeta}>health denied</Text>
                ) : healthSyncStatus === "error" ? (
                  <ActionText tone="warning" onPress={syncHealthSteps}>
                    retry
                  </ActionText>
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
        ) : surfaceShown === "plan" ? (
          <DayPlanSurface
            date={selectedDate}
            items={selectedDateItems}
            onAddItem={addPlanItem}
            onBack={() => setSurfaceState("home")}
            onCompleteItem={completePlanItem}
            onDeleteItem={(itemId) =>
              setAppState((state) => deleteDailyItem(state, itemId))
            }
            onRenameItem={renamePlanItem}
            workoutPlan={workoutPlan}
          />
        ) : surfaceShown === "settings" ? (
          <SettingsSurface
            authMessage={authMessage}
            authState={authState}
            healthSyncStatus={healthSyncStatus}
            notificationsEnabled={notificationsEnabled}
            onBack={() => setSurfaceState("home")}
            onEnableNotifications={enableNotifications}
            onSignIn={signIn}
            onSignOut={signOutOfAccount}
            supabaseConfigured={isSupabaseConfigured()}
          />
        ) : (
          <DaySurface
            loggedSets={loggedSets}
            onBack={() => setSurfaceState("home")}
            onPlan={() => setSurfaceState("plan")}
            onWorkout={() => setWorkoutVisible(true)}
            selectedDate={selectedDate}
            selectedOutcome={selectedOutcome}
            selectedWorkoutOutcome={selectedWorkoutOutcome}
            today={today}
          />
        )}
      </Animated.View>

      <WorkoutSurface
        activePlanId={appState.activeWorkoutPlanId}
        plan={workoutPlan}
        plans={appState.workoutPlans}
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
        onArchivePlan={archiveActiveWorkoutPlan}
        onCreatePlan={createWorkoutPlan}
        onDuplicatePlan={duplicateActiveWorkoutPlan}
        onFinishWorkout={finishWorkout}
        onLogSet={logWorkoutSet}
        onLogVoice={logWorkoutVoice}
        onSelectPlan={selectWorkoutPlan}
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
        onAddExercise={addWorkoutExercise}
        onMoveExercise={moveWorkoutExercise}
        onRemoveExercise={removeWorkoutExercise}
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
  homeHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerActions: {
    alignItems: "flex-end",
    gap: 10,
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
  inlineActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    marginTop: 18,
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
  emptyDay: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 84,
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
  planInput: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 29,
    marginTop: "auto",
    opacity: opacity.title,
    paddingBottom: 28,
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
