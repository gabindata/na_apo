import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { GlassCard } from '../common/GlassCard';
import { sendMessage } from '../../lib/claude';
import { fetchRecentCareSummary, type CareSummary } from '../../lib/painRecords';

const T = {
  text:      '#FFFFFF',
  textMuted: '#C8DFEF',
  primary:   '#4A90D9',
  secondary: '#7EC8E3',
};

const CARE_SUMMARY_PERIOD_DAYS = 7;
// v2 = 새 포맷 (구 v1 캐시와 충돌 방지)
const CACHE_KEY = 'naapo:care-suggestion:v2';

// ── 카테고리 설정 ──────────────────────────────────────────
type CategoryKey = 'stretch' | 'nutrition' | 'sleep' | 'mind';

const CATEGORY_CONFIG: Record<CategoryKey, { icon: string; label: string }> = {
  stretch:   { icon: 'body-outline',   label: '스트레칭' },
  nutrition: { icon: 'water-outline',  label: '수분·영양' },
  sleep:     { icon: 'moon-outline',   label: '수면' },
  mind:      { icon: 'heart-outline',  label: '마음' },
};

function isCategoryKey(v: string): v is CategoryKey {
  return v in CATEGORY_CONFIG;
}

// ── 타입 ───────────────────────────────────────────────────
type CardData = { category: CategoryKey; title: string; body: string; cta: string };
type ParsedCare = { summary: string; primary: CardData; secondary: CardData[] };

// ── 폴백 ───────────────────────────────────────────────────
const FALLBACK_CARE: ParsedCare = {
  summary: '꾸준한 기록으로 더 정확한 케어를 받을 수 있어요.',
  primary: {
    category: 'stretch',
    title: '스트레칭',
    body: '한 시간에 한 번씩 어깨를 천천히 돌려보세요.',
    cta: '시작하기',
  },
  secondary: [
    { category: 'nutrition', title: '수분 보충', body: '따뜻한 물 한 컵으로 하루를 가볍게 시작해보세요.', cta: '체크하기' },
    { category: 'sleep',     title: '수면 관리', body: '취침 1시간 전 화면을 잠시 멀리해 보세요.',        cta: '목표 설정' },
    { category: 'mind',      title: '마음 케어', body: '심호흡 다섯 번으로 잠깐 마음을 가다듬어 보세요.', cta: '시작하기' },
  ],
};

// ── 파서 ───────────────────────────────────────────────────
/**
 * AI 출력 형식:
 * SUMMARY: [요약]
 * PRIMARY: [카테고리] | [제목] | [본문] | [CTA]
 * CARD: [카테고리] | [제목] | [본문] | [CTA]
 * CARD: ...
 * CARD: ...
 */
function parseCare(raw: string): ParsedCare | null {
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  let summary = '';
  let primary: CardData | null = null;
  const secondary: CardData[] = [];

  const parseCard = (line: string, prefix: string): CardData | null => {
    const parts = line.slice(prefix.length).trim().split('|').map((p) => p.trim());
    if (parts.length < 4) return null;
    const [cat, title, body, cta] = parts;
    return {
      category: isCategoryKey(cat ?? '') ? (cat as CategoryKey) : 'stretch',
      title:    title ?? '',
      body:     body  ?? '',
      cta:      cta   ?? '시작하기',
    };
  };

  for (const line of lines) {
    if (line.startsWith('SUMMARY:')) {
      summary = line.slice('SUMMARY:'.length).trim();
    } else if (line.startsWith('PRIMARY:')) {
      primary = parseCard(line, 'PRIMARY:');
    } else if (line.startsWith('CARD:')) {
      const card = parseCard(line, 'CARD:');
      if (card) secondary.push(card);
    }
  }

  if (!summary || !primary || secondary.length === 0) return null;
  return { summary, primary, secondary };
}

// ── 시그니처 + 캐시 ────────────────────────────────────────
function makeSignature(s: CareSummary): string {
  return [
    s.periodDays, s.recordCount, s.topBodyPart ?? '',
    s.topBodyPartCount, s.avgIntensity, s.highIntensityDays,
    s.avgSleepHours ?? '', s.shortSleepDays,
    s.emotionGood, s.emotionNormal, s.emotionBad,
    s.painTypes.join(','),
  ].join('|');
}

