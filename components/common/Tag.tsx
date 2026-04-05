import { ReactNode, useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

type TagVariant = 'filled' | 'outlined';
type TagSize = 'sm' | 'md';

type TagProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: TagVariant;
  size?: TagSize;
  testID?: string;
  accessibilityLabel?: string;
  // 확장용: 아이콘 등 추가 컨텐츠
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const COLORS = {
  primary: '#4A90D9',
  primarySoft: '#E4F1FF',
  primaryOutline: 'rgba(74, 144, 217, 0.6)',
  textStrong: '#1A2E4A',
  textSoft: '#6480A8',
  disabledBg: '#E4E9F2',
  disabledBorder: '#C5D0E0',
  disabledText: '#A0AFC5',
  pressedOverlay: 'rgba(0, 0, 0, 0.03)',
} as const;

const SIZE_PRESETS: Record<TagSize, { paddingHorizontal: number; paddingVertical: number; fontSize: number }> = {
  sm: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 13,
  },
  md: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    fontSize: 15,
  },
};

export function Tag({
  label,
  selected,
  onPress,
  disabled = false,
  style,
  textStyle,
  variant = 'filled',
  size = 'md',
  testID,
  accessibilityLabel,
  leftIcon,
  rightIcon,
}: TagProps) {
  const sizeStyle = useMemo(() => SIZE_PRESETS[size], [size]);

  const baseContainerStyle = useMemo(
    () => [
      styles.base,
      sizeStyle,
      getVariantStyle(variant, selected),
      disabled && styles.disabled,
      style,
    ],
    [sizeStyle, variant, selected, disabled, style],
  );

  const textVariantStyle = useMemo(
    () => getTextStyle(variant, selected),
    [variant, selected],
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected }}
      style={({ pressed }) => [
        baseContainerStyle,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={styles.contentRow}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <Text style={[styles.textBase, textVariantStyle, disabled && styles.textDisabled, textStyle]}>
          {label}
        </Text>
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
    </Pressable>
  );
}

function getVariantStyle(variant: TagVariant, selected: boolean): ViewStyle {
  if (variant === 'outlined') {
    if (selected) {
      return {
        backgroundColor: COLORS.primarySoft,
        borderWidth: 1,
        borderColor: COLORS.primary,
      };
    }
    return {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: COLORS.primaryOutline,
    };
  }

  // filled
  if (selected) {
    return {
      backgroundColor: COLORS.primary,
    };
  }

  return {
    backgroundColor: COLORS.primarySoft,
  };
}

function getTextStyle(variant: TagVariant, selected: boolean): TextStyle {
  if (variant === 'outlined') {
    if (selected) {
      return {
        color: COLORS.textStrong,
        fontWeight: '600',
      };
    }
    return {
      color: COLORS.textSoft,
      fontWeight: '500',
    };
  }

  // filled
  if (selected) {
    return {
      color: '#FFFFFF',
      fontWeight: '600',
    };
  }

  return {
    color: COLORS.textStrong,
    fontWeight: '500',
  };
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textBase: {
    letterSpacing: -0.1,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    backgroundColor: COLORS.disabledBg,
    borderColor: COLORS.disabledBorder,
  },
  textDisabled: {
    color: COLORS.disabledText,
  },
  iconLeft: {
    marginRight: 4,
  },
  iconRight: {
    marginLeft: 4,
  },
});

