/**
 * careData.ts
 * 오늘의 케어 기능의 공유 데이터 로직
 * CareTeaserCard(홈) / CareScreen(전체 화면) 양쪽에서 import해서 사용
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendMessage } from './claude';
import { fetchRecentCareSummary, type CareSummary } from './painRecords';

export type { CareSummary };

// ── 카테고리 ───────────────────────────────────────────────
export type CategoryKey = 'stretch' | 'nutrition' | 'sleep' | 'mind';

export const CATEGORY_CONFIG: Record<CategoryKey, { icon: string; label: string; description: string }> = {
  stretch:   { icon: 'body-outline',    label: '스트레칭',  description: '자세와 근육 케어' },
  nutrition: { icon: 'water-outline',   label: '수분·영양', description: '수분과 영양 관리' },
  sleep:     { icon: 'moon-outline',    label: '수면',      description: '수면 습관 개선'  },
  mind:      { icon: 'heart-outline',   label: '마음',      description: '심리적 안정 케어' },
};

export function isCategoryKey(v: string): v is CategoryKey {
  return v in CATEGORY_CONFIG;
}

// ── 데이터 타입 ────────────────────────────────────────────
export type CardData = {
  category: CategoryKey;
  title: string;
  body: string;
  cta: string;
};

export type ParsedCare = {
  summary: string;
  primary: CardData;
  secondary: CardData[];
};

// ── 폴백 ───────────────────────────────────────────────────
export const FALLBACK_CARE: ParsedCare = {
  summary: '오늘 하루를 위한 기본 케어 루틴을 준비했어요.',
  primary: {
    category: 'stretch',
    title: '목·어깨 이완',
    body: '고양이-낙타 자세 10회 3세트와 어깨 돌리기 앞뒤 각 10회로 굳은 근육을 풀어보세요.',
    cta: '스트레칭',
  },
  secondary: [
    { category: 'nutrition', title: '수분·영양', body: '물 2L 목표로 매 시간 한 컵씩, 바나나나 아몬드 한 줌으로 마그네슘을 보충해보세요.', cta: '수분 체크' },
    { category: 'sleep',     title: '수면 루틴', body: '자정 전에 눕고, 잠들기 1시간 전부터 카페인과 스마트폰을 끊는 루틴을 시작해보세요.', cta: '수면 루틴' },
    { category: 'mind',      title: '마음 챙김', body: '4초 들숨·6초 날숨 복식 호흡을 5분, 또는 바깥을 10분 가볍게 걸어보세요.', cta: '마음 챙김' },
  ],
};

// ── 파서 ───────────────────────────────────────────────────
/**
 * AI 출력 형식:
 * SUMMARY: [요약]
 * PRIMARY: [카테고리] | [제목] | [본문] | [CTA]
 * CARD: ...
 */
export function parseCare(raw: string): ParsedCare | null {
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
    if (line.startsWith('SUMMARY:'))        summary = line.slice('SUMMARY:'.length).trim();
    else if (line.startsWith('PRIMARY:'))   primary = parseCard(line, 'PRIMARY:');
    else if (line.startsWith('CARD:'))      { const c = parseCard(line, 'CARD:'); if (c) secondary.push(c); }
  }

  if (!summary || !primary || secondary.length === 0) return null;
  return { summary, primary, secondary };
}

// ── 캐시 ───────────────────────────────────────────────────
export const CARE_CACHE_KEY   = 'naapo:care-suggestion:v3';
export const CARE_PERIOD_DAYS = 7;

export function makeSignature(s: CareSummary): string {
  return [
    s.periodDays, s.recordCount, s.topBodyPart ?? '',
    s.topBodyPartCount, s.avgIntensity, s.highIntensityDays,
    s.avgSleepHours ?? '', s.shortSleepDays,
    s.emotionGood, s.emotionNormal, s.emotionBad,
    s.painTypes.join(','),
  ].join('|');
}

type CachePayload = { signature: string; care: ParsedCare; savedAt: number };

export async function loadCareCache(): Promise<CachePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CARE_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CachePayload;
    if (!p?.signature || !p?.care?.primary) return null;
    return p;
  } catch { return null; }
}

export async function saveCareCache(payload: CachePayload): Promise<void> {
  try { await AsyncStorage.setItem(CARE_CACHE_KEY, JSON.stringify(payload)); } catch {}
}

// ── 신호 칩 ────────────────────────────────────────────────
export function buildSignals(s: CareSummary | null): string[] {
  if (!s || s.recordCount === 0) return [];
  const out: string[] = [];
  if (s.topBodyPart && s.topBodyPartCount >= 3)    out.push(`${s.topBodyPart} 통증 반복`);
  if (s.highIntensityDays >= 2)                    out.push('통증 강도 높음');
  if (s.shortSleepDays >= 3 || (s.avgSleepHours != null && s.avgSleepHours < 6)) out.push('수면 부족 경향');
  if (s.emotionBad >= 2 && s.emotionBad >= s.emotionGood) out.push('스트레스 증가');
  if (out.length === 0 && s.painTypes.length > 0)  out.push(`${s.painTypes[0]} 패턴 지속`);
  return out.slice(0, 3);
}

// ── 카테고리별 AI 인사이트 ─────────────────────────────────
export function getInsight(s: CareSummary | null, category: CategoryKey): string {
  if (!s || s.recordCount === 0) return '꾸준한 케어로 건강을 유지해 보세요.';

  switch (category) {
    case 'stretch':
      if (s.topBodyPart && s.topBodyPartCount >= 3)
        return `최근 ${s.topBodyPart} 기록이 자주 보여요.`;
      if (s.highIntensityDays >= 2) return '최근 통증 강도가 높아졌어요.';
      return '자세 교정으로 통증을 예방해 보세요.';

    case 'nutrition':
      if (s.shortSleepDays >= 3)                                      return '수면 부족일 때 수분이 더 중요해요.';
      if (s.highIntensityDays >= 2)                                    return '통증이 있을 때 충분한 수분이 도움이 돼요.';
      return '오늘 수분 섭취를 한번 점검해 보세요.';

    case 'sleep':
      if (s.shortSleepDays >= 3)                                       return '최근 수면 부족 패턴이 보여요.';
      if (s.avgSleepHours != null && s.avgSleepHours < 6.5)           return '평균 수면이 조금 부족한 편이에요.';
      return '좋은 수면 습관이 통증 회복을 도와요.';

    case 'mind':
      if (s.emotionBad >= 2 && s.emotionBad >= s.emotionGood)         return '최근 스트레스 기록이 조금 늘었어요.';
      return '마음의 여유가 몸의 회복을 도와요.';
  }
}

// ── 통합 fetch (캐시 우선) ─────────────────────────────────
/**
 * DB에서 summary를 가져오고, 캐시 hit이면 AI 호출 없이 반환.
 * 캐시 miss이면 Claude API 호출 후 캐시 저장.
 */
export async function fetchCareData(): Promise<{ summary: CareSummary; care: ParsedCare }> {
  const s         = await fetchRecentCareSummary(CARE_PERIOD_DAYS);
  const signature = makeSignature(s);

  const cached = await loadCareCache();
  if (cached && cached.signature === signature) {
    return { summary: s, care: cached.care };
  }

  const reply = await sendMessage(
    [{ role: 'user', content: JSON.stringify(s) }],
    'care-suggestion',
  );
  const care = parseCare(reply) ?? FALLBACK_CARE;
  await saveCareCache({ signature, care, savedAt: Date.now() });
  return { summary: s, care };
}
