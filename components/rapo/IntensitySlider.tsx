import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityActionEvent,
  LayoutChangeEvent,
  PanResponder,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Colors } from '../../constants/colors';

const THUMB_SIZE = 32;
const TRACK_HEIGHT = 8;
const HIT_HEIGHT = 44;
const STEPS = 10;

export type IntensitySliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
  /** 상단 라벨 (기본: 통증 강도) */
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

function clampStep(v: number): number {
  const n = Math.round(v);
  return Math.min(STEPS, Math.max(0, n));
}

function heatTint(step: number): string {
  if (step <= 0) return Colors.heatmap.none;
  if (step <= 3) return Colors.heatmap.low;
  if (step <= 6) return Colors.heatmap.mid;
  if (step <= 8) return Colors.heatmap.high;
  return Colors.heatmap.severe;
}

export function IntensitySlider({
  value,
  onValueChange,
  disabled = false,
  label = '통증 강도',
  style,
  testID,
  accessibilityLabel,
}: IntensitySliderProps) {
  const [trackW, setTrackW] = useState(0);
  const lastEmitted = useRef(clampStep(value));

  const step = clampStep(value);

  const syncEmit = useCallback(
    (next: number) => {
      const c = clampStep(next);
      if (c !== lastEmitted.current) {
        lastEmitted.current = c;
        onValueChange(c);
      }
    },
    [onValueChange],
  );

  useEffect(() => {
    lastEmitted.current = clampStep(value);
  }, [value]);

  const xToStep = useCallback(
    (x: number) => {
      if (trackW <= 0) return lastEmitted.current;
      const ratio = Math.min(1, Math.max(0, x / trackW));
      return Math.round(ratio * STEPS);
    },
    [trackW],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (e) => {
          syncEmit(xToStep(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e) => {
          syncEmit(xToStep(e.nativeEvent.locationX));
        },
      }),
    [disabled, syncEmit, xToStep],
  );

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackW(e.nativeEvent.layout.width);
  }, []);

  const thumbLeft =
    trackW > 0 ? (step / STEPS) * Math.max(0, trackW - THUMB_SIZE) : 0;

  /** 트랙 채움은 썸 중심까지 맞춤 */
  const fillW =
    trackW > 0 ? Math.min(trackW, thumbLeft + THUMB_SIZE / 2) : 0;

  const onA11yAction = useCallback(
    (e: AccessibilityActionEvent) => {
      if (disabled) return;
      if (e.nativeEvent.actionName === 'increment') {
        syncEmit(step + 1);
      } else if (e.nativeEvent.actionName === 'decrement') {
        syncEmit(step - 1);
      }
    },
    [disabled, step, syncEmit],
  );

  const a11yLabel =
    accessibilityLabel ?? `${label}, 현재 ${step}단계, 0에서 10 사이`;

  return (
    <View
      testID={testID}
      style={[styles.root, disabled && styles.disabled, style]}
      accessibilityRole="adjustable"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled }}
      accessibilityValue={{ min: 0, max: STEPS, now: step, text: `${step}` }}
      accessibilityActions={[
        { name: 'increment', label: '한 단계 올리기' },
        { name: 'decrement', label: '한 단계 내리기' },
      ]}
      onAccessibilityAction={onA11yAction}
    >
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.badge, { borderColor: heatTint(step) }]}>
          <Text style={[styles.badgeText, { color: heatTint(step) }]}>
            {step}
          </Text>
        </View>
      </View>

      <Text style={styles.hint}>0 · 없음 ～ 10 · 매우 심함</Text>

      <View
        style={styles.trackHit}
        onLayout={onTrackLayout}
        {...panResponder.panHandlers}
      >
        <View style={styles.trackBg} pointerEvents="none" />
        <View
          pointerEvents="none"
          style={[
            styles.trackFill,
            {
              width: fillW,
              backgroundColor: step > 0 ? heatTint(step) : 'transparent',
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: thumbLeft,
              borderColor: Colors.primary,
              backgroundColor: Colors.white,
            },
          ]}
        />
      </View>

      <View style={styles.scaleRow} pointerEvents="none">
        <Text style={styles.scaleText}>0</Text>
        <Text style={styles.scaleText}>5</Text>
        <Text style={styles.scaleText}>10</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  badge: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  hint: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textLight,
    marginBottom: 10,
  },
  trackHit: {
    height: HIT_HEIGHT,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBg: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Colors.ocean.heroWashDeep,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: (HIT_HEIGHT - TRACK_HEIGHT) / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    top: (HIT_HEIGHT - THUMB_SIZE) / 2,
    borderWidth: 2,
    shadowColor: Colors.accent,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  scaleText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
});
