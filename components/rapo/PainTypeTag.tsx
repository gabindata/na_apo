import React, { useMemo, useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Tag } from '../common/Tag';
import { Colors } from '../../constants/colors';

export const PAIN_TYPE_OPTIONS = [
  '욱신거림',
  '찌르는 듯',
  '쑤시는 통증',
  '저림',
  '뻐근함',
] as const;

export type PainTypeOption = (typeof PAIN_TYPE_OPTIONS)[number];

export type PainTypeTagProps = {
  /** 선택된 통증 유형들 (제어형) */
  value?: PainTypeOption[];
  /** 선택 변경 콜백 (제어형) */
  onChange?: (next: PainTypeOption[]) => void;
  /** 비제어형 초기값 */
  defaultValue?: PainTypeOption[];
  disabled?: boolean;
  /** 상단 라벨 표시 여부 (기본: true) */
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

function uniq(list: PainTypeOption[]) {
  return Array.from(new Set(list));
}

export function PainTypeTag({
  value,
  onChange,
  defaultValue = [],
  disabled = false,
  showLabel = true,
  style,
  testID,
  accessibilityLabel,
}: PainTypeTagProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<PainTypeOption[]>(() => uniq(defaultValue));

  const selected = useMemo(() => uniq((isControlled ? value : internal) ?? []), [isControlled, value, internal]);

  const emit = (next: PainTypeOption[]) => {
    const cleaned = uniq(next);
    if (!isControlled) setInternal(cleaned);
    onChange?.(cleaned);
  };

  const toggle = (label: PainTypeOption) => {
    if (disabled) return;
    const next = selected.includes(label)
      ? selected.filter((x) => x !== label)
      : [...selected, label];
    emit(next);
  };

  const a11y =
    accessibilityLabel ??
    `통증 유형 선택, 현재 ${selected.length}개 선택됨`;

  return (
    <View testID={testID} accessibilityRole="summary" accessibilityLabel={a11y} style={[styles.root, style]}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>통증 유형</Text>
          <Text style={styles.count}>{selected.length}개 선택</Text>
        </View>
      )}

      <View style={styles.wrap}>
        {PAIN_TYPE_OPTIONS.map((label) => {
          const isSelected = selected.includes(label);
          return (
            <View key={label} style={styles.item}>
              <Tag
                label={label}
                selected={isSelected}
                onPress={() => toggle(label)}
                disabled={disabled}
                variant={isSelected ? 'filled' : 'outlined'}
                size="md"
                testID={testID ? `${testID}-${label}` : undefined}
                accessibilityLabel={`통증 유형 ${label}${isSelected ? ', 선택됨' : ''}`}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  item: {
    marginRight: 8,
    marginBottom: 8,
  },
});

