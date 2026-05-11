import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../components/common/Header';
import { useAuth } from '../contexts/AuthContext';
import { useBgm } from '../contexts/BgmContext';

const T = {
  text:      '#0C2A45',
  textMuted: '#4A7898',
  secondary: '#1A6FAD',
  primary:   '#2468B8',
} as const;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { prefsLoaded, enabled, setEnabled, volume, setVolume } = useBgm();
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
    <LinearGradient
      colors={['#F2F9FF', '#D0E9F8', '#A8D4EE']}
      locations={[0, 0.5, 1]}
      style={[styles.screenRoot, { paddingBottom: insets.bottom }]}
    >
      <Header
        title="설정"
        leftIcon={<Text style={styles.backIcon}>‹</Text>}
        onPressLeft={() => router.back()}
        style={styles.headerLight}
      />

      <View style={styles.body}>
        <Text style={styles.sectionHeading}>앱 설정</Text>
        <View style={[styles.section, styles.sectionMarginBottom]}>
          <View style={styles.bgmRow}>
            <View style={styles.bgmLabels}>
              <Text style={styles.bgmTitle}>배경음악</Text>
            </View>
            <Switch
              value={prefsLoaded && enabled}
              onValueChange={setEnabled}
              disabled={!prefsLoaded}
              trackColor={{ false: 'rgba(100,160,210,0.30)', true: T.secondary }}
              thumbColor={'#ffffff'}
              accessibilityLabel="배경음악 켜기"
            />
          </View>
          {prefsLoaded && enabled ? (
            <View style={styles.volumeBlock}>
              <View style={styles.volumeLabelRow}>
                <Text style={styles.volumeLabel}>음량</Text>
                <Text style={styles.volumeValue}>{Math.round(volume * 100)}%</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={volume}
                onValueChange={setVolume}
                minimumTrackTintColor={T.primary}
                maximumTrackTintColor={'rgba(100,160,210,0.30)'}
                thumbTintColor={T.primary}
                accessibilityLabel="배경음악 음량"
              />
            </View>
          ) : null}
        </View>

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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  headerLight: {
    backgroundColor: 'rgba(242,249,255,0.94)',
    borderBottomColor: 'rgba(100,160,210,0.30)',
  },
  backIcon: {
    fontSize: 28,
    color: T.secondary,
    fontWeight: '500',
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: T.textMuted,
    marginBottom: 10,
    marginLeft: 2,
    letterSpacing: -0.2,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.28)',
    overflow: 'hidden',
  },
  sectionMarginBottom: {
    marginBottom: 16,
  },
  bgmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  bgmLabels: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  bgmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: T.text,
  },
  volumeBlock: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(100,160,210,0.28)',
  },
  volumeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 4,
  },
  volumeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: T.text,
  },
  volumeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: T.primary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  logoutRow: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  logoutRowPressed: {
    backgroundColor: 'rgba(198,40,40,0.06)',
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
