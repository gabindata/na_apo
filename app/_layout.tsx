import { useEffect } from 'react';
import { ActivityIndicator, View, Image, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { BgmProvider } from '../contexts/BgmContext';
import { Colors } from '../constants/colors';
import { FONT_ASSETS, applyGlobalFont } from '../lib/fonts';

// 모듈 로드 시점에 한 번만 패치 → 이후 모든 Text/TextInput 렌더에 자동 반영
applyGlobalFont();

const PUBLIC_GROUPS = ['(auth)'];

function RootLayoutNav() {
  const { session, loading, needsOnboarding, onboardingChecked } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // 폰트 로드 — 로드 완료 전에는 시스템 폰트로 폴백
  const [fontsLoaded] = useFonts(FONT_ASSETS);

  // 폰트·세션 준비 전에도 Stack은 항상 마운트 (스플래시만 덮음).
  // 예전처럼 스플래시일 때 Stack 자체를 안 그리면 replace 시점에 네비게이터가 없어
  // "(tabs) was not handled" 경고가 난다.
  const navigationReady = !loading && onboardingChecked && fontsLoaded;

  useEffect(() => {
    if (!navigationReady) return;

    const inPublicGroup = PUBLIC_GROUPS.includes(segments[0] as string);
    const onOnboarding = segments[0] === 'onboarding';
    const isAuthenticated = !!session;

    if (!isAuthenticated && !inPublicGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inPublicGroup) {
      router.replace(needsOnboarding ? '/onboarding' : '/(tabs)');
    } else if (isAuthenticated && !inPublicGroup && !onOnboarding && needsOnboarding) {
      router.replace('/onboarding');
    }
  }, [navigationReady, session, needsOnboarding, segments, router]);

  return (
    <>
      <Stack initialRouteName="(auth)">
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="report" options={{ headerShown: false }} />
        <Stack.Screen name="magazine/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="care" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>

      {!navigationReady && (
        <View style={styles.splashOverlay} pointerEvents="auto">
          <Image
            source={require('../assets/logo/logo.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color={Colors.primary} style={styles.splashSpinner} />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <BgmProvider>
        <RootLayoutNav />
      </BgmProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  splashLogo: {
    width: 160,
    height: 160,
  },
  splashSpinner: {
    marginTop: 32,
  },
});
