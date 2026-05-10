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
import {
  addRestTime,
  completeSet,
  getActiveExercise,
  getRestRemainingSeconds,
  skipRest,
  startWorkoutSession,
} from './src/domain/workoutSession';
import type { WorkoutPlan, WorkoutSession } from './src/domain/workoutSession';

const today = {
  dateLabel: 'tuesday',
  dateMeta: 'march 4',
  steps: 6420,
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

const recommendation = chooseRecommendation({
  steps: today.steps,
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

type FeedbackState = 'idle' | 'success' | 'warning';
type WorkoutMode = 'exercise' | 'voice';

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
  const [workoutVisible, setWorkoutVisible] = useState(false);
  const [workoutSession, setWorkoutSession] = useState(() =>
    startWorkoutSession(workoutPlan, Date.now()),
  );
  const loggedSets = workoutSession.sets.length;

  const logWorkoutSet = () => {
    setWorkoutSession((session) => completeSet(session, workoutPlan, Date.now()));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <View style={styles.dayHeader}>
          <View>
            <Text style={styles.titleText}>{today.dateLabel}</Text>
            <Text style={styles.metadataText}>{today.dateMeta}</Text>
          </View>
          <Text style={styles.monoMeta}>
            {loggedSets > 0 ? `${loggedSets} / 17` : '5 / 7'}
          </Text>
        </View>

        <View style={styles.dayList}>
          {dayItems.map((item, index) => (
            <DayRow
              key={`${item.title}-${index}`}
              index={index}
              item={item}
              onWorkout={() => setWorkoutVisible(true)}
            />
          ))}
        </View>

        <View style={styles.nudgeLine}>
          <Text style={styles.metadataText}>{recommendation.action}</Text>
          <Text style={styles.monoMeta}>{recommendation.reason}</Text>
        </View>

        <View style={styles.bottomActions}>
          <ActionText onPress={() => undefined}>add</ActionText>
          <ActionText onPress={() => undefined}>plan tomorrow</ActionText>
        </View>
      </View>

      <WorkoutSurface
        session={workoutSession}
        visible={workoutVisible}
        onAddRest={() => setWorkoutSession((session) => addRestTime(session, 30))}
        onClose={() => setWorkoutVisible(false)}
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
  liveContent: {
    flex: 1,
    paddingBottom: 34,
    paddingHorizontal: spacing.screenX,
    paddingTop: 44,
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
