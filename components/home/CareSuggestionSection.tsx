import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { GlassCard } from '../common/GlassCard';
import { sendMessage } from '../../lib/claude';
import { fetchRecentCareSummary, type CareSummary } from '../../lib/painRecords';

const T = {
  text:      '#FFFFFF',
  textMuted: '#C8DFEF',
  primary:   '#4A90D9',
  secondary: '#7EC8E3',
  accent:    '#2E5FA3',
};

/** 분석 기간(일) — fetchRecentCareSummary 인자 */
const CARE_SUMMARY_PERIOD_DAYS = 7;

/** AsyncStorage 캐시 키 (시그니처 + 팁 목록을 함께 저장) */
const CACHE_KEY = 'naapo:care-suggestion:v1';

/** 4줄 응답을 카테고리별로 안전하게 분리한다 */
type ParsedTip = { icon: string; title: string; body: string };

const FALLBACK_TIPS: ParsedTip[] = [
  { icon: '🌿', title: '스트레칭/자세', body: '한 시간에 한 번씩 어깨를 천천히 돌려보세요.' },
  { icon: '🥗', title: '음식/수분',     body: '오늘은 따뜻한 물 한 컵으로 가볍게 시작해보세요.' },
  { icon: '🌙', title: '생활 습관/수면', body: '취침 1시간 전 화면을 잠시 멀리해 보세요.' },
  { icon: '💙', title: '마음 케어',     body: '심호흡 다섯 번으로 잠깐 마음을 가다듬어 보세요.' },
];

const LINE_RULES: { icon: string; title: ParsedTip['title'] }[] = [
  { icon: '🌿', title: '스트레칭/자세' },
  { icon: '🥗', title: '음식/수분' },
  { icon: '🌙', title: '생활 습관/수면' },
  { icon: '💙', title: '마음 케어' },
];

function parseTips(raw: string): ParsedTip[] {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const result: ParsedTip[] = [];
  for (const rule of LINE_RULES) {
    const matched = lines.find((l) => l.startsWith(rule.icon));
    if (!matched) {
      result.push({ icon: rule.icon, title: rule.title, body: '' });
      continue;
    }
    const stripped = matched.slice(rule.icon.length).trim();
    const colonIdx = stripped.indexOf(':');
    const body = colonIdx >= 0 ? stripped.slice(colonIdx + 1).trim() : stripped;
    result.push({ icon: rule.icon, title: rule.title, body });
  }
  const hasAnyBody = result.some((t) => t.body.length > 0);
  return hasAnyBody ? result : FALLBACK_TIPS;
}

/** 요약 데이터 → 안정적인 시그니처 문자열 (필드 순서 고정) */
function makeSignature(s: CareSummary): string {
  return [
    s.periodDays,
    s.recordCount,
    s.topBodyPart ?? '',
    s.topBodyPartCount,
    s.avgIntensity,
    s.highIntensityDays,
    s.avgSleepHours ?? '',
    s.shortSleepDays,
    s.emotionGood,
    s.emotionNormal,
    s.emotionBad,
    s.painTypes.join(','),
  ].join('|');
}

type CachePayload = {
  signature: string;
  tips: ParsedTip[];
  savedAt: number;
};

async function loadCache(): Promise<CachePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed || typeof parsed.signature !== 'string' || !Array.isArray(parsed.tips)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function saveCache(payload: CachePayload): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // 캐시 저장 실패는 조용히 무시 — 다음 진입 시 다시 시도
  }
}

/** 케어 요약 → 신호 뱃지 텍스트 배열 (로컬 계산) */
function buildSignals(s: CareSummary | null): string[] {
  if (!s || s.recordCount === 0) return [];

  const signals: string[] = [];

  if (s.topBodyPart && s.topBodyPartCount >= 3) {
    signals.push(`최근 ${s.topBodyPart} 통증 기록 ${s.topBodyPartCount}회`);
  }
  if (s.highIntensityDays >= 2) {
    signals.push(`강도 7+ 기록 ${s.highIntensityDays}회`);
  }
  if (s.shortSleepDays >= 2) {
    signals.push(`수면 5시간 미만 ${s.shortSleepDays}일`);
  } else if (s.avgSleepHours != null && s.avgSleepHours < 6) {
    signals.push(`평균 수면 ${s.avgSleepHours}시간`);
  }
  if (s.emotionBad >= 2 && s.emotionBad >= s.emotionGood) {
    signals.push(`기분 '나쁨' ${s.emotionBad}회`);
  }
  if (s.painTypes.length > 0 && signals.length < 4) {
    signals.push(`자주 겪은 유형: ${s.painTypes.slice(0, 2).join(', ')}`);
  }

  return signals.slice(0, 4);
}

