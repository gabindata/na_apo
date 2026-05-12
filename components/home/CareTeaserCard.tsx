import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import { GlassCard } from '../common/GlassCard';
import {
  fetchCareData,
  buildSignals,
  FALLBACK_CARE,
  type ParsedCare,
  type CareSummary,
} from '../../lib/careData';
import { fetchUserProfile } from '../../lib/userProfile';
import { useAuth } from '../../contexts/AuthContext';

const T = {
  text:      '#FFFFFF',
  textMuted: '#C8DFEF',
  primary:   '#4A90D9',
  secondary: '#7EC8E3',
};

export function CareTeaserCard() {
  const { user } = useAuth();
  const [care, setCare]       = useState<ParsedCare | null>(null);
  const [summary, setSummary] = useState<CareSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const userProfile = user?.id ? await fetchUserProfile(user.id) : null;
          const profile = userProfile
            ? { birthYear: userProfile.birthYear, gender: userProfile.gender }
            : null;
          const { summary: s, care: c } = await fetchCareData(profile);
          if (!active) return;
          setSummary(s);
          setCare(c);
        } catch {
          if (!active) return;
          setCare(FALLBACK_CARE);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [user?.id]),
  );

  const signals = useMemo(() => buildSignals(summary), [summary]);
  const summaryText = care?.summary ?? '오늘의 케어를 확인해보세요.';

  return (
    <GlassCard style={styles.card}>
      {/* 헤더 */}
      <View style={styles.headerRow}>
        <View style={styles.aiBadge}>
          <Ionicons name="sparkles" size={10} color={T.secondary} />
          <Text style={styles.aiBadgeText}>AI 케어</Text>
        </View>
        {loading && <ActivityIndicator size="small" color={T.secondary} />}
      </View>

      {/* AI 요약 텍스트 */}
      {loading ? (
        <View style={styles.loadingRow}>
          <Text style={styles.loadingText}>케어를 분석하고 있어요…</Text>
        </View>
      ) : (
        <Text
          style={styles.summaryText}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="balanced"
        >
          {summaryText}
        </Text>
      )}

      {/* 신호 칩 */}
      {signals.length > 0 && !loading && (
        <View style={styles.signalRow}>
          {signals.map((sig) => (
            <View key={sig} style={styles.signalChip}>
              <View style={styles.signalDot} />
              <Text style={styles.signalText}>{sig}</Text>
            </View>
          ))}
        </View>
      )}

      {/* CTA 버튼 */}
      <Pressable
        onPress={() => router.push('/care')}
        style={({ pressed }) => [styles.ctaWrap, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
        accessibilityRole="button"
        accessibilityLabel="오늘의 케어 시작하기"
      >
        <LinearGradient
          colors={['rgba(74,144,217,0.95)', 'rgba(46,95,163,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ctaBtn}
        >
          <Ionicons name="heart-circle-outline" size={17} color="#fff" />
          <Text style={styles.ctaText}>오늘의 케어 시작하기</Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.75)" />
        </LinearGradient>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {},

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(126,200,227,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: T.secondary,
    letterSpacing: 0.3,
  },

  loadingRow: {
    marginVertical: 6,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
    color: T.textMuted,
  },

  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 21,
    letterSpacing: -0.2,
    marginBottom: 10,
  },

  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  signalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(240,160,160,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,160,160,0.35)',
  },
  signalDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F4B8B8',
  },
  signalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F4C0C0',
    letterSpacing: -0.1,
  },

  ctaWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1A4FA8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.40)',
    borderRadius: 16,
  },
  ctaText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});
