import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const easeIn = Easing.in(Easing.cubic);
const easeOut = Easing.out(Easing.cubic);

export type CrossfadeOptions = {
  fadeOutMs?: number;
  fadeInMs?: number;
};

/**
 * Fades opacity out, commits the latest `activeKey` to `displayKey`, then fades in.
 * Avoids overlapping enter/exit layout animations on the same slot.
 * Fade-in runs in a separate effect after React commits (no rAF + shared value race).
 */
export function useSequentialCrossfade(activeKey: string, options: CrossfadeOptions = {}) {
  const fadeOutMs = options.fadeOutMs ?? 260;
  const fadeInMs = options.fadeInMs ?? 400;
  const opacity = useSharedValue(1);
  const [displayKey, setDisplayKey] = useState(activeKey);
  const [fadeInToken, setFadeInToken] = useState(0);
  const latestKeyRef = useRef(activeKey);
  latestKeyRef.current = activeKey;

  const commitLatestKey = useCallback(() => {
    setDisplayKey(latestKeyRef.current);
    setFadeInToken((t) => t + 1);
  }, []);

  useEffect(() => {
    if (fadeInToken === 0) {
      return;
    }
    opacity.value = withTiming(1, { duration: fadeInMs, easing: easeOut });
  }, [fadeInToken, fadeInMs, opacity]);

  useEffect(() => {
    if (activeKey === displayKey) {
      return;
    }

    cancelAnimation(opacity);
    opacity.value = withTiming(0, { duration: fadeOutMs, easing: easeIn }, (finished) => {
      if (!finished) {
        return;
      }
      runOnJS(commitLatestKey)();
    });
  }, [activeKey, commitLatestKey, displayKey, fadeOutMs, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return { displayKey, animatedStyle } as const;
}
