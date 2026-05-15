import { ReactNode } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassCardProps {
  children: ReactNode;
  padding?: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * 유리 카드.
 *  - iOS: BlurView 로 실제 가우시안 블러 + 살짝 light 틴트.
 *  - Android: BlurView(dimezisBlurView)가 실험 기능이라 폰마다 결과가 들쭉날쭉.
 *            진짜 블러 없이도 카드가 떠 보이도록 진한 반투명 다크 블루 배경 +
 *            상단 광택/하이라이트 그라데이션으로 동일한 시각 무게감을 재현한다.
 */
export function GlassCard({ children, padding = 16, radius = 22, style }: GlassCardProps) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={38}
        tint="light"
        style={[styles.container, { borderRadius: radius }, style]}
      >
        {/* 내부 틴트 */}
        <View style={[StyleSheet.absoluteFill, styles.overlayIOS, { borderRadius: radius }]} />

        {/* 상단 빛 그라데이션 */}
        <LinearGradient
          colors={['rgba(255,255,255,0.11)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.topShine, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
        />

        {/* 상단 테두리 선 */}
        <View style={[styles.topLine, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />

        <View style={{ padding }}>
          {children}
        </View>
      </BlurView>
    );
  }

  // ── Android: BlurView 없이 가짜 유리 카드 ──
  return (
    <View style={[styles.container, styles.containerAndroid, { borderRadius: radius }, style]}>
      {/* 진한 베이스 — 다크 블루를 반투명으로 깔아 깊이감 확보 */}
      <View style={[StyleSheet.absoluteFill, styles.overlayAndroid, { borderRadius: radius }]} />

      {/* 상단에서 아래로 떨어지는 부드러운 광택 (유리 위쪽이 살짝 밝아 보이게) */}
      <LinearGradient
        colors={[
          'rgba(168,216,234,0.22)',
          'rgba(126,200,227,0.06)',
          'rgba(60,110,160,0.00)',
        ]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />

      {/* 상단 1px 하이라이트 — iOS와 같은 광택 라인 */}
      <View style={[styles.topLine, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />

      <View style={{ padding }}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.28)',
  },
  containerAndroid: {
    // 그림자가 elevation 으로만 들어가는 안드로이드용 입체감 보강
    elevation: 4,
    backgroundColor: 'transparent',
  },
  overlayIOS: {
    backgroundColor: 'rgba(120,175,220,0.13)',
  },
  overlayAndroid: {
    // 진짜 블러가 없으므로 더 진한 색으로 보강해 평면처럼 안 보이게.
    backgroundColor: 'rgba(28,62,100,0.55)',
  },
  topShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 40,
  },
  topLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
});