type CachePayload = { signature: string; care: ParsedCare; savedAt: number };

async function loadCache(): Promise<CachePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CachePayload;
    if (!p?.signature || !p?.care?.primary) return null;
    return p;
  } catch { return null; }
}

async function saveCache(payload: CachePayload): Promise<void> {
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch {}
}

// ── 신호 칩 (패턴 중심 표현) ───────────────────────────────
function buildSignals(s: CareSummary | null): string[] {
  if (!s || s.recordCount === 0) return [];
  const signals: string[] = [];
  if (s.topBodyPart && s.topBodyPartCount >= 3)
    signals.push(`${s.topBodyPart} 통증 반복`);
  if (s.highIntensityDays >= 2)
    signals.push('통증 강도 높음');
  if (s.shortSleepDays >= 3 || (s.avgSleepHours != null && s.avgSleepHours < 6))
    signals.push('수면 부족 경향');
  if (s.emotionBad >= 2 && s.emotionBad >= s.emotionGood)
    signals.push('스트레스 증가');
  if (signals.length === 0 && s.painTypes.length > 0)
    signals.push(`${s.painTypes[0]} 패턴 지속`);
  return signals.slice(0, 3);
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export function CareSuggestionSection() {
  const [summary, setSummary] = useState<CareSummary | null>(null);
  const [care, setCare]       = useState<ParsedCare | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refetching, setRefetching]         = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const s = await fetchRecentCareSummary(CARE_SUMMARY_PERIOD_DAYS);
          if (!active) return;
          setSummary(s);
          const signature = makeSignature(s);

          const cached = await loadCache();
          if (!active) return;

          if (cached && cached.signature === signature && cached.care) {
            setCare(cached.care);
            setInitialLoading(false);
            return;
          }

          // 기존 캐시 있으면 잠깐 보여주면서 갱신
          if (cached?.care) { setCare(cached.care); setRefetching(true); }
          else               { setInitialLoading(true); }

          const reply = await sendMessage(
            [{ role: 'user', content: JSON.stringify(s) }],
            'care-suggestion',
          );
          if (!active) return;

          const nextCare = parseCare(reply) ?? FALLBACK_CARE;
          setCare(nextCare);
          await saveCache({ signature, care: nextCare, savedAt: Date.now() });
        } catch (err) {
          console.error('[CareSuggestion] 로드 실패:', err);
          setCare((prev) => prev ?? FALLBACK_CARE);
        } finally {
          if (active) { setInitialLoading(false); setRefetching(false); }
        }
      })();
      return () => { active = false; };
    }, []),
  );

  const signals     = useMemo(() => buildSignals(summary), [summary]);
  const displayCare = care ?? FALLBACK_CARE;

  return (
    <GlassCard style={styles.card}>

      {/* ── 헤더 ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={10} color={T.secondary} />
            <Text style={styles.aiBadgeText}>AI 분석</Text>
          </View>
          <Text style={styles.headerTitle}>오늘의 케어</Text>
        </View>
        {refetching && (
          <View style={styles.refetchRow}>
            <ActivityIndicator size="small" color={T.secondary} />
            <Text style={styles.refetchText}>업데이트 중</Text>
          </View>
        )}
      </View>

      {/* ── AI 패턴 요약 ── */}
      {!initialLoading && displayCare.summary ? (
        <Text
          style={styles.aiSummary}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="balanced"
        >
          {displayCare.summary}
        </Text>
      ) : null}

      {/* ── 감지 신호 칩 ── */}
      {signals.length > 0 && !initialLoading ? (
        <View style={styles.signalRow}>
          {signals.map((sig) => (
            <View key={sig} style={styles.signalChip}>
              <View style={styles.signalDot} />
              <Text style={styles.signalText}>{sig}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ── 로딩 ── */}
      {initialLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={T.secondary} />
          <Text style={styles.loadingText}>최근 기록을 분석하고 있어요…</Text>
        </View>
      ) : (
        <>
          {/* 핵심 케어 카드 */}
          <HeroCard data={displayCare.primary} />

          {/* 보조 케어 카드 */}
          <View style={styles.secondaryList}>
            {displayCare.secondary.slice(0, 3).map((card) => (
              <SecondaryCard key={card.category} data={card} />
            ))}
          </View>
        </>
      )}

      {/* 기록 없을 때 */}
      {!initialLoading && summary?.recordCount === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="add-circle-outline" size={16} color={T.secondary} />
          <Text style={styles.emptyText}>통증을 기록하면 더 정확한 케어를 받을 수 있어요.</Text>
        </View>
      ) : null}

      <Text style={styles.disclaimer}>
        일반적인 생활 관리 제안이에요. 통증이 심하거나 길어지면 진료를 받아보세요.
      </Text>
    </GlassCard>
  );
}

// ── 핵심 케어 카드 ─────────────────────────────────────────
function HeroCard({ data }: { data: CardData }) {
  const config = CATEGORY_CONFIG[data.category] ?? CATEGORY_CONFIG.stretch;
  return (
    <View style={styles.heroCard}>
      <LinearGradient
        colors={['rgba(74,144,217,0.36)', 'rgba(36,80,163,0.22)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        {/* 상단 글로우 */}
        <View style={styles.heroShine} />

        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>오늘의 핵심</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <Ionicons name={config.icon as any} size={20} color={T.secondary} />
          </View>
        </View>

        <Text style={styles.heroCategoryLabel}>{config.label}</Text>
        <Text
          style={styles.heroTitle}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="balanced"
        >
          {data.title}
        </Text>
        <Text
          style={styles.heroBody}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="balanced"
        >
          {data.body}
        </Text>

        <Pressable
          style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel={data.cta}
        >
          <Text style={styles.heroCtaText}>{data.cta}</Text>
          <Ionicons name="chevron-forward" size={12} color={T.secondary} />
        </Pressable>
      </LinearGradient>
    </View>
  );
}

// ── 보조 케어 카드 ─────────────────────────────────────────
function SecondaryCard({ data }: { data: CardData }) {
  const config = CATEGORY_CONFIG[data.category] ?? CATEGORY_CONFIG.mind;
  return (
    <View style={styles.secCard}>
      <View style={styles.secIconWrap}>
        <Ionicons name={config.icon as any} size={15} color={T.secondary} />
      </View>
      <View style={styles.secTextWrap}>
        <Text style={styles.secCategory}>{config.label}</Text>
        <Text
          style={styles.secBody}
          lineBreakStrategyIOS="hangul-word"
          textBreakStrategy="balanced"
        >
          {data.body}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.secCta, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={data.cta}
      >
        <Text style={styles.secCtaText}>{data.cta}</Text>
      </Pressable>
    </View>
  );
}

// ── 스타일 ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    gap: 0,
  },

  // 헤더
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    gap: 6,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: T.text,
    letterSpacing: -0.3,
  },
  refetchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refetchText: {
    fontSize: 11,
    fontWeight: '600',
    color: T.secondary,
  },

  // AI 패턴 요약
  aiSummary: {
    fontSize: 13,
    fontWeight: '600',
    color: T.textMuted,
    lineHeight: 19,
    marginBottom: 10,
    letterSpacing: -0.1,
  },

  // 신호 칩
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

  // 로딩
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 16,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.textMuted,
  },

  // ── 핵심 케어 카드 ──
  heroCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.30)',
    marginBottom: 10,
  },
  heroGradient: {
    padding: 16,
  },
  heroShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroBadge: {
    backgroundColor: 'rgba(126,200,227,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.40)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: T.secondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCategoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.secondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: T.text,
    letterSpacing: -0.4,
    lineHeight: 23,
    marginBottom: 6,
  },
  heroBody: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(126,200,227,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.40)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: T.secondary,
    letterSpacing: 0.1,
  },

  // ── 보조 케어 카드 ──
  secondaryList: {
    gap: 8,
  },
  secCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(126,180,220,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.22)',
  },
  secIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(126,200,227,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  secTextWrap: {
    flex: 1,
    gap: 2,
  },
  secCategory: {
    fontSize: 10,
    fontWeight: '800',
    color: T.secondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  secBody: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  secCta: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.25)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexShrink: 0,
  },
  secCtaText: {
    fontSize: 11,
    fontWeight: '700',
    color: T.textMuted,
    letterSpacing: -0.1,
  },

  // 빈 상태
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(126,180,220,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.30)',
  },
  emptyText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: T.textMuted,
    lineHeight: 17,
  },

  // 기타
  disclaimer: {
    marginTop: 14,
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(200,223,239,0.55)',
    lineHeight: 14,
  },
});
