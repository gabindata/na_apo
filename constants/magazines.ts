import type { ImageSourcePropType } from 'react-native';

// ── 콘텐츠 블록 타입 ─────────────────────────────────────────────────────────
export type MagazineBlock =
  | { type: 'image'; source: ImageSourcePropType; aspectRatio?: number }
  | { type: 'heading'; text: string }
  | { type: 'body'; text: string }
  | { type: 'tips'; items: string[] }
  | { type: 'divider' }
  | { type: 'highlight'; text: string };

export type Magazine = {
  id: string;
  title: string;
  subtitle: string;
  tags: string[];
  content: MagazineBlock[];
};

// ── 매거진 콘텐츠 ─────────────────────────────────────────────────────────────
export const MAGAZINES: Magazine[] = [
  {
    id: 'weather-joint',
    title: '비 오는 날 관절이 더 아픈 이유?',
    subtitle: '기압과 통증의 관계를 알아봐요',
    tags: ['무릎', '허리', '손목', '어깨', '관절'],
    content: [
      {
        type: 'image',
        source: require('../assets/magazines/m1_c1.jpg'),
        aspectRatio: 1,
      },
      {
        type: 'body',
        text: '창밖에 비가 내리는 날이면 "오늘은 유독 무릎이 쑤신다"거나 "허리가 뻐근하다"는 느낌을 받는 사람들이 많습니다. 실제로 날씨 변화는 몸의 통증과 꽤 밀접한 관련이 있다고 알려져 있어요.',
      },
      { type: 'divider' },
      { type: 'heading', text: '기압 변화 때문이에요 🌀' },
      {
        type: 'body',
        text: '비가 오기 전에는 대기압, 즉 \'기압\'이 낮아지는 경우가 많습니다. 기압이 낮아지면 우리 몸의 조직이 평소보다 조금 팽창하게 되고, 이 과정에서 관절 주변 신경을 자극해 통증이 더 크게 느껴질 수 있어요.',
      },
      {
        type: 'body',
        text: '특히 무릎 관절, 허리, 손목, 어깨 같은 부위에서 불편함을 느끼는 경우가 많습니다.',
      },
      { type: 'divider' },
      { type: 'heading', text: '습도와 온도도 영향을 줘요 🌧' },
      {
        type: 'body',
        text: '비 오는 날은 습도가 높고 몸이 쉽게 굳기 쉬운 환경이 됩니다. 근육과 인대가 긴장하면 몸이 뻣뻣해지고, 혈액순환이 둔해지며, 기존 통증이 더 예민하게 느껴질 수 있어요. 평소 목이나 어깨가 자주 뭉치는 사람이라면 특히 영향을 크게 받을 수 있습니다.',
      },
      { type: 'divider' },
      { type: 'heading', text: '통증이 심한 날, 이렇게 관리해보세요' },
      {
        type: 'image',
        source: require('../assets/magazines/m1_c2.png'),
        aspectRatio: 1,
      },
      {
        type: 'tips',
        items: [
          '몸을 따뜻하게 유지하기\n온찜질이나 따뜻한 샤워는 근육 긴장을 완화하는 데 도움이 될 수 있어요.',
          '가볍게 움직이기\n오히려 너무 오래 가만히 있으면 몸이 더 굳을 수 있습니다. 짧은 스트레칭이나 가벼운 산책 정도가 좋아요.',
          '미지근한 물 충분히 마시기\n수분은 연골과 힘줄, 인대 등 관절 조직의 건강을 유지해줘요.',
          '수면 챙기기\n수면 부족은 통증에 대한 민감도를 올릴 뿐만 아니라 몸의 회복을 방해해요. 매일 7~8시간의 규칙적인 수면을 해봅시다.',
        ],
      },
      { type: 'divider' },
      {
        type: 'highlight',
        text: '비 오는 날 통증이 심해지는 건 이상한 일이 아닐 수 있습니다. 다만 통증이 너무 심하거나 일상생활이 어려울 정도라면 병원 진료를 꼭 받아야 해요.\n\n작은 통증도 기록해두면 몸의 패턴을 이해하는 데 도움이 될 수 있습니다.\n',
      },
    ],
  },
  {
    id: 'sleep-pain',
    title: '수면 부족이 통증을 심하게 만드는 이유',
    subtitle: '잠이 부족하면 민감도가 올라가요',
    tags: [],
    content: [
      {
        type: 'image',
        source: require('../assets/magazines/m2_c1.png'),
        aspectRatio: 1,
      },
      {
        type: 'body',
        text: '"잠을 제대로 못 자면 몸이 더 아픈 느낌이 들어요." 실제로 수면과 통증은 서로 깊게 연결되어 있습니다. 잠이 부족하면 몸의 회복 능력이 떨어지고, 평소보다 통증에 더 민감해질 수 있어요.',
      },
      { type: 'divider' },
      { type: 'heading', text: '잠이 부족하면 왜 더 아플까?' },
      {
        type: 'image',
        source: require('../assets/magazines/m2_c2.png'),
        aspectRatio: 1.5,
      },
      {
        type: 'body',
        text: '우리 몸은 자는 동안 회복을 진행합니다. 특히 깊은 수면 상태에서는 근육 회복, 염증 조절, 신경 안정, 에너지 회복 같은 과정이 활발하게 이루어져요. 하지만 수면 시간이 부족하거나 깊게 자지 못하면 몸이 충분히 회복되지 못하고, 결국 작은 통증도 더 크게 느껴질 수 있습니다.',
      },
      { type: 'divider' },
      { type: 'heading', text: '통증 민감도가 올라가요' },
      {
        type: 'body',
        text: '수면 부족 상태가 계속되면 뇌가 통증 신호에 더 예민하게 반응하게 됩니다. 그래서 수면이 부족할 시 근육통, 두통 같은 증상도 더 심하게 느껴질 수 있어요. 특히 스트레스와 피로가 함께 쌓이면 통증이 악순환처럼 반복되기도 합니다.',
      },
      { type: 'divider' },
      { type: 'heading', text: '이런 습관이 수면을 방해해요' },
      {
        type: 'image',
        source: require('../assets/magazines/m2_c3.png'),
        aspectRatio: 1.5,
      },
      {
        type: 'tips',
        items: [
          '❌ 자기 직전 스마트폰 사용\n블루라이트는 멜라토닌 분비를 늦추고 잠들기 어렵게 만들어요.',
          '❌ 불규칙한 수면 시간\n자는 시간과 일어나는 시간이 계속 바뀌면 몸의 리듬이 무너지기 쉽습니다.',
          '❌ 늦은 카페인 섭취\n카페인은 생각보다 몸에 오래 남아요. 취침 최소 8~10시간 전에는 중단하는 것이 좋아요.',
        ],
      },
      { type: 'divider' },
      { type: 'heading', text: '건강한 수면 습관이 통증 완화에 중요해요' },
      {
        type: 'tips',
        items: [
          '같은 시간에 자고 일어나기\n수면 리듬이 안정되면 몸의 회복도 훨씬 수월해집니다.',
          '자기 전 몸을 편하게 만들기\n가벼운 스트레칭이나 따뜻한 샤워가 도움이 될 수 있어요.',
          '너무 오래 참지 않기\n통증 때문에 잠들기 힘들 정도라면 병원 상담이 필요해요.',
        ],
      },
      { type: 'divider' },
      {
        type: 'highlight',
        text: '몸이 보내는 피로 신호를 무시한 채 잠을 계속 줄이면, 통증은 점점 더 예민하게 느껴질 수 있습니다.\n\n수면 시간과 몸 상태를 함께 기록해두면 통증 패턴을 이해하는 데 도움이 될 수 있어요.',
      },
    ],
  },
  {
    id: 'stress-pain',
    title: '스트레스가 몸의 통증으로 나타나는 이유',
    subtitle: '몸과 마음은 연결되어 있어요',
    tags: ['목', '어깨', '두통', '머리'],
    content: [
      {
        type: 'image',
        source: require('../assets/magazines/m3_c1.png'),
        aspectRatio: 1.25,
      },
      {
        type: 'body',
        text: '"요즘 너무 피곤하고 몸이 뻐근해…" 시험 기간, 과제, 출근, 인간 관계 문제처럼 스트레스가 심한 시기에는 몸 여기저기 아픈 느낌이 들 때가 있습니다. 그런데 신기하게도 병원 검사에서는 큰 이상이 없는 경우도 많아요.',
      },
      { type: 'divider' },
      { type: 'heading', text: "우리 몸은 스트레스를 '위험 신호'로 받아들여요" },
      {
        type: 'body',
        text: '스트레스를 받으면 우리 몸은 위험 상황이라고 인식합니다. 그러면 몸은 자동으로 근육에 힘을 주고, 심장 박동을 높이고, 몸을 예민한 상태로 바꿉니다. 짧게 지나가는 스트레스라면 괜찮지만, 긴장 상태가 오래 지속되면 근육이 계속 굳어 있으면서 통증으로 이어질 수 있습니다.',
      },
      { type: 'divider' },
      { type: 'heading', text: '그래서 이런 통증이 생길 수 있어요' },
      {
        type: 'tips',
        items: [
          '목이 딱딱하게 굳는 느낌\n무의식적으로 어깨에 힘이 들어가면서 근육이 긴장하기 때문이에요.',
          '이유 없이 머리가 아픈 느낌\n긴장성 두통은 스트레스와 관련이 깊은 대표적인 증상입니다.',
          '배가 자주 아프거나 속이 불편함\n스트레스는 소화기관에도 영향을 줄 수 있어요.',
          '자고 일어나도 몸이 무거움\n몸이 제대로 쉬지 못하고 계속 긴장 상태였기 때문일 수 있습니다.',
        ],
      },
      { type: 'divider' },
      { type: 'heading', text: '스트레스성 통증을 줄이기 위한 습관' },
      {
        type: 'tips',
        items: [
          '어깨 힘 빼는 걸 의식하기',
          '1시간마다 잠깐씩 움직이기',
          '깊게 숨 쉬기',
          '오래 같은 자세 유지하지 않기',
          '충분히 쉬기',
          "괜찮은 '척' 하지 않기",
        ],
      },
      { type: 'divider' },
      { type: 'heading', text: '몸의 통증은 마음의 신호일 수도 있어요' },
      {
        type: 'image',
        source: require('../assets/magazines/m3_c2.png'),
        aspectRatio: 1.25,
      },
      {
        type: 'body',
        text: '스트레스는 눈에 보이지 않지만, 몸은 그 영향을 그대로 기억합니다. 최근 들어 이유 없이 몸이 무겁거나, 자꾸 결리거나, 피곤함이 오래 간다면 잠깐 쉬어가라는 신호일 수도 있어요.',
      },
      { type: 'divider' },
      {
        type: 'highlight',
        text: '작은 통증과 감정 상태를 함께 기록해두면 몸의 패턴을 이해하는 데 도움이 될 수 있습니다.',
      },
    ],
  },
];

