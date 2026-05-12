import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

/**
 * 루트 경로 `/` · 개발 URL `/--/` 등에서 "Unmatched Route" 방지.
 * 실제 진입은 대부분 (auth) 초기 라우트이나, 잘못된 replace 후 빈 경로로 떨어질 때 복구용.
 */
export default function RootIndex() {
  const { session, loading, needsOnboarding, onboardingChecked } = useAuth();

  if (loading || !onboardingChecked) {
    return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.background }]} />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }
  if (needsOnboarding) {
    return <Redirect href="/onboarding" />;
  }
  return <Redirect href="/(tabs)" />;
}
