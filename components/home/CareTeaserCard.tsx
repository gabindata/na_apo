import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
      <View style={styles.verticalStack}>
        {/* 헤더 */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Image
              source={require('../../assets/images/apo_tab.png')}
              style={styles.apoThumb}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={10} color={T.secondary} />
              <Text style={styles.aiBadgeText}>AI 케어</Text>
            </View>
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
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {},

  /** 헤더 ↔ 요약 ↔ 칩 ↔ 버튼 사이 간격 */
  verticalStack: {
    gap: 16,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  apoThumb: {
    width: 30,
    height: 30,
    borderRadius: 10,
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
    paddingVertical: 2,
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
    lineHeight: 22,
    letterSpacing: -0.2,
  },

  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    rowGap: 10,
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.45)',
    borderRadius: 16,
  },
  ctaText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});
