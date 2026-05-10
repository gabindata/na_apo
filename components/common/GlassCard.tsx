import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassCardProps {
  children: ReactNode;
  padding?: number;
  radius?: number;
  style?: ViewStyle;
}

export function GlassCard({ children, padding = 16, radius = 22, style }: GlassCardProps) {
  return (
    <BlurView
      intensity={38}
      tint="light"
      experimentalBlurMethod="dimezisBlurView"
      style={[styles.blur, { borderRadius: radius }, style]}
    >
      {/* 내부 틴트 */}
      <View style={[StyleSheet.absoluteFill, styles.overlay, { borderRadius: radius }]} />

      {/* 상단 빛 그라디언트 */}
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

const styles = StyleSheet.create({
  blur: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.28)',
  },
  overlay: {
    backgroundColor: 'rgba(120,175,220,0.13)',
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
