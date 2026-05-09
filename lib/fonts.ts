import { StyleSheet, TextStyle } from 'react-native';

// 서울남산체 폰트 자산 — useFonts()에 전달
export const FONT_ASSETS = {
  SeoulNamsanL: require('../assets/fonts/SeoulNamsan/SeoulNamsanL.ttf'),
  SeoulNamsanM: require('../assets/fonts/SeoulNamsan/SeoulNamsanM.ttf'),
  SeoulNamsanB: require('../assets/fonts/SeoulNamsan/SeoulNamsanB.ttf'),
  SeoulNamsanEB: require('../assets/fonts/SeoulNamsan/SeoulNamsanEB.ttf'),
};

export const Fonts = {
  light: 'SeoulNamsanL',
  medium: 'SeoulNamsanM',
  bold: 'SeoulNamsanB',
  extraBold: 'SeoulNamsanEB',
} as const;

// fontWeight → 서울남산 family 매핑
function pickFontFamily(weight: TextStyle['fontWeight']): string {
  if (weight == null) return Fonts.medium;
  if (weight === 'bold') return Fonts.bold;
  if (weight === 'normal') return Fonts.medium;
  const n = typeof weight === 'number' ? weight : parseInt(weight as string, 10);
  if (!Number.isNaN(n)) {
    if (n >= 800) return Fonts.extraBold;
    if (n >= 600) return Fonts.bold;
    if (n >= 400) return Fonts.medium;
    return Fonts.light;
  }
  return Fonts.medium;
}

// 텍스트 관련 스타일 여부 판별 (View 등 레이아웃 스타일은 건드리지 않음)
function isTextStyle(style: Record<string, unknown>): boolean {
  return (
    'fontSize' in style ||
    'fontWeight' in style ||
    'fontFamily' in style ||
    'lineHeight' in style ||
    'letterSpacing' in style ||
    'textAlign' in style ||
    'textDecorationLine' in style ||
    'color' in style
  );
}

function processStyle(style: unknown): unknown {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return style;
  const s = style as Record<string, unknown>;
  if (!isTextStyle(s)) return style;                 // 레이아웃 전용 스타일은 패스
  if (s.fontFamily) return style;                    // 이미 fontFamily 있으면 존중

  const { fontWeight, ...rest } = s as TextStyle & Record<string, unknown>;
  return {
    fontFamily: pickFontFamily(fontWeight as TextStyle['fontWeight']),
    ...rest,
    // fontWeight 제거: 커스텀 폰트에서 fontWeight를 중첩 적용하면 오동작
  };
}

// ── StyleSheet.create 패치 ──────────────────────────────────────────────────
// New Architecture(Fabric, RN 0.71+)에서는 Text.render 패치가 불가능하므로
// 스타일 객체 생성 시점에 fontWeight → fontFamily 변환을 주입한다.
//
// 호출 시점: _layout.tsx 모듈 로드 → 라우트 컴포넌트 lazy load 이전
// → 앱 내 모든 StyleSheet.create 호출에 패치가 적용됨
let applied = false;
export function applyGlobalFont(): void {
  if (applied) return;
  applied = true;

  // ── 1) StyleSheet.create 패치 ─────────────────────────────────────────────
  const originalCreate = StyleSheet.create.bind(StyleSheet);

  (StyleSheet as any).create = function <T extends StyleSheet.NamedStyles<T>>(styles: T): T {
    const processed: Record<string, unknown> = {};
    for (const key in styles) {
      processed[key] = processStyle(styles[key]);
    }
    return originalCreate(processed as T);
  };

  console.log('[fonts] StyleSheet.create 패치 완료 — Seoul Namsan 자동 적용');
}

// 진입점(index.ts)에서 side-effect import 시 즉시 실행
applyGlobalFont();