export function CareSuggestionSection() {
  const [summary, setSummary] = useState<CareSummary | null>(null);
  const [tips, setTips] = useState<ParsedTip[]>([]);
  /** 첫 진입에서 캐시가 없을 때만 로딩 스피너 노출 */
  const [initialLoading, setInitialLoading] = useState(true);
  /** AI 호출 중인지 — 캐시 hit이면 false 유지 */
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 화면 포커스 때마다 동기화하되, 시그니처가 같으면 AI 호출 안 함.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          // 1) DB에서 최신 요약 가져오기
          const s = await fetchRecentCareSummary(CARE_SUMMARY_PERIOD_DAYS);
          if (!active) return;
          setSummary(s);
          const signature = makeSignature(s);

          // 2) 캐시와 비교
          const cached = await loadCache();
          if (!active) return;

          if (cached && cached.signature === signature && cached.tips.length > 0) {
            // 데이터 그대로 → 캐시된 팁 유지, AI 호출 X
            setTips(cached.tips);
            setError(null);
            setInitialLoading(false);
            return;
          }

          // 3) 캐시 miss → AI 호출
          //    캐시가 아예 없는 첫 진입에서는 스피너, 데이터가 바뀌어 재요청하는 경우엔 기존 팁을 유지
          if (cached && cached.tips.length > 0) {
            setTips(cached.tips); // 이전 팁을 잠깐 보여주며 갱신
            setRefetching(true);
          } else {
            setInitialLoading(true);
          }

          const payload = JSON.stringify(s);
          const reply = await sendMessage(
            [{ role: 'user', content: payload }],
            'care-suggestion',
          );
          if (!active) return;

          const nextTips = parseTips(reply);
          setTips(nextTips);
          setError(null);
          await saveCache({ signature, tips: nextTips, savedAt: Date.now() });
        } catch (err) {
          if (!active) return;
          console.error('[CareSuggestion] 케어 제안 로드 실패:', err);
          setError(err instanceof Error ? err.message : '케어 제안을 불러오지 못했어요.');
          // 캐시도 없으면 폴백 팁이라도 보여주기
          setTips((prev) => (prev.length > 0 ? prev : FALLBACK_TIPS));
        } finally {
          if (active) {
            setInitialLoading(false);
            setRefetching(false);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, []),
  );

  const signals = useMemo(() => buildSignals(summary), [summary]);

  return (
    <GlassCard style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>🩵 오늘의 케어 제안</Text>
        {refetching ? (
          <View style={styles.refetchBadge}>
            <ActivityIndicator size="small" color={T.secondary} />
            <Text style={styles.refetchText}>업데이트 중</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.headerSub}>
        최근 7일 간의 기록을 바탕으로 자동 업데이트돼요.{'\n'}오늘부터 가볍게 시도해 보세요.
      </Text>

      {/* ── 감지된 신호 뱃지 ───────────────────── */}
      {signals.length > 0 ? (
        <View style={styles.signalRow}>
          {signals.map((sig) => (
            <View key={sig} style={styles.signalChip}>
              <Text style={styles.signalText}>{sig}</Text>
            </View>
          ))}
        </View>
      ) : !initialLoading && summary && summary.recordCount === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>아직 분석할 기록이 부족해요.</Text>
          <Text style={styles.emptySubText}>
            오늘의 통증을 기록하면 더 정확한 제안을 받을 수 있어요.
          </Text>
        </View>
      ) : null}

      {/* ── AI 케어 팁 ─────────────────────────── */}
      {initialLoading && tips.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={T.secondary} />
          <Text style={styles.loadingText}>케어 제안을 준비하고 있어요…</Text>
        </View>
      ) : (
        <View style={styles.tipList}>
          {tips.map((tip) => (
            <View key={tip.title} style={styles.tipRow}>
              <View style={styles.tipIconWrap}>
                <LinearGradient
                  colors={['rgba(126,200,227,0.35)', 'rgba(74,144,217,0.30)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tipIconBg}
                >
                  <Text style={styles.tipIcon}>{tip.icon}</Text>
                </LinearGradient>
              </View>
              <View style={styles.tipTextWrap}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipBody}>
                  {tip.body || '오늘은 가볍게 컨디션을 살펴봐 주세요.'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── 오류 안내 (캐시도 없고 폴백을 보여주는 상황에서만) ── */}
      {error && !initialLoading && tips === FALLBACK_TIPS ? (
        <Text style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <Text style={styles.disclaimer}>
        ※ 일반적인 생활 관리 제안이에요. 통증이 심하거나 길어지면 진료를 받아보세요.
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    // GlassCard handles visuals
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: T.text,
    letterSpacing: -0.2,
    flex: 1,
  },
  refetchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refetchText: {
    fontSize: 11,
    fontWeight: '700',
    color: T.secondary,
    letterSpacing: 0.2,
  },
  headerSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: T.textMuted,
    lineHeight: 17,
  },

  // 신호 뱃지
  signalRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  signalChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(240,170,170,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(240,170,170,0.42)',
  },
  signalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F4C0C0',
    letterSpacing: -0.1,
  },

  // 빈 상태
  emptyBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(126,180,220,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.45)',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: T.secondary,
  },
  emptySubText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: T.textMuted,
  },

  // 로딩
  loadingWrap: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.textMuted,
  },

  // 팁 리스트
  tipList: {
    marginTop: 14,
    gap: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(126,180,220,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.32)',
  },
  tipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
  },
  tipIconBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipIcon: {
    fontSize: 18,
  },
  tipTextWrap: {
    flex: 1,
    gap: 3,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: T.secondary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  tipBody: {
    fontSize: 13,
    fontWeight: '600',
    color: T.text,
    lineHeight: 19,
    letterSpacing: -0.2,
  },

  // 기타
  errorText: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '600',
    color: '#F0AAAA',
  },
  disclaimer: {
    marginTop: 12,
    fontSize: 10,
    fontWeight: '600',
    color: T.textMuted,
    lineHeight: 14,
  },
});
