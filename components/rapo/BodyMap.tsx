import React, { useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { Colors } from '../../constants/colors';

export type BodyPartId = string;

export type BodyMapProps = {
  /** 선택된 신체 부위 ID 목록 (제어형) */
  value?: BodyPartId[];
  /** 선택 변경 콜백 */
  onChange?: (parts: BodyPartId[]) => void;
  /** 비제어형 초기값 */
  defaultValue?: BodyPartId[];
  disabled?: boolean;
  /** 상단 라벨 및 선택 목록 표시 여부 (기본: true) */
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type ViewSide = 'front' | 'back';

type EllipseRegion = {
  id: BodyPartId;
  labelKo: string;
  shape: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

type PathRegion = {
  id: BodyPartId;
  labelKo: string;
  shape: 'path';
  d: string;
};

type RegionDef = EllipseRegion | PathRegion;

// ─── 전면 신체 부위 정의 (viewBox "0 0 200 490") ───────────────────────────
const FRONT_REGIONS: RegionDef[] = [
  // 머리
  { id: 'head', labelKo: '머리', shape: 'ellipse', cx: 100, cy: 38, rx: 27, ry: 32 },
  // 목
  { id: 'neck', labelKo: '목', shape: 'path', d: 'M 88 68 L 84 92 L 116 92 L 112 68 Z' },
  // 왼쪽 어깨 (보는 사람 기준 왼쪽 = 신체 오른쪽)
  {
    id: 'left_shoulder',
    labelKo: '왼쪽 어깨',
    shape: 'path',
    d: 'M 84 91 C 70 95 52 98 42 110 C 35 118 34 130 38 138 L 54 138 L 60 112 L 84 100 Z',
  },
  // 오른쪽 어깨
  {
    id: 'right_shoulder',
    labelKo: '오른쪽 어깨',
    shape: 'path',
    d: 'M 116 91 C 130 95 148 98 158 110 C 165 118 166 130 162 138 L 146 138 L 140 112 L 116 100 Z',
  },
  // 왼쪽 가슴 (흉부 좌)
  {
    id: 'left_chest',
    labelKo: '왼쪽 가슴',
    shape: 'path',
    d: 'M 55 135 L 58 112 L 84 100 L 100 105 L 100 168 L 58 168 Z',
  },
  // 오른쪽 가슴 (흉부 우)
  {
    id: 'right_chest',
    labelKo: '오른쪽 가슴',
    shape: 'path',
    d: 'M 100 105 L 116 100 L 142 112 L 145 135 L 142 168 L 100 168 Z',
  },
  // 복부
  {
    id: 'abdomen',
    labelKo: '복부',
    shape: 'path',
    d: 'M 58 168 L 142 168 L 140 228 L 60 228 Z',
  },
  // 왼쪽 골반
  {
    id: 'left_hip',
    labelKo: '왼쪽 골반',
    shape: 'path',
    d: 'M 60 228 L 100 230 L 98 275 L 52 272 L 52 248 Z',
  },
  // 오른쪽 골반
  {
    id: 'right_hip',
    labelKo: '오른쪽 골반',
    shape: 'path',
    d: 'M 100 230 L 140 228 L 148 248 L 148 272 L 102 275 Z',
  },
  // 왼쪽 상완 (위팔)
  {
    id: 'left_upper_arm',
    labelKo: '왼쪽 상완',
    shape: 'path',
    d: 'M 38 136 C 32 145 28 168 26 188 L 48 188 L 52 138 Z',
  },
  // 오른쪽 상완
  {
    id: 'right_upper_arm',
    labelKo: '오른쪽 상완',
    shape: 'path',
    d: 'M 162 136 C 168 145 172 168 174 188 L 152 188 L 148 138 Z',
  },
  // 왼쪽 전완 (아래팔)
  {
    id: 'left_forearm',
    labelKo: '왼쪽 전완',
    shape: 'path',
    d: 'M 26 188 C 22 210 18 240 20 262 L 44 260 L 48 188 Z',
  },
  // 오른쪽 전완
  {
    id: 'right_forearm',
    labelKo: '오른쪽 전완',
    shape: 'path',
    d: 'M 174 188 C 178 210 182 240 180 262 L 156 260 L 152 188 Z',
  },
  // 왼쪽 손 (손바닥)
  { id: 'left_hand', labelKo: '왼쪽 손', shape: 'ellipse', cx: 30, cy: 282, rx: 14, ry: 22 },
  // 오른쪽 손 (손바닥)
  { id: 'right_hand', labelKo: '오른쪽 손', shape: 'ellipse', cx: 170, cy: 282, rx: 14, ry: 22 },
  // 왼쪽 허벅지
  {
    id: 'left_thigh',
    labelKo: '왼쪽 허벅지',
    shape: 'path',
    d: 'M 52 272 L 98 275 L 96 370 L 52 368 Z',
  },
  // 오른쪽 허벅지
  {
    id: 'right_thigh',
    labelKo: '오른쪽 허벅지',
    shape: 'path',
    d: 'M 102 275 L 148 272 L 148 368 L 104 370 Z',
  },
  // 왼쪽 무릎
  { id: 'left_knee', labelKo: '왼쪽 무릎', shape: 'ellipse', cx: 74, cy: 382, rx: 22, ry: 14 },
  // 오른쪽 무릎
  { id: 'right_knee', labelKo: '오른쪽 무릎', shape: 'ellipse', cx: 126, cy: 382, rx: 22, ry: 14 },
  // 왼쪽 정강이
  {
    id: 'left_shin',
    labelKo: '왼쪽 정강이',
    shape: 'path',
    d: 'M 54 394 L 94 394 L 92 458 L 56 456 Z',
  },
  // 오른쪽 정강이
  {
    id: 'right_shin',
    labelKo: '오른쪽 정강이',
    shape: 'path',
    d: 'M 106 394 L 146 394 L 144 456 L 108 458 Z',
  },
  // 왼쪽 발 (발등/발목)
  {
    id: 'left_foot',
    labelKo: '왼쪽 발',
    shape: 'path',
    d: 'M 48 454 L 94 458 L 88 480 L 40 476 Z',
  },
  // 오른쪽 발
  {
    id: 'right_foot',
    labelKo: '오른쪽 발',
    shape: 'path',
    d: 'M 106 458 L 152 454 L 160 476 L 112 480 Z',
  },
];

// ─── 후면 신체 부위 정의 ──────────────────────────────────────────────────
const BACK_REGIONS: RegionDef[] = [
  { id: 'head_back', labelKo: '머리 뒤', shape: 'ellipse', cx: 100, cy: 38, rx: 27, ry: 32 },
  { id: 'neck_back', labelKo: '목 뒤', shape: 'path', d: 'M 88 68 L 84 92 L 116 92 L 112 68 Z' },
  {
    id: 'left_shoulder_back',
    labelKo: '왼쪽 어깨 뒤',
    shape: 'path',
    d: 'M 84 91 C 70 95 52 98 42 110 C 35 118 34 130 38 138 L 54 138 L 60 112 L 84 100 Z',
  },
  {
    id: 'right_shoulder_back',
    labelKo: '오른쪽 어깨 뒤',
    shape: 'path',
    d: 'M 116 91 C 130 95 148 98 158 110 C 165 118 166 130 162 138 L 146 138 L 140 112 L 116 100 Z',
  },
  // 등 위 (승모근·견갑골 영역)
  {
    id: 'upper_back',
    labelKo: '등 위',
    shape: 'path',
    d: 'M 58 100 L 142 100 L 142 188 L 58 188 Z',
  },
  // 허리 (요추)
  {
    id: 'lower_back',
    labelKo: '허리',
    shape: 'path',
    d: 'M 60 188 L 140 188 L 138 232 L 62 232 Z',
  },
  // 왼쪽 엉덩이
  {
    id: 'left_gluteal',
    labelKo: '왼쪽 엉덩이',
    shape: 'path',
    d: 'M 62 232 L 100 234 L 98 278 L 52 274 L 52 252 Z',
  },
  // 오른쪽 엉덩이
  {
    id: 'right_gluteal',
    labelKo: '오른쪽 엉덩이',
    shape: 'path',
    d: 'M 100 234 L 138 232 L 148 252 L 148 274 L 102 278 Z',
  },
  {
    id: 'left_upper_arm_back',
    labelKo: '왼쪽 상완 뒤',
    shape: 'path',
    d: 'M 38 136 C 32 145 28 168 26 188 L 48 188 L 52 138 Z',
  },
  {
    id: 'right_upper_arm_back',
    labelKo: '오른쪽 상완 뒤',
    shape: 'path',
    d: 'M 162 136 C 168 145 172 168 174 188 L 152 188 L 148 138 Z',
  },
  {
    id: 'left_forearm_back',
    labelKo: '왼쪽 전완 뒤',
    shape: 'path',
    d: 'M 26 188 C 22 210 18 240 20 262 L 44 260 L 48 188 Z',
  },
  {
    id: 'right_forearm_back',
    labelKo: '오른쪽 전완 뒤',
    shape: 'path',
    d: 'M 174 188 C 178 210 182 240 180 262 L 156 260 L 152 188 Z',
  },
  {
    id: 'left_hand_back',
    labelKo: '왼쪽 손등',
    shape: 'ellipse',
    cx: 30,
    cy: 282,
    rx: 14,
    ry: 22,
  },
  {
    id: 'right_hand_back',
    labelKo: '오른쪽 손등',
    shape: 'ellipse',
    cx: 170,
    cy: 282,
    rx: 14,
    ry: 22,
  },
  {
    id: 'left_thigh_back',
    labelKo: '왼쪽 허벅지 뒤',
    shape: 'path',
    d: 'M 52 274 L 98 278 L 96 370 L 52 368 Z',
  },
  {
    id: 'right_thigh_back',
    labelKo: '오른쪽 허벅지 뒤',
    shape: 'path',
    d: 'M 102 278 L 148 274 L 148 368 L 104 370 Z',
  },
  // 오금 (슬와부)
  {
    id: 'left_knee_back',
    labelKo: '왼쪽 오금',
    shape: 'ellipse',
    cx: 74,
    cy: 382,
    rx: 22,
    ry: 14,
  },
  {
    id: 'right_knee_back',
    labelKo: '오른쪽 오금',
    shape: 'ellipse',
    cx: 126,
    cy: 382,
    rx: 22,
    ry: 14,
  },
  // 종아리
  {
    id: 'left_calf',
    labelKo: '왼쪽 종아리',
    shape: 'path',
    d: 'M 54 394 L 94 394 L 92 458 L 56 456 Z',
  },
  {
    id: 'right_calf',
    labelKo: '오른쪽 종아리',
    shape: 'path',
    d: 'M 106 394 L 146 394 L 144 456 L 108 458 Z',
  },
  // 발뒤꿈치
  {
    id: 'left_heel',
    labelKo: '왼쪽 발뒤꿈치',
    shape: 'path',
    d: 'M 48 454 L 94 458 L 88 480 L 40 476 Z',
  },
  {
    id: 'right_heel',
    labelKo: '오른쪽 발뒤꿈치',
    shape: 'path',
    d: 'M 106 458 L 152 454 L 160 476 L 112 480 Z',
  },
];

// 모든 부위 ID → 한국어 레이블 맵 (뷰에 상관없이 선택 목록 표시용)
const ALL_LABEL_MAP: Record<BodyPartId, string> = Object.fromEntries(
  [...FRONT_REGIONS, ...BACK_REGIONS].map((r) => [r.id, r.labelKo]),
);

// 색상 상수
const FILL_DEFAULT = '#C8DEF0';
const FILL_SELECTED = Colors.primary;
const STROKE_DEFAULT = 'rgba(255, 255, 255, 0.65)';
const STROKE_SELECTED = Colors.accent;
const STROKE_WIDTH = 0.8;

export function BodyMap({
  value,
  onChange,
  defaultValue = [],
  disabled = false,
  showLabel = true,
  style,
  testID,
}: BodyMapProps) {
  const [side, setSide] = useState<ViewSide>('front');
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<BodyPartId[]>(defaultValue);

  const selected = isControlled ? (value ?? []) : internal;

  const emit = (next: BodyPartId[]) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const toggle = (id: BodyPartId) => {
    if (disabled) return;
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    emit(next);
  };

  const regions = side === 'front' ? FRONT_REGIONS : BACK_REGIONS;

  const selectedLabels = selected
    .map((id) => ALL_LABEL_MAP[id])
    .filter(Boolean);

  return (
    <View testID={testID} style={[styles.root, style]}>
      {showLabel && (
        <View style={styles.headerRow}>
          <Text style={styles.label}>통증 부위</Text>
          <Text style={styles.count}>{selected.length}개 선택</Text>
        </View>
      )}

      {/* 앞면 / 뒷면 토글 */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, side === 'front' && styles.toggleBtnActive]}
          onPress={() => setSide('front')}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="앞면 보기"
          accessibilityState={{ selected: side === 'front' }}
        >
          <Text style={[styles.toggleText, side === 'front' && styles.toggleTextActive]}>
            앞면
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, side === 'back' && styles.toggleBtnActive]}
          onPress={() => setSide('back')}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="뒷면 보기"
          accessibilityState={{ selected: side === 'back' }}
        >
          <Text style={[styles.toggleText, side === 'back' && styles.toggleTextActive]}>
            뒷면
          </Text>
        </TouchableOpacity>
      </View>

      {/* SVG 바디맵 */}
      <View style={styles.svgContainer}>
        <Svg width={200} height={490} viewBox="0 0 200 490">
          <G opacity={disabled ? 0.45 : 1}>
            {regions.map((region) => {
              const isSelected = selected.includes(region.id);
              const fill = isSelected ? FILL_SELECTED : FILL_DEFAULT;
              const stroke = isSelected ? STROKE_SELECTED : STROKE_DEFAULT;
              const onPress = disabled ? undefined : () => toggle(region.id);

              if (region.shape === 'ellipse') {
                return (
                  <Ellipse
                    key={region.id}
                    cx={region.cx}
                    cy={region.cy}
                    rx={region.rx}
                    ry={region.ry}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={STROKE_WIDTH}
                    onPress={onPress}
                  />
                );
              }

              return (
                <Path
                  key={region.id}
                  d={region.d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={STROKE_WIDTH}
                  onPress={onPress}
                />
              );
            })}
          </G>
        </Svg>
      </View>

      {/* 선택된 부위 목록 */}
      {showLabel && selected.length > 0 && (
        <View style={styles.selectedBox}>
          <Text style={styles.selectedTitle}>선택된 부위</Text>
          <Text style={styles.selectedText}>{selectedLabels.join(' · ')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
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
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.ocean.heroWash,
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtn: {
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  svgContainer: {
    alignItems: 'center',
  },
  selectedBox: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.ocean.heroWash,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    width: '100%',
  },
  selectedTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    lineHeight: 20,
  },
});
