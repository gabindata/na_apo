// lib/bodyPartNormalize.ts

const CANONICAL_BODY_PARTS = [
  '머리',
  '이마',
  '눈',
  '귀',
  '코',
  '입',
  '턱',
  '목',
  '어깨',
  '가슴',
  '등',
  '허리',
  '복부',
  '골반',
  '엉덩이',
  '팔',
  '팔꿈치',
  '손목',
  '손',
  '다리',
  '무릎',
  '발목',
  '발',
] as const;

type CanonicalBodyPart = (typeof CANONICAL_BODY_PARTS)[number];

const BODY_PART_ALIASES: Record<CanonicalBodyPart, string[]> = {
  머리: ['머리', '두통', '두부', '정수리', '후두부', '뒤통수', '측두부', '관자놀이'],
  이마: ['이마', '전두부'],
  눈: ['눈', '안구', '눈알', '눈가'],
  귀: ['귀', '귓속', '귓바퀴'],
  코: ['코', '비강', '콧속'],
  입: ['입', '입술', '구강', '입안'],
  턱: ['턱', '턱관절', '하악'],

  목: ['목', '목덜미', '뒷목', '앞목', '경추', '승모근'],
  어깨: ['어깨', '견관절', '어깨관절', '쇄골쪽', '견갑', '견갑골'],

  가슴: ['가슴', '흉부', '명치', '갈비뼈', '늑골'],
  등: ['등', '상부등', '등허리', '흉추', '날개뼈', '견갑골주변'],
  허리: ['허리', '요추', '요통', '아랫등', '등아래', '허리쪽'],

  복부: ['배', '복부', '아랫배', '윗배', '복통', '배꼽주변'],
  골반: ['골반', '고관절', '사타구니', '서혜부'],
  엉덩이: ['엉덩이', '둔부', '꼬리뼈', '미골'],

  팔: ['팔', '상완', '전완', '위팔', '아래팔', '팔뚝'],
  팔꿈치: ['팔꿈치', '엘보', '주관절'],
  손목: ['손목', '손목관절'],
  손: ['손', '손가락', '손바닥', '손등', '엄지', '검지', '중지', '약지', '새끼손가락'],

  다리: ['다리', '허벅지', '종아리', '정강이', '대퇴', '하퇴'],
  무릎: ['무릎', '슬개골', '무릎관절'],
  발목: ['발목', '발목관절'],
  발: ['발', '발가락', '발바닥', '발등', '뒤꿈치', '종골'],
};

function cleanBodyPartText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~?]/g, '')
    .replace(/\s+/g, '')
    .replace(/(왼쪽|오른쪽|좌측|우측|좌|우|왼|오른|양쪽|양측|양|left|right|lt|rt|l|r)/g, '')
    .replace(/(부위|쪽|근처|주변|부분|통증|아픔|아픈곳|아픈부위)/g, '')
    .trim();
}

export function normalizeBodyPartForReport(bodyPart: string | null | undefined): string | null {
  if (bodyPart == null) return null;

  const raw = String(bodyPart).trim();
  if (!raw) return null;

  const cleaned = cleanBodyPartText(raw);
  if (!cleaned) return null;

  for (const canonical of CANONICAL_BODY_PARTS) {
    const aliases = BODY_PART_ALIASES[canonical];

    if (aliases.some((alias) => cleaned === cleanBodyPartText(alias))) {
      return canonical;
    }
  }

  for (const canonical of CANONICAL_BODY_PARTS) {
    const aliases = BODY_PART_ALIASES[canonical];

    if (aliases.some((alias) => cleaned.includes(cleanBodyPartText(alias)))) {
      return canonical;
    }
  }

  return raw.length > 12 ? `${raw.slice(0, 12)}…` : raw;
}