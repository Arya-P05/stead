import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors, opacity, spacing, typeScale, typography } from './src/designSystem';
import { chooseRecommendation } from './src/domain/recommendations';
import { chooseHomeMiddle } from './src/domain/homeMiddle';
import type { HomeMiddle } from './src/domain/homeMiddle';
import {
  addRestTime,
  completeSet,
  getActiveExercise,
  getRestRemainingSeconds,
  skipRest,
  startWorkoutSession,
} from './src/domain/workoutSession';
import type { WorkoutPlan, WorkoutSession } from './src/domain/workoutSession';
import {
  addWorkoutOutcome,
  createInitialAppState,
  upsertExerciseWeight,
} from './src/data/appState';
import type { AppState } from './src/data/appState';
import { loadAppState, saveAppState } from './src/data/storage';
import { createWorkoutOutcome } from './src/data/workoutOutcome';
import { createCalendarMonth } from './src/data/calendarDays';
import type { CalendarMonth } from './src/data/calendarDays';

const today = {
  date: '2026-05-09',
  dateLabel: 'saturday',
  dateMeta: 'may 9',
  stepGoal: 10000,
  focusMinutes: 154,
  workout: 'push day',
  minutesUntilNextEvent: 90,
  weather: {
    condition: 'sunny' as const,
    temperatureF: 72,
    precipitationChance: 0.05,
  },
};

type DayItem = {
  title: string;
  detail: string;
  time: string;
  active?: boolean;
  action?: 'workout';
};

const dayItems: DayItem[] = [
  { title: 'walk', detail: 'ten min', time: '8:30' },
  { title: 'focus', detail: '2h 14m', time: '9:00' },
  { title: 'walk', detail: 'ten min', time: '12:30' },
  { title: 'lunch', detail: '20 min', time: '1:00' },
  { title: 'focus', detail: 'in flow', time: 'now', active: true },
  { title: 'push day', detail: '47 min', time: '6:30', action: 'workout' },
  { title: 'read', detail: '30 min', time: '9:00' },
];

const remainingItems = [
  { title: 'walk', time: 'now' },
  { title: 'push day', time: '6:30' },
  { title: 'read', time: '9:00' },
];

const workoutPlan: WorkoutPlan = {
  id: 'push-day',
  name: 'push day',
  exercises: [
    {
      id: 'incline-db-press',
      name: 'incline dumbbell press',
      targetSets: 4,
      targetReps: 10,
      weightLb: 50,
      restSeconds: 90,
    },
    {
      id: 'shoulder-press',
      name: 'shoulder press',
      targetSets: 3,
      targetReps: 10,
      weightLb: 40,
      restSeconds: 90,
    },
    {
      id: 'cable-fly',
      name: 'cable fly',
      targetSets: 3,
      targetReps: 12,
      weightLb: 25,
      restSeconds: 60,
    },
    {
      id: 'tricep-pushdown',
      name: 'tricep pushdown',
      targetSets: 3,
      targetReps: 15,
      weightLb: 35,
      restSeconds: 60,
    },
    {
      id: 'lat-raise',
      name: 'lat raise',
      targetSets: 3,
      targetReps: 12,
      weightLb: 15,
      restSeconds: 45,
    },
  ],
};

type FeedbackState = 'idle' | 'success' | 'warning';
type WorkoutMode = 'exercise' | 'voice';
type Surface = 'home' | 'calendar' | 'day';

