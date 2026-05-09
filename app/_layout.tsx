import { useEffect } from 'react';
import { ActivityIndicator, View, Image, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import { FONT_ASSETS, applyGlobalFont } from '../lib/fonts';

// 모듈 로드 시점에 한 번만 패치 → 이후 모든 Text/TextInput 렌더에 자동 반영
applyGlobalFont();

const PUBLIC_GROUPS = ['(auth)'];

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // 폰트 로드 — 로드 완료 전에는 시스템 폰트로 폴백
  const [fontsLoaded] = useFonts(FONT_ASSETS);

  useEffect(() => {
    if (loading) return;

    const inPublicGroup = PUBLIC_GROUPS.includes(segments[0] as string);
    const isAuthenticated = !!session;

    if (!isAuthenticated && !inPublicGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inPublicGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  // 인증 로딩 중 or 폰트 미로드 → 스플래시
  if (loading || !fontsLoaded) {
    return (
      <View style={styles.splash}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={Colors.primary} style={styles.splashSpinner} />
      </View>
    );
  }

  return (
    <Stack initialRouteName="(auth)">
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="report" options={{ headerShown: false }} />
      <Stack.Screen name="magazine/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 160,
    height: 160,
  },
  splashSpinner: {
    marginTop: 32,
  },
});
