/**
 * careData.ts
 * 오늘의 케어 기능 공유 데이터 로직
 * CareTeaserCard / CareScreen / CareDetailModal에서 import해서 사용
 */

import { sendMessage } from './claude';
import {
  fetchRecentCareSummary,
  fetchTodayPainRecords,
  type CareSummary,
} from './painRecords';
import {
  createPainRecordSignature,
  getCachedTodayCare,
  saveCachedTodayCare,
} from './todayCareCache';

export type { CareSummary };

// ── 사용자 프로필 ───────────────────────────────────────────
export type CareProfile = {
  birthYear?: number | null;
  gender?: 'male' | 'female' | 'none' | null;
};

// ── 카테고리 ───────────────────────────────────────────────
export type CategoryKey = 'stretch' | 'hydration' | 'nutrition' | 'sleep' | 'mind';

export const CATEGORY_CONFIG: Record<
  CategoryKey,
  { icon: string; label: string; description: string }
> = {
  stretch: {
    icon: 'body-outline',
    label: '스트레칭',
    description: '가벼운 이완 케어',
  },
  hydration: {
    icon: 'water-outline',
    label: '수분',
    description: '수분 섭취 관리',
  },
  nutrition: {
    icon: 'restaurant-outline',
    label: '영양',
    description: '맞춤 식단 추천',
  },
  sleep: {
    icon: 'moon-outline',
    label: '수면',
    description: '수면 루틴 개선',
  },
  mind: {
    icon: 'heart-outline',
    label: '마음',
    description: '심리적 안정 케어',
  },
};

export function isCategoryKey(v: string): v is CategoryKey {
  return v in CATEGORY_CONFIG;
}

// ── 데이터 타입 ────────────────────────────────────────────
export type CareDetail = {
  why: string;
  recommendation: string;
  steps?: string[];
  foods?: string[];
  avoid?: string[];
  routine?: string[];
  apoMessage: string;
};

export type CardData = {
  category: CategoryKey;
  title: string;
  preview: string;
  cta: string;
  detail: CareDetail;
};

export type ParsedCare = {
  summary: string;
  cards: CardData[];
};