function ActionText({
  children,
  disabled,
  tone = 'success',
  onPress,
}: {
  children: string;
  disabled?: boolean;
  tone?: Exclude<FeedbackState, 'idle'>;
  onPress: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const [feedback, setFeedback] = useState<FeedbackState>('idle');

  const runFeedback = async () => {
    if (disabled) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setFeedback('warning');
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setFeedback(tone);
      onPress();
    }

    Animated.sequence([
      Animated.timing(translateY, {
        toValue: -1,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => setFeedback('idle'), 480);
  };

  const color =
    feedback === 'success'
      ? colors.success
      : feedback === 'warning'
        ? colors.warning
        : colors.foreground;

  return (
    <Pressable onPress={runFeedback} hitSlop={12}>
      <Animated.Text
        style={[
          styles.actionText,
          {
            color,
            opacity: disabled ? opacity.disabled : opacity.enabled,
            transform: [{ translateY }],
          },
        ]}
      >
        {children}
      </Animated.Text>
    </Pressable>
  );
}

function IndexText({ children, active }: { children: string; active?: boolean }) {
  return <Text style={[styles.indexText, active && styles.activeText]}>{children}</Text>;
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
      <IndexText active={item.active}>{String(index + 1).padStart(2, '0')}</IndexText>
      <View style={styles.dayCopy}>
        <Text style={[styles.dayTitle, item.active && styles.activeText]}>{item.title}</Text>
        <Text style={styles.dayDetail}>{item.detail}</Text>
      </View>
      <Text style={[styles.dayTime, item.active && styles.activeText]}>{item.time}</Text>
    </View>
  );

  if (item.action === 'workout') {
    return (
      <Pressable onPress={onWorkout} hitSlop={8}>
        {row}
      </Pressable>
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
}: {
  loggedSets: number;
  onBack: () => void;
  onWorkout: () => void;
  selectedDate: string;
  selectedOutcome?: AppState['dailyOutcomes'][number];
}) {
  const isToday = selectedDate === today.date;

  return (
    <View style={styles.calendarContent}>
      <View style={styles.dayHeader}>
        <View>
          <Text style={styles.titleText}>{isToday ? today.dateLabel : selectedDate.slice(5)}</Text>
          <Text style={styles.metadataText}>
            {selectedOutcome
              ? `${selectedOutcome.completedItems} / ${selectedOutcome.plannedItems} done`
              : isToday
                ? today.dateMeta
                : 'no tracked outcome'}
          </Text>
        </View>
        <Text style={styles.monoMeta}>{loggedSets > 0 ? `${loggedSets} / 17` : '5 / 7'}</Text>
      </View>

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

      <View style={styles.bottomActions}>
        <ActionText onPress={onBack}>home</ActionText>
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
        <View>
          <Text style={styles.titleText}>{month.label}</Text>
          <Text style={styles.metadataText}>{month.meta}</Text>
        </View>
      </View>

      <View style={styles.calendarSurface}>
        <View style={styles.weekdays}>
          {['s', 'm', 't', 'w', 't', 'f', 's'].map((weekday, index) => (
            <Text key={`${weekday}-${index}`} style={styles.weekdayLabel}>
              {weekday}
            </Text>
          ))}
        </View>
        <View style={styles.monthGrid}>
          {month.weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((day, dayIndex) =>
                day === null ? (
                  <View key={`empty-${dayIndex}`} style={styles.calendarCell} />
                ) : (
                  <Pressable
                    key={day.date}
                    disabled={!day.selectable}
                    onPress={() => onSelectDate(day.date)}
                    style={styles.calendarCell}
                  >
                    <Text
                      style={[
                        styles.calendarLabel,
                        (!day.tracked || day.future) && styles.untrackedText,
                      ]}
                    >
                      {day.label}
                    </Text>
                  </Pressable>
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
  onWorkout,
}: {
  middle: HomeMiddle;
  onWorkout: () => void;
}) {
  if (middle.type === 'moment') {
    return (
      <View style={styles.homeMiddle}>
        <Text style={styles.homeMeta}>{middle.meta}</Text>
        <Text style={styles.momentPhrase}>{middle.phrase}</Text>
        <Text style={styles.momentAction}>{middle.action}</Text>
      </View>
    );
  }

  if (middle.type === 'next') {
    return (
      <View style={styles.homeMiddle}>
        <Text style={styles.homeMeta}>{middle.label}</Text>
        <Text style={styles.nextTitle}>{middle.title}</Text>
        <Text style={styles.homeMeta}>{middle.meta}</Text>
        <Pressable onPress={onWorkout} hitSlop={12}>
          <Text style={styles.nextStart}>{middle.action}</Text>
        </Pressable>
        <Text style={styles.supporting}>{middle.detail}</Text>
      </View>
    );
  }

  return (
    <View style={styles.homeMiddle}>
      <Text style={styles.homeMeta}>{middle.meta}</Text>
      <View style={styles.todayThreeList}>
        {middle.items.map((item, index) => (
          <View key={`${item.title}-${item.time}`} style={styles.todayThreeRow}>
            <Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={[styles.todayThreeTitle, index > 0 && styles.untrackedText]}>
              {item.title}
            </Text>
            <Text style={[styles.todayThreeTime, index > 0 && styles.untrackedText]}>
              {item.time}
            </Text>
          </View>
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
      {minutes}:{String(remainingSeconds).padStart(2, '0')}
    </Text>
  );
}

function WorkoutSurface({
  session,
  visible,
  onAddRest,
  onClose,
  onLogSet,
  onSkipRest,
}: {
  session: WorkoutSession;
  visible: boolean;
  onAddRest: () => void;
  onClose: () => void;
  onLogSet: () => void;
  onSkipRest: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState<WorkoutMode>('exercise');
  const activeExercise = getActiveExercise(workoutPlan, session);
  const restSeconds = getRestRemainingSeconds(session, now);
  const isResting = restSeconds > 0;
  const completedSets = activeExercise
    ? session.sets.filter((set) => set.exerciseId === activeExercise.id).length
    : 0;
  const exerciseIndex = Math.min(session.activeExerciseIndex + 1, workoutPlan.exercises.length);
  const setLabel = activeExercise
    ? `set  ${Math.min(completedSets + 1, activeExercise.targetSets)} of ${activeExercise.targetSets}`
    : 'done';

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, [visible]);

  useEffect(() => {
    if (isResting) {
      setMode('exercise');
    }
  }, [isResting]);

  const targetLine = activeExercise
    ? `${activeExercise.targetSets} × ${activeExercise.targetReps ?? 10} · ${activeExercise.weightLb ?? 50} lb`
    : `${session.sets.length} sets logged`;

  return (
    <Modal animationType="slide" visible={visible} presentationStyle="fullScreen">
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.liveContent}>
          <View style={styles.liveHeader}>
            <Text style={styles.metadataText}>
              {workoutPlan.name}
              {mode === 'voice' ? ' · live' : ''}
            </Text>
            <Text style={styles.monoMeta}>
              {mode === 'voice' ? '00:14' : isResting ? setLabel : `${String(exerciseIndex).padStart(2, '0')}  of  ${String(workoutPlan.exercises.length).padStart(2, '0')}`}
            </Text>
          </View>

          {mode === 'voice' ? (
            <View style={styles.voiceSurface}>
              <View style={styles.listeningRow}>
                <View style={styles.listeningDot} />
                <Text style={styles.bodyText}>listening</Text>
              </View>
              <Text style={styles.voiceText}>three sets of forty{'\n'}on incline dumbbell press</Text>
              <Text style={styles.metadataText}>captured · ready to log</Text>
            </View>
          ) : isResting ? (
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
                <Text style={styles.exerciseTitle}>{activeExercise?.name ?? 'workout complete'}</Text>
                <Text style={styles.monoMeta}>{targetLine}</Text>
              </View>

              <View style={styles.setList}>
                {Array.from({ length: activeExercise?.targetSets ?? 0 }).map((_, index) => {
                  const complete = index < completedSets;
                  const current = index === completedSets;

                  return (
                    <View key={index} style={styles.setRow}>
                      <IndexText active={current}>{String(index + 1).padStart(2, '0')}</IndexText>
                      <Text style={[styles.setValue, !complete && !current && styles.disabledText]}>
                        {complete || current
                          ? `${activeExercise?.targetReps ?? 10} reps · ${activeExercise?.weightLb ?? 50} lb`
                          : '- reps · - lb'}
                      </Text>
                      <Text style={[styles.setNow, current && styles.successText]}>
                        {current ? 'now' : complete ? '-' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.bottomActions}>
            {mode === 'voice' ? (
              <>
                <ActionText onPress={() => setMode('exercise')}>cancel</ActionText>
                <ActionText onPress={onLogSet}>log</ActionText>
              </>
            ) : isResting ? (
              <>
                <ActionText onPress={onSkipRest}>skip</ActionText>
                <ActionText onPress={onAddRest}>+30s</ActionText>
                <ActionText onPress={onClose}>end</ActionText>
              </>
            ) : (
              <>
                <ActionText onPress={() => setMode('voice')}>voice</ActionText>
                <ActionText onPress={onLogSet}>log set</ActionText>
                <ActionText onPress={onClose}>skip</ActionText>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Home() {
  const [appState, setAppState] = useState<AppState>(() => createInitialAppState());
  const [hydrated, setHydrated] = useState(false);
  const [surface, setSurface] = useState<Surface>('home');
  const [selectedDate, setSelectedDate] = useState(today.date);
  const [visibleMonthDate, setVisibleMonthDate] = useState(today.date);
  const [workoutVisible, setWorkoutVisible] = useState(false);
  const [workoutSession, setWorkoutSession] = useState(() =>
    startWorkoutSession(workoutPlan, Date.now()),
  );
  const loggedSets = workoutSession.sets.length;
  const latestSteps = appState.stepSamples[0]?.steps ?? 0;
  const stepProgress = Math.min(latestSteps / today.stepGoal, 1);
  const calendarMonth = createCalendarMonth(appState.dailyOutcomes, today.date, visibleMonthDate);
  const selectedOutcome = appState.dailyOutcomes.find((outcome) => outcome.date === selectedDate);
  const recommendation = chooseRecommendation({
    steps: latestSteps,
    stepGoal: today.stepGoal,
    minutesWorked: today.focusMinutes,
    minutesUntilNextEvent: today.minutesUntilNextEvent,
    weather: today.weather,
    workout: {
      planned: true,
      completed: false,
      name: today.workout,
    },
  });
  const homeMiddle = chooseHomeMiddle({
    minutesWorked: today.focusMinutes,
    recommendation,
    remainingItems,
  });

  useEffect(() => {
    let cancelled = false;

    loadAppState().then((stored) => {
      if (!cancelled) {
        setAppState(stored);
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

  const logWorkoutSet = () => {
    setWorkoutSession((session) => completeSet(session, workoutPlan, Date.now()));
  };
  const endWorkout = () => {
    const outcome = createWorkoutOutcome(workoutPlan, workoutSession);

    setAppState((state) => {
      const withWorkout = addWorkoutOutcome(state, outcome);

      return outcome.exercises.reduce(
        (nextState, exercise) =>
          exercise.weightLb === undefined
            ? nextState
            : upsertExerciseWeight(nextState, {
                exerciseId: exercise.exerciseId,
                weightLb: exercise.weightLb,
                updatedAt: outcome.completedAt,
              }),
        withWorkout,
      );
    });
    setWorkoutVisible(false);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      {surface === 'home' ? (
        <View style={styles.homeContent}>
          <View style={styles.homeHeader}>
            <Text style={styles.brand}>stead</Text>
            <Pressable onPress={() => setSurface('calendar')} hitSlop={10}>
              <Text style={styles.metadataText}>
                {today.dateLabel} · {today.dateMeta}
              </Text>
            </Pressable>
          </View>

          <HomeMiddleSurface
            middle={homeMiddle}
            onWorkout={() => setWorkoutVisible(true)}
          />

          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <Text style={styles.indexText}>steps</Text>
              <Text style={styles.monoMeta}>
                {latestSteps > 0 ? `${latestSteps.toLocaleString()} / 10,000` : 'healthkit pending'}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${stepProgress * 100}%` }]} />
            </View>
          </View>
        </View>
      ) : surface === 'calendar' ? (
        <CalendarSurface
          month={calendarMonth}
          onBack={() => setSurface('home')}
          onNextMonth={() => setVisibleMonthDate((date) => addMonths(date, 1))}
          onPreviousMonth={() => setVisibleMonthDate((date) => addMonths(date, -1))}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setSurface('day');
          }}
        />
      ) : (
        <DaySurface
          loggedSets={loggedSets}
          onBack={() => setSurface('home')}
          onWorkout={() => setWorkoutVisible(true)}
          selectedDate={selectedDate}
          selectedOutcome={selectedOutcome}
        />
      )}

      <WorkoutSurface
        session={workoutSession}
        visible={workoutVisible}
        onAddRest={() => setWorkoutSession((session) => addRestTime(session, 30))}
        onClose={endWorkout}
        onLogSet={logWorkoutSet}
        onSkipRest={() => setWorkoutSession((session) => skipRest(session))}
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
    paddingTop: 54,
  },
  calendarContent: {
    flex: 1,
    paddingBottom: 34,
    paddingHorizontal: spacing.screenX,
    paddingTop: 54,
  },
  liveContent: {
    flex: 1,
    paddingBottom: 34,
    paddingHorizontal: spacing.screenX,
    paddingTop: 44,
  },
  homeContent: {
    flex: 1,
    paddingBottom: 34,
    paddingHorizontal: spacing.screenX,
    paddingTop: 18,
  },
  homeHeader: {
    gap: 6,
  },
  brand: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0,
    opacity: opacity.title,
  },
  homeMiddle: {
    flex: 1,
    justifyContent: 'center',
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
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 26,
    marginTop: 32,
    opacity: opacity.enabled,
  },
  nextTitle: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 39,
    marginTop: 28,
    opacity: opacity.title,
  },
  nextStart: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: '600',
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
    alignItems: 'center',
    flexDirection: 'row',
  },
  todayThreeTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: typeScale.title,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 26,
    opacity: opacity.title,
  },
  todayThreeTime: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: typeScale.metadata,
    letterSpacing: 0,
    lineHeight: 19,
    opacity: opacity.metadata,
  },
  dot: {
    color: colors.foreground,
    fontSize: typeScale.action,
    opacity: opacity.metadata,
  },
  progressBlock: {
    gap: 12,
    paddingBottom: 42,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    height: 2,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    height: 2,
  },
  calendarSurface: {
    alignSelf: 'center',
    flex: 1,
    gap: 18,
    justifyContent: 'center',
    width: '100%',
  },
  weekdays: {
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 308,
  },
  weekdayLabel: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: typeScale.index,
    letterSpacing: 0,
    lineHeight: 18,
    opacity: opacity.metadata,
    textAlign: 'center',
    width: 32,
  },
  monthGrid: {
    alignSelf: 'center',
    gap: 14,
    width: 308,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarCell: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
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
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  metrics: {
    flexDirection: 'row',
    gap: 28,
  },
  metric: {
    flex: 1,
    gap: 8,
  },
  metricValue: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 25,
    opacity: opacity.title,
  },
  dayHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleText: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: '600',
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
    alignItems: 'center',
    flexDirection: 'row',
  },
  dayCopy: {
    alignItems: 'baseline',
    flex: 1,
    flexDirection: 'row',
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
    textAlign: 'right',
    width: 52,
  },
  nudgeLine: {
    gap: 4,
    marginTop: 42,
  },
  exerciseSurface: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 120,
  },
  exerciseTitle: {
    color: colors.foreground,
    fontSize: typeScale.title,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 26,
    opacity: opacity.title,
  },
  setList: {
    gap: 16,
    marginTop: 32,
  },
  setRow: {
    alignItems: 'center',
    flexDirection: 'row',
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
    textAlign: 'right',
    width: 52,
  },
  restSurface: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 84,
  },
  restTimer: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: typeScale.countdown,
    fontWeight: '300',
    letterSpacing: 0,
    lineHeight: 68,
    marginTop: 22,
    opacity: opacity.title,
  },
  restTicks: {
    flexDirection: 'row',
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
    alignItems: 'center',
    gap: 6,
    marginTop: 56,
  },
  voiceSurface: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
  },
  listeningRow: {
    alignItems: 'center',
    flexDirection: 'row',
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
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 29,
    marginBottom: 44,
    opacity: opacity.title,
    textAlign: 'center',
  },
  actionText: {
    fontSize: typeScale.action,
    letterSpacing: 0,
    lineHeight: 24,
  },
  bottomActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
