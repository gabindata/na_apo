import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../components/common/Header';
import { Colors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await signOut();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.screenRoot, { paddingBottom: insets.bottom }]}>
      <Header
        title="설정"
        leftIcon={<Text style={styles.backIcon}>‹</Text>}
        onPressLeft={() => router.back()}
        style={styles.headerStretch}
      />

      <View style={styles.body}>
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [
              styles.logoutRow,
              pressed && styles.logoutRowPressed,
              loggingOut && styles.logoutRowDisabled,
            ]}
            onPress={handleLogout}
            disabled={loggingOut}
            accessibilityRole="button"
            accessibilityLabel="로그아웃"
            accessibilityState={{ disabled: loggingOut }}
          >
            <Text style={styles.logoutText}>{loggingOut ? '로그아웃 중...' : '로그아웃'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerStretch: {
    alignSelf: 'stretch',
  },
  backIcon: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: '500',
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    overflow: 'hidden',
  },
  logoutRow: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  logoutRowPressed: {
    backgroundColor: 'rgba(198, 40, 40, 0.06)',
  },
  logoutRowDisabled: {
    opacity: 0.55,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
    textAlign: 'center',
  },
});