function buildLocalCareFromSummary(summary: CareSummary): ParsedCare {
  const part = summary.topBodyPart ?? '몸';
  const hasSleepIssue =
    summary.shortSleepDays >= 1 ||
    (summary.avgSleepHours != null && summary.avgSleepHours < 6);

  const hasStress = summary.emotionBad >= 1;
  const hasHighPain = summary.highIntensityDays >= 1;

  return {
    summary:
      summary.recordCount > 0
        ? `최근 ${summary.periodDays}일 동안 ${part} 통증 기록이 보여요. 오늘은 회복과 긴장 완화 중심으로 케어를 준비했어요.`
        : '아직 기록이 부족해서 기본 케어 루틴으로 시작해볼게요.',
    cards: [
      {
        category: 'stretch',
        title: `${part} 긴장 완화`,
        preview: `${part} 주변을 가볍게 풀어주는 짧은 이완 루틴이에요.`,
        cta: '가볍게 풀기',
        detail: {
          why: `최근 ${part} 관련 기록이 있어 무리하지 않는 이완 루틴을 추천드려요.`,
          recommendation: '전문 동작보다 목·어깨·허리를 천천히 풀어주는 가벼운 움직임부터 시작해보세요.',
          steps: ['어깨 천천히 돌리기', '목 좌우로 가볍게 기울이기'],
          apoMessage: '아픈 부위를 억지로 움직이지 말고 편안한 범위에서만 해주세요.',
        },
      },
      {
        category: 'hydration',
        title: '수분 보충',
        preview: hasSleepIssue
          ? '수면 부족이 있어 따뜻한 수분 보충을 추천드려요.'
          : '오늘은 물을 조금씩 자주 마셔보세요.',
        cta: '수분 체크',
        detail: {
          why: hasSleepIssue
            ? '수면이 부족할 때는 몸이 더 쉽게 피로해질 수 있어요.'
            : '수분 섭취는 기본적인 컨디션 관리에 도움이 될 수 있어요.',
          recommendation: '차가운 음료보다 따뜻한 물이나 무카페인 차를 추천드려요.',
          routine: ['아침 물 한 컵', '점심 전후 물 한 컵'],
          avoid: ['늦은 카페인', '당이 많은 음료'],
          apoMessage: '작게 자주 마시는 게 좋아요.',
        },
      },
      {
        category: 'nutrition',
        title: '오늘의 회복 식단',
        preview: '단백질과 마그네슘이 있는 가벼운 식단을 추천드려요.',
        cta: '식단 보기',
        detail: {
          why: hasHighPain
            ? '통증 강도가 높은 기록이 있어 회복 중심 식사가 좋아 보여요.'
            : '몸에 부담이 적은 영양 루틴으로 컨디션을 도와볼게요.',
          recommendation: '오늘은 자극적인 음식보다 따뜻하고 단백질이 있는 식사를 추천드려요.',
          foods: ['계란', '두유', '바나나', '견과류'],
          avoid: ['늦은 카페인', '과한 당류'],
          routine: ['아침: 바나나 + 두유', '저녁: 따뜻한 단백질 식사'],
          apoMessage: '오늘은 몸을 세게 밀어붙이기보다 회복 쪽으로 가보면 좋아요.',
        },
      },
      {
        category: 'sleep',
        title: '수면 회복',
        preview: hasSleepIssue
          ? '최근 수면 부족 기록이 보여요.'
          : '오늘은 수면 리듬을 가볍게 정리해보세요.',
        cta: '수면 루틴',
        detail: {
          why: hasSleepIssue
            ? '수면 부족은 통증 민감도와 피로감에 영향을 줄 수 있어요.'
            : '좋은 수면 루틴은 몸의 회복에 도움이 될 수 있어요.',
          recommendation: '잠들기 전 화면 밝기를 줄이고 몸을 쉬는 모드로 바꿔보세요.',
          routine: ['자기 전 화면 줄이기', '가벼운 호흡 3분'],
          avoid: ['늦은 카페인', '침대에서 오래 스마트폰 보기'],
          apoMessage:
            '수면도 회복을 돕는 한 가지예요. 무리 없이 리듬만 가볍게 맞춰가도 좋아요.',
        },
      },
      {
        category: 'mind',
        title: '마음 안정',
        preview: hasStress
          ? '스트레스 기록이 있어 짧은 안정 루틴을 추천드려요.'
          : '잠깐 멈춰서 호흡을 정리해보세요.',
        cta: '마음 케어',
        detail: {
          why: hasStress
            ? '스트레스가 몸의 긴장감과 함께 나타날 수 있어요.'
            : '마음의 여유가 몸의 회복에도 도움이 될 수 있어요.',
          recommendation: '짧은 호흡 루틴으로 몸과 마음을 같이 낮춰보세요.',
          steps: ['4초 들이마시기', '6초 천천히 내쉬기'],
          apoMessage: '오늘은 조금 느리게 가도 괜찮아요.',
        },
      },
    ],
  };
}

const EMPTY_CARE_SUMMARY: CareSummary = {
  periodDays: 7,
  recordCount: 0,
  topBodyPart: null,
  topBodyPartCount: 0,
  avgIntensity: 0,
  highIntensityDays: 0,
  avgSleepHours: null,
  shortSleepDays: 0,
  emotionGood: 0,
  emotionNormal: 0,
  emotionBad: 0,
  painTypes: [],
};

/** 기록이 없을 때 사용하는 정적 폴백 (카드 보충·에러 시 공통) */
export const FALLBACK_CARE: ParsedCare = buildLocalCareFromSummary(EMPTY_CARE_SUMMARY);

// ── JSON 파서 ──────────────────────────────────────────────
function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;
}

function safeStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return arr.length > 0 ? arr.map((x) => x.trim()) : undefined;
}

function normalizeCard(raw: any): CardData | null {
  const category = safeString(raw?.category);
  if (!isCategoryKey(category)) return null;

  const detailRaw = raw?.detail ?? {};

  return {
    category,
    title: safeString(raw?.title, CATEGORY_CONFIG[category].label),
    preview: safeString(raw?.preview, CATEGORY_CONFIG[category].description),
    cta: safeString(raw?.cta, '자세히 보기'),
    detail: {
      why: safeString(detailRaw?.why, '최근 기록을 바탕으로 오늘의 케어를 준비했어요.'),
      recommendation: safeString(
        detailRaw?.recommendation,
        '오늘은 몸에 부담이 적은 루틴부터 가볍게 시작해보세요.',
      ),
      steps: safeStringArray(detailRaw?.steps),
      foods: safeStringArray(detailRaw?.foods),
      avoid: safeStringArray(detailRaw?.avoid),
      routine: safeStringArray(detailRaw?.routine),
      apoMessage: safeString(detailRaw?.apoMessage, '오늘도 무리하지 말고 천천히 케어해봐요.'),
    },
  };
}

