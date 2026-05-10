import { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, withRepeat, withTiming,
  useAnimatedStyle, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

const BUBBLES_LOGIN: {
  x: number; y: number; r: number;
  duration: number; delay: number; drift: number;
}[] = [
  { x: 0.78, y: 0.06, r: 90,  duration: 3500,  delay: 0,    drift: 14 },
  { x: 0.12, y: 0.28, r: 60,  duration: 4500,  delay: 600,  drift: 10 },
  { x: 0.68, y: 0.52, r: 44,  duration: 4000,  delay: 300,  drift: 8  },
  { x: 0.20, y: 0.70, r: 72,  duration: 5200,  delay: 1000, drift: 12 },
  { x: 0.85, y: 0.80, r: 36,  duration: 3800,  delay: 200,  drift: 7  },
  { x: 0.50, y: 0.15, r: 28,  duration: 3200,  delay: 900,  drift: 6  },
  { x: 0.38, y: 0.45, r: 18,  duration: 5500,  delay: 450,  drift: 5  },
];

// 홈 화면용 — subtle 미세 버블 (9개로 축소)
const BUBBLES_HOME: typeof BUBBLES_LOGIN = [
  { x: 0.10, y: 0.08, r: 3,  duration: 5200, delay: 0,    drift: 4 },
  { x: 0.72, y: 0.10, r: 4,  duration: 6400, delay: 500,  drift: 5 },
  { x: 0.88, y: 0.28, r: 2,  duration: 5800, delay: 200,  drift: 3 },
  { x: 0.20, y: 0.42, r: 5,  duration: 7000, delay: 900,  drift: 4 },
  { x: 0.60, y: 0.38, r: 3,  duration: 5500, delay: 1200, drift: 3 },
  { x: 0.05, y: 0.62, r: 4,  duration: 6200, delay: 400,  drift: 4 },
  { x: 0.82, y: 0.60, r: 2,  duration: 4800, delay: 700,  drift: 3 },
  { x: 0.38, y: 0.78, r: 4,  duration: 6800, delay: 300,  drift: 4 },
  { x: 0.65, y: 0.85, r: 3,  duration: 5400, delay: 1000, drift: 3 },
];

const BUBBLES = BUBBLES_LOGIN;

function Bubble({ x, y, r, duration, delay, drift }: typeof BUBBLES[0]) {
  const floatY = useSharedValue(0);
  const floatX = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withTiming(-drift * 2, { duration, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
    setTimeout(() => {
      floatX.value = withRepeat(
        withTiming(drift * 0.5, { duration: duration * 0.7, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
    }, delay);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { translateX: floatX.value },
    ],
  }));

  const left = W * x - r;
  const top  = H * y - r;
  const size = r * 2;

  return (
    <Animated.View
      style={[styles.bubble, animStyle, { left, top, width: size, height: size, borderRadius: r }]}
      pointerEvents="none"
    >
      {/* 외곽 글로우 — 약하게 */}
      <View style={[StyleSheet.absoluteFill, styles.glow, { borderRadius: r }]} />

      {/* 구체 본체 */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.40)',
          'rgba(200,232,248,0.22)',
          'rgba(126,200,227,0.10)',
          'rgba(74,144,217,0.03)',
        ]}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0.15, y: 0.08 }}
        end={{ x: 0.92, y: 0.95 }}
        style={[StyleSheet.absoluteFill, { borderRadius: r }]}
      />

      {/* 상단 하이라이트 */}
      <LinearGradient
        colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.topSheen, { borderTopLeftRadius: r, borderTopRightRadius: r, height: r * 0.45 }]}
      />

      {/* 스페큘러 하이라이트 */}
      <View
        style={[
          styles.specular,
          {
            width:  r * 0.28,
            height: r * 0.16,
            borderRadius: r * 0.14,
            left:   r * 0.22,
            top:    r * 0.18,
          },
        ]}
      />

      {/* 테두리 림 */}
      <View style={[StyleSheet.absoluteFill, styles.rim, { borderRadius: r }]} />
    </Animated.View>
  );
}

export function OceanBubbles({ variant = 'login' }: { variant?: 'login' | 'home' }) {
  const list = variant === 'home' ? BUBBLES_HOME : BUBBLES_LOGIN;
  return (
    <View style={[StyleSheet.absoluteFill, variant === 'home' && styles.homeWrap]} pointerEvents="none">
      {list.map((b, i) => (
        <Bubble key={i} {...b} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  homeWrap: {
    opacity: 0.55,
  },
  bubble: {
    position: 'absolute',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    shadowColor: '#7EC8E3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 2,
    backgroundColor: 'transparent',
  },
  topSheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  specular: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  rim: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'transparent',
  },
});
