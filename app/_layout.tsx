import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

// 공개 그룹 상수로 분리 → 나중에 그룹 추가 시 여기만 수정
const PUBLIC_GROUPS = ['(auth)'];

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inPublicGroup = PUBLIC_GROUPS.includes(segments[0] as string);
    const isAuthenticated = !!session;

    // 이미 올바른 위치에 있으면 redirect 생략
    if (!isAuthenticated && !inPublicGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inPublicGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  // 로딩 중엔 스플래시 화면 표시 → 잘못된 화면 스침 방지
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack initialRouteName="(auth)">
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