// ── 추천 로직 ─────────────────────────────────────────────────────────────────
const DEFAULT_MAGAZINE_ID = 'sleep-pain';

function normalizeKoreanText(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

function splitBodyPartTokens(value: string): string[] {
  const compact = value
    .replace(/\s*(그리고|및|와|과)\s*/g, '/')
    .replace(/[|,·ㆍ+&]/g, '/');

  const suffixPattern = /(통증|아픔|불편감|저림|결림|뻐근함|부위)$/;

  return compact
    .split('/')
    .map((token) => normalizeKoreanText(token).replace(suffixPattern, ''))
    .filter(Boolean);
}

function getTagScore(params: {
  normalizedInput: string;
  tokens: string[];
  normalizedTag: string;
}): number {
  const { normalizedInput, tokens, normalizedTag } = params;
  if (!normalizedTag) return 0;

  // 1) 정확 일치 우선
  if (tokens.some((token) => token === normalizedTag)) {
    return 300 + normalizedTag.length;
  }
  // 2) 문장형 입력에 태그가 포함되는 경우
  if (normalizedInput.includes(normalizedTag)) {
    return 200 + normalizedTag.length;
  }
  // 3) 태그가 토큰에 포함되는 경우
  if (tokens.some((token) => token.includes(normalizedTag) || normalizedTag.includes(token))) {
    return 100 + normalizedTag.length;
  }
  return 0;
}

export function recommendMagazine(topBodyPart: string | null | undefined): Magazine {
  if (topBodyPart) {
    const normalizedInput = normalizeKoreanText(topBodyPart);
    const tokens = splitBodyPartTokens(topBodyPart);

    let bestMag: Magazine | null = null;
    let bestScore = 0;

    for (const mag of MAGAZINES) {
      for (const tag of mag.tags) {
        const score = getTagScore({ normalizedInput, tokens, normalizedTag: normalizeKoreanText(tag) });
        if (score > bestScore) {
          bestScore = score;
          bestMag = mag;
        }
      }
    }

    if (bestMag) return bestMag;
  }
  return MAGAZINES.find((m) => m.id === DEFAULT_MAGAZINE_ID) ?? MAGAZINES[0];
}

export function getMagazineById(id: string): Magazine | undefined {
  return MAGAZINES.find((m) => m.id === id);
}