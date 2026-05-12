/**
 * careData.ts
 * 오늘의 케어 기능 공유 데이터 로직
 * CareTeaserCard / CareScreen / CareDetailModal에서 import해서 사용
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendMessage } from './claude';
import { fetchRecentCareSummary, type CareSummary } from './painRecords';

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

// ── 폴백 ───────────────────────────────────────────────────
export const FALLBACK_CARE: ParsedCare = {
  summary: '아직 기록이 부족해서 기본 케어 루틴으로 시작해볼게요.',
  cards: [
    {
      category: 'stretch',
      title: '가벼운 이완',
      preview: '목과 어깨를 천천히 풀어주는 3분 루틴을 추천드려요.',
      cta: '이완하기',
      detail: {
        why: '아직 통증 기록이 충분하지 않아 누구나 부담 없이 할 수 있는 기본 루틴을 준비했어요.',
        recommendation: '무리한 동작보다 목, 어깨, 허리를 천천히 풀어주는 가벼운 이완부터 시작해보세요.',
        steps: [
          '어깨를 앞뒤로 천천히 10번씩 돌리기',
          '목을 좌우로 천천히 기울이며 10초씩 유지하기',
          '허리를 곧게 펴고 깊게 숨 쉬기',
        ],
        apoMessage: '처음부터 무리하지 말고, 몸이 편안해지는 정도만 해도 충분해요.',
      },
    },
    {
      category: 'hydration',
      title: '따뜻한 수분 보충',
      preview: '따뜻한 물 한 컵으로 하루를 가볍게 시작해보세요.',
      cta: '수분 체크',
      detail: {
        why: '수분 섭취는 피로감과 몸의 긴장 완화에 기본이 되는 루틴이에요.',
        recommendation: '오늘은 차가운 음료보다 따뜻한 물이나 무카페인 차를 조금씩 자주 마셔보세요.',
        routine: [
          '아침에 물 한 컵',
          '점심 전후 물 한 컵',
          '저녁에는 카페인 없는 따뜻한 차',
        ],
        avoid: ['늦은 시간 카페인', '당이 많은 음료'],
        apoMessage: '작은 수분 루틴만으로도 몸이 조금 더 편안해질 수 있어요.',
      },
    },
    {
      category: 'nutrition',
      title: '기본 회복 식단',
      preview: '단백질과 마그네슘이 있는 가벼운 식사를 추천드려요.',
      cta: '식단 보기',
      detail: {
        why: '기록이 부족할 때는 부담 없는 회복 식단을 기본으로 추천하는 게 좋아요.',
        recommendation: '오늘은 소화에 부담이 적고 단백질이 포함된 식사를 해보세요.',
        foods: ['계란', '두유', '바나나', '견과류', '따뜻한 국물 음식'],
        avoid: ['과한 당류', '야식', '늦은 카페인'],
        routine: [
          '아침: 바나나 + 두유',
          '점심: 단백질이 있는 따뜻한 식사',
          '저녁: 자극적이지 않은 가벼운 음식',
        ],
        apoMessage: '오늘은 몸을 세게 밀어붙이기보다 천천히 회복하는 쪽이 좋아 보여요.',
      },
    },
    {
      category: 'sleep',
      title: '수면 준비',
      preview: '자기 전 화면과 카페인을 조금 멀리해보세요.',
      cta: '수면 루틴',
      detail: {
        why: '수면은 통증 민감도와 피로 회복에 큰 영향을 줄 수 있어요.',
        recommendation: '오늘은 잠들기 1시간 전부터 화면 밝기를 줄이고 몸을 쉬는 모드로 바꿔보세요.',
        routine: [
          '취침 1시간 전 화면 줄이기',
          '따뜻한 물 마시기',
          '가벼운 호흡 3분',
        ],
        avoid: ['늦은 카페인', '침대에서 오래 스마트폰 보기'],
        apoMessage: '잘 자는 것도 오늘의 중요한 케어예요.',
      },
    },
    {
      category: 'mind',
      title: '마음 안정',
      preview: '짧은 호흡 루틴으로 긴장을 낮춰보세요.',
      cta: '마음 케어',
      detail: {
        why: '마음의 긴장도 몸의 통증 감각에 영향을 줄 수 있어요.',
        recommendation: '잠깐 멈춰서 호흡을 정리하는 시간을 가져보세요.',
        steps: [
          '4초 동안 천천히 들이마시기',
          '2초 멈추기',
          '6초 동안 길게 내쉬기',
          '이 과정을 5번 반복하기',
        ],
        apoMessage: '오늘은 마음도 몸처럼 천천히 쉬게 해주세요.',
      },
    },
  ],
};

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
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return null;

    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    const summary = safeString(parsed?.summary);
    const cardsRaw = Array.isArray(parsed?.cards) ? parsed.cards : [];
    const cards = cardsRaw.map(normalizeCard).filter((c): c is CardData => c !== null);

    const required: CategoryKey[] = ['stretch', 'hydration', 'nutrition', 'sleep', 'mind'];
    const hasAllRequired = required.every((key) => cards.some((card) => card.category === key));

    if (!summary || cards.length === 0 || !hasAllRequired) return null;

    return {
      summary,
      cards: required.map((key) => cards.find((card) => card.category === key)!),
    };
  } catch {
    return null;
  }
}

// ── 캐시 ───────────────────────────────────────────────────
export const CARE_CACHE_KEY = 'naapo:care-suggestion:v4';
export const CARE_PERIOD_DAYS = 7;

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

type CachePayload = {
  signature: string;
  care: ParsedCare;
  savedAt: number;
};

export async function loadCareCache(): Promise<CachePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CARE_CACHE_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw) as CachePayload;
    if (!payload?.signature || !payload?.care?.summary || !Array.isArray(payload?.care?.cards)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function saveCareCache(payload: CachePayload): Promise<void> {
  try {
    await AsyncStorage.setItem(CARE_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

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
- 진단, 치료, 처방처럼 말하지 말 것.
- 의학적 확정 표현 금지.
- "도움이 될 수 있어요", "추천드릴게요" 정도의 부드러운 표현 사용.
- 스트레칭은 사용자가 모르는 전문 동작명을 길게 설명하지 말 것.
- 영양 파트는 가장 구체적으로 작성할 것.
- 사용자가 실제로 오늘 실행할 수 있는 루틴으로 작성할 것.
- 한국어로 작성할 것.
- 반드시 JSON만 출력할 것. markdown 금지.

사용자 기본 정보 (보조 참고용):
${buildProfileContext(profile)}
주의: 연령·성별은 루틴 강도·식단 조정에만 미세하게 참고하세요.
성별 고정관념 없이, 개인의 통증·수면·감정 기록을 핵심 기준으로 사용하세요.

최근 ${CARE_PERIOD_DAYS}일 기록 요약 (핵심 기준):
${JSON.stringify(summary, null, 2)}

반드시 아래 JSON 형식으로만 답해줘:

{
  "summary": "최근 기록을 바탕으로 한 짧은 AI 분석 요약. 기록이 없으면 기본 루틴 안내.",
  "cards": [
    {
      "category": "stretch",
      "title": "스트레칭 제목",
      "preview": "카드에 보일 짧은 미리보기",
      "cta": "버튼 문구",
      "detail": {
        "why": "왜 이 추천을 하는지",
        "recommendation": "오늘의 핵심 추천",
        "steps": ["간단한 실행 방법 1", "간단한 실행 방법 2", "간단한 실행 방법 3"],
        "apoMessage": "아포의 짧은 한마디"
      }
    },
    {
      "category": "hydration",
      "title": "수분 제목",
      "preview": "카드에 보일 짧은 미리보기",
      "cta": "버튼 문구",
      "detail": {
        "why": "왜 이 추천을 하는지",
        "recommendation": "오늘의 핵심 추천",
        "routine": ["수분 루틴 1", "수분 루틴 2", "수분 루틴 3"],
        "avoid": ["피하면 좋은 것 1", "피하면 좋은 것 2"],
        "apoMessage": "아포의 짧은 한마디"
      }
    },
    {
      "category": "nutrition",
      "title": "영양 제목",
      "preview": "카드에 보일 짧은 미리보기",
      "cta": "버튼 문구",
      "detail": {
        "why": "왜 이 식단을 추천하는지",
        "recommendation": "오늘의 식단 방향",
        "foods": ["추천 음식 1", "추천 음식 2", "추천 음식 3", "추천 음식 4"],
        "avoid": ["피하면 좋은 음식 1", "피하면 좋은 음식 2"],
        "routine": ["아침 추천", "점심 추천", "저녁 추천"],
        "apoMessage": "아포의 짧은 한마디"
      }
    },
    {
      "category": "sleep",
      "title": "수면 제목",
      "preview": "카드에 보일 짧은 미리보기",
      "cta": "버튼 문구",
      "detail": {
        "why": "왜 이 추천을 하는지",
        "recommendation": "오늘의 수면 루틴 방향",
        "routine": ["수면 루틴 1", "수면 루틴 2", "수면 루틴 3"],
        "avoid": ["피하면 좋은 것 1", "피하면 좋은 것 2"],
        "apoMessage": "아포의 짧은 한마디"
      }
    },
    {
      "category": "mind",
      "title": "마음 제목",
      "preview": "카드에 보일 짧은 미리보기",
      "cta": "버튼 문구",
      "detail": {
        "why": "왜 이 추천을 하는지",
        "recommendation": "오늘의 마음 케어 방향",
        "steps": ["실행 방법 1", "실행 방법 2", "실행 방법 3"],
        "apoMessage": "아포의 짧은 한마디"
      }
    }
  ]
}
`.trim();
}

// ── 통합 fetch ─────────────────────────────────────────────
export async function fetchCareData(
  profile?: CareProfile | null,
): Promise<{ summary: CareSummary; care: ParsedCare }> {
  const summary = await fetchRecentCareSummary(CARE_PERIOD_DAYS);
  const signature = makeSignature(summary, profile);

  const cached = await loadCareCache();
  if (cached && cached.signature === signature) {
    return { summary, care: cached.care };
  }

  const prompt = buildCarePrompt(summary, profile);

  const reply = await sendMessage(
    [{ role: 'user', content: prompt }],
    'care-suggestion',
  );

  const care = parseCare(reply) ?? FALLBACK_CARE;

  await saveCareCache({
    signature,
    care,
    savedAt: Date.now(),
  });

  return { summary, care };
}