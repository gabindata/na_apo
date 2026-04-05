import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

const COLORS = {
  primary: '#4A90D9',
  background: '#F0F8FF',
  textOnPrimary: '#FFFFFF',
  disabledBg: '#BFD7EF',
  disabledText: '#F0F8FF',
  pressedOverlay: 'rgba(255, 255, 255, 0.14)',
} as const;

export function Button({
  label,
  onPress,
  disabled = false,
  style,
  textStyle,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        disabled ? styles.disabled : styles.enabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.textBase,
          disabled ? styles.textDisabled : styles.textEnabled,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
  },
  enabled: {
    backgroundColor: COLORS.primary,
  },
  disabled: {
    backgroundColor: COLORS.disabledBg,
  },
  pressed: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    transform: [{ scale: 0.99 }],
  },
  textBase: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  textEnabled: {
    color: COLORS.textOnPrimary,
  },
  textDisabled: {
    color: COLORS.disabledText,
    opacity: 0.95,
  },
});

