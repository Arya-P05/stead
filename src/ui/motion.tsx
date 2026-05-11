import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export const motionSpring = { damping: 18, stiffness: 320, mass: 0.35 };
export const motionSpringSoft = { damping: 20, stiffness: 260, mass: 0.45 };
export const easeOut = Easing.out(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.cubic);

type PressableScaleProps = Omit<PressableProps, "children"> & {
  children: ReactNode;
  scaleTo?: number;
  /** Use fill for fixed-size targets (calendar cells, icon boxes). */
  layout?: "default" | "fill";
  style?: StyleProp<ViewStyle>;
};

export function PressableScale({
  children,
  scaleTo = 0.97,
  layout = "default",
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const innerBase =
    layout === "fill"
      ? {
          flex: 1,
          alignItems: "center" as const,
          justifyContent: "center" as const,
        }
      : {};

  const outerStyle = layout === "fill" ? style : undefined;
  const innerStyle = layout === "fill" ? innerBase : style;

  return (
    <Pressable
      {...rest}
      style={outerStyle}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, motionSpring);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, motionSpringSoft);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[innerStyle, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

type AnimatedProgressFillProps = {
  progress: number;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedProgressFill({
  progress,
  style,
}: AnimatedProgressFillProps) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(Math.max(progress, 0), 1), {
      duration: 900,
      easing: easeOut,
    });
  }, [progress, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return <Animated.View style={[style, animatedStyle]} />;
}

export function PulsingDot({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: easeInOut }),
        withTiming(0.38, { duration: 700, easing: easeInOut }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 0.88 + opacity.value * 0.14 }],
  }));

  return <Animated.View style={[style, animatedStyle]} />;
}