export function parseCare(raw: string): ParsedCare | null {
  try {
    if (!raw || typeof raw !== 'string') return null;

    const cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return null;

    const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));

    const summary = safeString(parsed?.summary);
    const cardsRaw: unknown[] = Array.isArray(parsed?.cards) ? parsed.cards : [];
    const parsedCards = cardsRaw
      .map((raw) => normalizeCard(raw))
      .filter((c): c is CardData => c !== null);

    if (!summary || parsedCards.length === 0) return null;

    const required: CategoryKey[] = ['stretch', 'hydration', 'nutrition', 'sleep', 'mind'];

    // 빠진 카테고리는 fallback에서 보충
    const cards = required.map((key) => {
      return (
        parsedCards.find((card: CardData) => card.category === key) ??
        FALLBACK_CARE.cards.find((card: CardData) => card.category === key)!
      );
    });

    return {
      summary,
      cards,
    };
  } catch (e) {
    console.warn('[CARE] parseCare error:', e);
    return null;
  }
}

// ── 캐시 (날짜 키 + 오늘 pain_records 시그니처 — lib/todayCareCache.ts) ──
export const CARE_PRIMARY_PERIOD_DAYS = 7;
export const CARE_FALLBACK_PERIOD_DAYS = 30;

export function makeSignature(s: CareSummary, profile?: CareProfile | null): string {
  return [
    profile?.birthYear ?? '',
    profile?.gender ?? '',
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

export type FetchCareOptions = {
  forceRefresh?: boolean;
};

/** 동시 호출(StrictMode·복수 컴포넌트) 시 한 번만 네트워크·Claude 호출 */
let fetchCareDataNormalInFlight: Promise<{ summary: CareSummary; care: ParsedCare }> | null = null;

// ── 신호 칩 ────────────────────────────────────────────────
export function buildSignals(s: CareSummary | null): string[] {
  if (!s || s.recordCount === 0) return [];

  const out: string[] = [];

  if (s.topBodyPart && s.topBodyPartCount >= 3) {
    out.push(`${s.topBodyPart} 통증 반복`);
  }

  if (s.highIntensityDays >= 2) {
    out.push('통증 강도 높음');
  }

  if (s.shortSleepDays >= 3 || (s.avgSleepHours != null && s.avgSleepHours < 6)) {
    out.push('수면 부족 경향');
  }

  if (s.emotionBad >= 2 && s.emotionBad >= s.emotionGood) {
    out.push('스트레스 증가');
  }

  if (out.length === 0 && s.painTypes.length > 0) {
    out.push(`${s.painTypes[0]} 패턴 지속`);
  }

  return out.slice(0, 3);
}

// ── 카테고리별 인사이트 ────────────────────────────────────
export function getInsight(s: CareSummary | null, category: CategoryKey): string {
  if (!s || s.recordCount === 0) {
    return '기록이 쌓이면 더 정확한 맞춤 케어를 받을 수 있어요.';
  }

  switch (category) {
    case 'stretch':
      if (s.topBodyPart && s.topBodyPartCount >= 3) {
        return `최근 ${s.topBodyPart} 기록이 자주 보여요.`;
      }
      if (s.highIntensityDays >= 2) return '최근 통증 강도가 높은 날이 있었어요.';
      return '가벼운 이완으로 몸의 긴장을 낮춰보세요.';

    case 'hydration':
      if (s.shortSleepDays >= 3) return '수면이 부족한 날에는 수분 관리가 더 중요해요.';
      if (s.highIntensityDays >= 2) return '통증이 높았던 날이 있어 몸을 부드럽게 케어해볼게요.';
      return '오늘의 수분 섭취를 가볍게 점검해보세요.';

    case 'nutrition':
      if (s.shortSleepDays >= 3) return '최근 수면 부족 경향을 고려해 회복 식단을 추천드려요.';
      if (s.emotionBad >= 2) return '스트레스 기록을 고려해 자극이 적은 식사를 추천드려요.';
      return '오늘 몸에 부담이 적은 영양 루틴을 준비했어요.';

    case 'sleep':
      if (s.shortSleepDays >= 3) return '최근 수면 부족 패턴이 보여요.';
      if (s.avgSleepHours != null && s.avgSleepHours < 6.5) {
        return '평균 수면 시간이 조금 부족한 편이에요.';
      }
      return '좋은 수면 루틴은 통증 회복에도 도움이 돼요.';

    case 'mind':
      if (s.emotionBad >= 2 && s.emotionBad >= s.emotionGood) {
        return '최근 마음이 무거웠던 기록이 조금 보여요.';
      }
      return '마음의 여유가 몸의 회복을 도와줄 수 있어요.';
  }
}

// ── 프로필 → 자연어 변환 ───────────────────────────────────
function buildProfileContext(profile?: CareProfile | null): string {
  if (!profile?.birthYear && !profile?.gender) return '(기본 정보 없음)';

  const lines: string[] = [];

  if (profile.birthYear) {
    const age = new Date().getFullYear() - profile.birthYear;
    const decade = Math.floor(age / 10) * 10;
    const sub = age % 10 < 5 ? '초반' : '후반';
    const ageGroup = age < 20 ? '10대' : age >= 70 ? '70대 이상' : `${decade}대 ${sub}`;
    lines.push(`- 연령대: ${ageGroup}`);
  }

  if (profile.gender && profile.gender !== 'none') {
    const label = profile.gender === 'male' ? '남성' : '여성';
    lines.push(`- 성별: ${label}`);
  }

  return lines.join('\n');
}

// ── Claude 요청 프롬프트 ───────────────────────────────────
function buildCarePrompt(summary: CareSummary, profile?: CareProfile | null): string {
  return `
너는 감성 헬스케어 앱 "나아포"의 AI 케어 코치야.
사용자의 최근 통증 기록과 기본 정보를 바탕으로 "오늘의 맞춤 케어"를 생성해줘.

중요한 원칙:
- 앱에서는 기록 패턴 분석 결과 한 장의 카드에만 "오늘의 핵심" 배지가 붙습니다. 다른 카테고리(sleep, hydration 등)의 detail.apoMessage에는 "오늘의 핵심", "회복 루틴의 핵심", "가장 중요한 케어", "~의 핵심으로" 같은 표현을 쓰지 말 것. 보조 루틴으로 짧고 따뜻하게.
- 진단, 치료, 처방처럼 말하지 말 것.
- 의학적 확정 표현 금지.
- "도움이 될 수 있어요", "추천드릴게요" 정도의 부드러운 표현 사용.
- 스트레칭은 사용자가 모르는 전문 동작명을 길게 설명하지 말 것.
- 영양 파트는 가장 구체적으로 작성할 것.
- 사용자가 실제로 오늘 실행할 수 있는 루틴으로 작성할 것.
- 한국어로 작성할 것.
- 반드시 순수 JSON 객체만 출력할 것.
- markdown, 설명문, 코드블록을 절대 사용하지 말 것.
- \`\`\`json 또는 \`\`\` 같은 코드블록을 절대 사용하지 말 것.
- cards 배열에는 반드시 아래 5개 category를 모두 포함할 것:
  stretch, hydration, nutrition, sleep, mind
- category 값은 반드시 위 5개 중 하나만 사용할 것.
- cards 배열 순서는 반드시 stretch, hydration, nutrition, sleep, mind 순서로 작성할 것.
- 각 텍스트 필드는 1문장으로 제한해.
- 각 배열은 최대 2개 항목만 작성해.
- 전체 응답은 1800자 이내로 작성해.

사용자 기본 정보 (보조 참고용):
${buildProfileContext(profile)}
주의: 연령·성별은 루틴 강도·식단 조정에만 미세하게 참고하세요.
성별 고정관념 없이, 개인의 통증·수면·감정 기록을 핵심 기준으로 사용하세요.

최근 ${summary.periodDays}일 기록 요약 (핵심 기준):
${JSON.stringify(summary, null, 2)}

반드시 아래 구조의 순수 JSON만 출력해.
markdown, 코드블록, 설명문 금지.
문장은 짧게 작성해.
각 배열은 최대 2개 항목만 작성해.

{
  "summary": "string",
  "cards": [
    {
      "category": "stretch",
      "title": "string",
      "preview": "string",
      "cta": "string",
      "detail": {
        "why": "string",
        "recommendation": "string",
        "steps": ["string", "string"],
        "apoMessage": "string"
      }
    },
    {
      "category": "hydration",
      "title": "string",
      "preview": "string",
      "cta": "string",
      "detail": {
        "why": "string",
        "recommendation": "string",
        "routine": ["string", "string"],
        "avoid": ["string"],
        "apoMessage": "string"
      }
    },
    {
      "category": "nutrition",
      "title": "string",
      "preview": "string",
      "cta": "string",
      "detail": {
        "why": "string",
        "recommendation": "string",
        "foods": ["string", "string"],
        "avoid": ["string"],
        "routine": ["string", "string"],
        "apoMessage": "string"
      }
    },
    {
      "category": "sleep",
      "title": "string",
      "preview": "string",
      "cta": "string",
      "detail": {
        "why": "string",
        "recommendation": "string",
        "routine": ["string", "string"],
        "avoid": ["string"],
        "apoMessage": "string"
      }
    },
    {
      "category": "mind",
      "title": "string",
      "preview": "string",
      "cta": "string",
      "detail": {
        "why": "string",
        "recommendation": "string",
        "steps": ["string", "string"],
        "apoMessage": "string"
      }
    }
  ]
}
`.trim();
}

async function loadCareDataCore(
  profile?: CareProfile | null,
  options?: FetchCareOptions,
): Promise<{ summary: CareSummary; care: ParsedCare }> {
  const forceRefresh = options?.forceRefresh ?? false;

  const todayPainRecords = await fetchTodayPainRecords();
  const painSignature = createPainRecordSignature(todayPainRecords);

  let summary = await fetchRecentCareSummary(CARE_PRIMARY_PERIOD_DAYS);

  if (summary.recordCount === 0) {
    console.log('[CARE] no recent 7-day records — trying 30-day fallback');

    const fallbackSummary = await fetchRecentCareSummary(CARE_FALLBACK_PERIOD_DAYS);

    if (fallbackSummary.recordCount > 0) {
      console.log('[CARE] using 30-day personalized care fallback');
      summary = fallbackSummary;
    }
  }

  console.log('[CARE] recordCount:', summary.recordCount);
  console.log('[CARE] today pain signature:', painSignature);

  if (!forceRefresh) {
    const cachedCare = await getCachedTodayCare<ParsedCare>(painSignature);
    if (cachedCare) {
      console.log('[CARE] today-care cache HIT — skipping Claude');
      return { summary, care: cachedCare };
    }
  }

  if (summary.recordCount === 0) {
    console.log('[CARE] absolutely no records — using FALLBACK_CARE');

    return {
      summary,
      care: FALLBACK_CARE,
    };
  }

  console.log('[CARE] today-care cache MISS — calling Claude');

  try {
    const prompt = buildCarePrompt(summary, profile);

    const reply = await sendMessage(
      [{ role: 'user', content: prompt }],
      'care-suggestion',
    );

    const care = parseCare(reply);

    if (care) {
      console.log('[CARE] Claude parse OK — caching and returning');

      await saveCachedTodayCare(care, painSignature);

      return { summary, care };
    }

    console.warn(
      '[CARE] Claude parse FAILED — using local personalized care instead. Raw reply:',
      reply?.slice(0, 200),
    );

    const localCare = buildLocalCareFromSummary(summary);
    await saveCachedTodayCare(localCare, painSignature);

    return {
      summary,
      care: localCare,
    };
  } catch (error) {
    console.warn('[CARE] Claude request FAILED — using local personalized care instead:', error);

    const localCare = buildLocalCareFromSummary(summary);
    await saveCachedTodayCare(localCare, painSignature);

    return {
      summary,
      care: localCare,
    };
  }
}

// ── 통합 fetch ─────────────────────────────────────────────
export async function fetchCareData(
  profile?: CareProfile | null,
  options?: FetchCareOptions,
): Promise<{ summary: CareSummary; care: ParsedCare }> {
  const forceRefresh = options?.forceRefresh ?? false;

  if (forceRefresh) {
    return loadCareDataCore(profile, options);
  }

  if (!fetchCareDataNormalInFlight) {
    fetchCareDataNormalInFlight = loadCareDataCore(profile, options).finally(() => {
      fetchCareDataNormalInFlight = null;
    });
  }

  return fetchCareDataNormalInFlight;
}