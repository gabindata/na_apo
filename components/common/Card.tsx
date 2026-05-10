import { ReactNode, useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

export type CardVariant = 'default' | 'outlined' | 'elevated';
export type CardPadding = number | 'sm' | 'md' | 'lg';

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  padding?: CardPadding;
  onPress?: () => void;
  disabled?: boolean;
  variant?: CardVariant;
  testID?: string;
  accessibilityLabel?: string;
};

const COLORS = {
  surface: 'rgba(236,248,255,0.92)',
  outline: 'rgba(74, 144, 217, 0.18)',
  shadow: '#0B1E3A',
  pressedOverlay: 'rgba(74, 144, 217, 0.08)',
  disabledOverlay: 'rgba(26, 46, 74, 0.06)',
} as const;

const RADIUS = 20;

const PADDING_PRESETS: Record<Exclude<CardPadding, number>, number> = {
  sm: 12,
  md: 16,
  lg: 20,
};

function resolvePadding(padding: CardPadding | undefined) {
  if (typeof padding === 'number') return padding;
  if (!padding) return PADDING_PRESETS.md;
  return PADDING_PRESETS[padding];
}

export function Card({
  children,
  style,
  contentStyle,
  padding = 'md',
  onPress,
  disabled = false,
  variant = 'default',
  testID,
  accessibilityLabel,
}: CardProps) {
  const resolvedPadding = useMemo(() => resolvePadding(padding), [padding]);

  const baseContainerStyle = useMemo(
    () => [
      styles.base,
      stylesByVariant[variant],
      disabled && styles.disabled,
      style,
    ],
    [variant, disabled, style],
  );

  const innerStyle = useMemo(
    () =>
      [
        { padding: resolvedPadding },
        contentStyle,
      ] as unknown as StyleProp<ViewStyle>,
    [resolvedPadding, contentStyle],
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          baseContainerStyle,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <View style={innerStyle}>{children}</View>
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={baseContainerStyle}
    >
      <View style={innerStyle}>{children}</View>
    </View>
  );
}

const stylesByVariant = StyleSheet.create({
  default: {
    backgroundColor: COLORS.surface,
  },
  outlined: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  elevated: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.80)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.shadow,
        shadowOpacity: 0.09,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
});

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    backgroundColor: COLORS.pressedOverlay,
  },
  disabled: {
    opacity: 0.7,
    backgroundColor: COLORS.disabledOverlay,
  },
});

