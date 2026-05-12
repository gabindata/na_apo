/**
 * 출생 연도 스크롤 피커와 성별 카드 — 어두운 글래스모피즘 배경에서 사용
 */
import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const SECONDARY = '#7EC8E3';
const INPUT_BORDER = 'rgba(168,216,234,0.32)';

export const YEARS = Array.from({ length: 61 }, (_, i) => 2010 - i); // 2010~1950
export const ITEM_H = 52;
const VISIBLE_COUNT = 5;

export type Gender = 'male' | 'female' | 'none';

export const GENDER_LABELS: Record<Gender, string> = {
  male: '남성',
  female: '여성',
  none: '선택 안 함',
};

// ─── YearPicker ────────────────────────────────────────────
export function YearPicker({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const index = YEARS.indexOf(value);
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: index * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  const handleScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(YEARS.length - 1, index));
    if (YEARS[clamped] !== value) onChange(YEARS[clamped]);
  };

  return (
    <View style={yr.container}>
      <View pointerEvents="none" style={yr.highlight} />
      <View pointerEvents="none" style={yr.fadeTop}>
        <LinearGradient colors={['rgba(15,40,64,0.92)', 'transparent']} style={{ flex: 1 }} />
      </View>
      <ScrollView
        ref={scrollRef}
        style={yr.scroll}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE_COUNT / 2) }}
      >
        {YEARS.map((year) => (
          <View key={year} style={yr.item}>
            <Text style={[yr.yearText, year === value && yr.yearTextSelected]}>
              {year}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={yr.fadeBottom}>
        <LinearGradient colors={['transparent', 'rgba(15,40,64,0.92)']} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

// ─── GenderCard ────────────────────────────────────────────
export function GenderCard({ label, selected, onPress }: {
  label: string; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[gc.wrapper, selected && gc.wrapperSelected]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      <BlurView
        intensity={selected ? 20 : 10}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={gc.blur}
      >
        <View style={[gc.overlay, selected && gc.overlaySelected]} />
        <Text style={[gc.label, selected && gc.labelSelected]}>{label}</Text>
      </BlurView>
    </TouchableOpacity>
  );
}

const yr = StyleSheet.create({
  container: {
    height: ITEM_H * VISIBLE_COUNT,
    overflow: 'hidden',
    position: 'relative',
  },
  scroll: { flex: 1 },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(164,210,240,0.40)',
    letterSpacing: 0.5,
  },
  yearTextSelected: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  highlight: {
    position: 'absolute',
    top: ITEM_H * Math.floor(VISIBLE_COUNT / 2),
    left: 20,
    right: 20,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(126,200,227,0.45)',
    zIndex: 2,
  },
  fadeTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: ITEM_H * 2,
    zIndex: 3,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: ITEM_H * 2,
    zIndex: 3,
  },
});

const gc = StyleSheet.create({
  wrapper: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: INPUT_BORDER,
  },
  wrapperSelected: {
    borderColor: 'rgba(126,200,227,0.70)',
    shadowColor: SECONDARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  blur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(120,175,220,0.12)',
  },
  overlaySelected: {
    backgroundColor: 'rgba(126,200,227,0.20)',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(164,210,240,0.55)',
    zIndex: 1,
  },
  labelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
