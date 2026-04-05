import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

const COLORS = {
  primary: Colors.primary,
  background: Colors.background,
  text: Colors.text,
  border: Colors.ocean.tideBorder,
  pressedOverlay: 'rgba(74, 144, 217, 0.08)',
} as const;

/** 좌우 슬롯 동일 너비 → 가운데 타이틀이 화면 기준으로 정확히 중앙 정렬 */
const SIDE_SLOT_WIDTH = 56;
const BAR_MIN_HEIGHT = 44;
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export type HeaderProps = {
  title: string;
  leftIcon?: React.ReactNode;
  onPressLeft?: () => void;
  rightIcon?: React.ReactNode;
  onPressRight?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

function HeaderSlot({
  align,
  children,
  interactive,
  onPress,
  testID,
  accessibilityLabel,
}: {
  align: 'flex-start' | 'flex-end';
  children: React.ReactNode;
  interactive: boolean;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const content = (
    <View style={[styles.slotInner, { alignItems: align }]}>{children}</View>
  );

  if (!interactive) {
    return (
      <View
        style={[styles.sideSlot, { justifyContent: 'center' }]}
        pointerEvents="box-none"
      >
        {content}
      </View>
    );
  }

  return (
    <View style={[styles.sideSlot, { justifyContent: 'center' }]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={HIT_SLOP}
        onPress={onPress}
        style={({ pressed }) => [
          styles.hitTarget,
          pressed && styles.hitTargetPressed,
        ]}
      >
        {content}
      </Pressable>
    </View>
  );
}

export function Header({
  title,
  leftIcon,
  onPressLeft,
  rightIcon,
  onPressRight,
  style,
  testID,
  accessibilityLabel,
}: HeaderProps) {
  const insets = useSafeAreaInsets();

  const hasLeft = Boolean(leftIcon);
  const hasRight = Boolean(rightIcon);
  const leftInteractive = hasLeft && Boolean(onPressLeft);
  const rightInteractive = hasRight && Boolean(onPressRight);

  return (
    <View
      testID={testID}
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[styles.root, style]}
    >
      <View
        style={[
          styles.bar,
          {
            paddingTop: insets.top,
            minHeight: BAR_MIN_HEIGHT + insets.top,
          },
        ]}
      >
        <HeaderSlot
          align="flex-start"
          interactive={leftInteractive}
          onPress={onPressLeft}
          testID={testID ? `${testID}-left` : undefined}
          accessibilityLabel={onPressLeft ? '뒤로' : undefined}
        >
          {hasLeft ? (
            leftIcon
          ) : (
            <View style={styles.iconPlaceholder} accessibilityElementsHidden />
          )}
        </HeaderSlot>

        <View style={styles.titleRegion} pointerEvents="none">
          <Text
            style={styles.title}
            numberOfLines={1}
            ellipsizeMode="tail"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {title}
          </Text>
        </View>

        <HeaderSlot
          align="flex-end"
          interactive={rightInteractive}
          onPress={onPressRight}
          testID={testID ? `${testID}-right` : undefined}
        >
          {hasRight ? (
            rightIcon
          ) : (
            <View style={styles.iconPlaceholder} accessibilityElementsHidden />
          )}
        </HeaderSlot>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  sideSlot: {
    width: SIDE_SLOT_WIDTH,
  },
  slotInner: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  hitTarget: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 12,
  },
  hitTargetPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
    backgroundColor: COLORS.pressedOverlay,
  },
  iconPlaceholder: {
    width: 24,
    height: 24,
  },
  titleRegion: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: -0.3,
    textAlign: 'center',
    width: '100%',
  },
});
