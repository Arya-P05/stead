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
import { colors, opacity, spacing, typography } from './src/designSystem';
import { chooseRecommendation } from './src/domain/recommendations';
import { completeSet, startWorkoutSession } from './src/domain/workoutSession';
import type { WorkoutPlan, WorkoutSession } from './src/domain/workoutSession';
import { getWorkoutStatus } from './src/domain/workoutStatus';

const today = {
  steps: 6420,
  stepGoal: 10000,
  focusMinutes: 154,
  workout: 'upper push',
  minutesUntilNextEvent: 90,
  weather: {
    condition: 'sunny' as const,
    temperatureF: 72,
    precipitationChance: 0.05,
  },
};

const workoutPlan: WorkoutPlan = {
  id: 'upper-push',
  name: 'upper push',
  exercises: [
    {
      id: 'incline-db-press',
      name: 'incline dumbbell press',
      targetSets: 3,
      restSeconds: 90,
    },
    {
      id: 'shoulder-press',
      name: 'shoulder press',
      targetSets: 3,
      restSeconds: 90,
    },
    {
      id: 'cable-fly',
      name: 'cable fly',
      targetSets: 3,
      restSeconds: 60,
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
        toValue: -3,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => setFeedback('idle'), 520);
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
            opacity: disabled ? opacity.unavailable : opacity.secondary,
            transform: [{ translateY }],
          },
        ]}
      >
        {children}
      </Animated.Text>
    </Pressable>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.indexLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metadata}>{detail}</Text>
    </View>
  );
}

function WorkoutSheet({
  session,
  visible,
  onClose,
  onLogSet,
}: {
  session: WorkoutSession;
  visible: boolean;
  onClose: () => void;
  onLogSet: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const status = getWorkoutStatus(workoutPlan, session, now);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, [visible]);

  return (
    <Modal animationType="slide" visible={visible} presentationStyle="pageSheet">
      <SafeAreaView style={styles.sheet}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>{status.title}</Text>
          <Text style={styles.sheetMeta}>{status.meta}</Text>

          <View style={styles.exerciseList}>
            {workoutPlan.exercises.map((exercise, index) => {
              const completedSets = session.sets.filter(
                (set) => set.exerciseId === exercise.id,
              ).length;

              return (
                <View key={exercise.id} style={styles.exerciseRow}>
                  <Text style={styles.indexLabel}>{String(index + 1).padStart(2, '0')}</Text>
                  <View style={styles.exerciseCopy}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.metadata}>
                      {completedSets}/{exercise.targetSets} sets · rest {exercise.restSeconds}s
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.sheetActions}>
            <ActionText onPress={status.isComplete ? onClose : onLogSet}>{status.action}</ActionText>
            <Text style={styles.dot}>·</Text>
            <ActionText onPress={onClose}>done</ActionText>
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
  const stepProgress = Math.min(today.steps / today.stepGoal, 1);
  const logWorkoutSet = () => {
    setWorkoutSession((session) => completeSet(session, workoutPlan, Date.now()));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>stead</Text>
          <Text style={styles.metadata}>day 01 · lock in</Text>
        </View>

        <View style={styles.recommendation}>
          <Text style={styles.indexLabel}>next</Text>
          <Text style={styles.nextAction}>{recommendation.action}</Text>
          <Text style={styles.supporting}>{recommendation.reason}</Text>
        </View>

        <View style={styles.actions}>
          <ActionText onPress={() => undefined}>walk logged</ActionText>
          <Text style={styles.dot}>·</Text>
          <ActionText onPress={() => setWorkoutVisible(true)}>workout</ActionText>
          <Text style={styles.dot}>·</Text>
          <ActionText disabled onPress={() => undefined}>
            voice soon
          </ActionText>
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <Text style={styles.indexLabel}>steps</Text>
            <Text style={styles.metadata}>{today.steps.toLocaleString()} / 10,000</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${stepProgress * 100}%` }]} />
          </View>
        </View>

        <View style={styles.metrics}>
          <Metric label="focus" value="2h 34m" detail="deep work today" />
          <Metric label="body" value={today.workout} detail="planned session" />
        </View>
      </View>

      <WorkoutSheet
        session={workoutSession}
        visible={workoutVisible}
        onClose={() => setWorkoutVisible(false)}
        onLogSet={logWorkoutSet}
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
    paddingHorizontal: spacing.screenX,
    paddingTop: 18,
    paddingBottom: 34,
  },
  header: {
    gap: 6,
  },
  brand: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0,
    opacity: opacity.primary,
  },
  recommendation: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  indexLabel: {
    color: colors.foreground,
    fontFamily: typography.mono,
    fontSize: 12,
    letterSpacing: 0,
    opacity: opacity.muted,
  },
  nextAction: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 39,
    opacity: opacity.primary,
  },
  supporting: {
    color: colors.foreground,
    fontSize: 17,
    letterSpacing: 0,
    lineHeight: 24,
    opacity: opacity.secondary,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 44,
  },
  actionText: {
    fontSize: 16,
    letterSpacing: 0,
    lineHeight: 24,
  },
  dot: {
    color: colors.foreground,
    fontSize: 16,
    opacity: opacity.muted,
  },
  progressBlock: {
    gap: 12,
    paddingBottom: 34,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    height: 3,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 999,
    height: 3,
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
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 25,
    opacity: opacity.primary,
  },
  metadata: {
    color: colors.foreground,
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 18,
    opacity: opacity.muted,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sheetContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.sheetX,
  },
  sheetTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 26,
    opacity: opacity.primary,
    textAlign: 'center',
  },
  sheetMeta: {
    color: colors.foreground,
    fontSize: 14,
    letterSpacing: 0,
    lineHeight: 20,
    marginTop: 8,
    opacity: opacity.muted,
    textAlign: 'center',
  },
  exerciseList: {
    gap: 24,
    marginTop: 52,
  },
  exerciseRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 18,
  },
  exerciseCopy: {
    flex: 1,
    gap: 6,
  },
  exerciseName: {
    color: colors.foreground,
    fontSize: 17,
    letterSpacing: 0,
    lineHeight: 23,
    opacity: opacity.primary,
  },
  sheetActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 54,
  },
});
