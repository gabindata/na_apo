import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OceanBubbles } from '../components/ocean/OceanBubbles';
import {
  fetchCareData,
  getInsight,
  CATEGORY_CONFIG,
  FALLBACK_CARE,
  type CategoryKey,
  type CardData,
  type ParsedCare,
  type CareSummary,
} from '../lib/careData';

// Android LayoutAnimation 활성화
if (Platform.OS === 'android') {
  (UIManager as any).setLayoutAnimationEnabledExperimental?.(true);
}

const T = {
  text:      '#FFFFFF',
  textMuted: '#C8DFEF',
  primary:   '#4A90D9',
  secondary: '#7EC8E3',
};

type Phase = 'intro' | 'main' | 'complete';

const INTRO_LINES = [
  '오늘의 케어를 준비해봤어요 💙',
  '최근 기록을 바탕으로 추천드릴게요.',
];

// ── 메인 스크린 ────────────────────────────────────────────
export default function CareScreen() {
  const insets = useSafeAreaInsets();

  const [phase, setPhase]         = useState<Phase>('intro');
  const [summary, setSummary]     = useState<CareSummary | null>(null);
  const [care, setCare]           = useState<ParsedCare | null>(null);
  const [openSection, setOpenSection] = useState<CategoryKey | null>(null);
  const [checked, setChecked]     = useState<Set<CategoryKey>>(new Set());

  // ── 애니메이션 값 ──
  const apoFloat          = useRef(new Animated.Value(0)).current;
  const apoScale          = useRef(new Animated.Value(1)).current;
  const introOpacity      = useRef(new Animated.Value(0)).current;
  const line1Opacity      = useRef(new Animated.Value(0)).current;
  const line2Opacity      = useRef(new Animated.Value(0)).current;
  const skipOpacity       = useRef(new Animated.Value(0)).current;
  const mainOpacity       = useRef(new Animated.Value(0)).current;

  // 완료 화면 애니메이션
  const completeOpacity      = useRef(new Animated.Value(0)).current;
  const apoCompleteFloat     = useRef(new Animated.Value(0)).current;
  const apoCompleteScale     = useRef(new Animated.Value(0)).current;
  const completeLine1Opacity = useRef(new Animated.Value(0)).current;
  const completeLine2Opacity = useRef(new Animated.Value(0)).current;
  const completeBtnOpacity   = useRef(new Animated.Value(0)).current;

  const transitionDoneRef = useRef(false);
  const completeFloatRef  = useRef<Animated.CompositeAnimation | null>(null);

  // ── 데이터 로드 ──
  useEffect(() => {
    (async () => {
      try {
        const { summary: s, care: c } = await fetchCareData();
        setSummary(s);
        setCare(c);
        setOpenSection(c.primary.category);
      } catch {
        setCare(FALLBACK_CARE);
        setOpenSection('stretch');
      }
    })();
  }, []);

  // ── 인트로 애니메이션 시퀀스 ──
  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(apoFloat, {
          toValue: -14,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(apoFloat, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    floatLoop.start();

    Animated.sequence([
      Animated.timing(introOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(line1Opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(line2Opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(300),
      Animated.timing(skipOpacity,  { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => doTransition(), 3200);

    return () => {
      clearTimeout(timer);
      floatLoop.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doTransition = useCallback(() => {
    if (transitionDoneRef.current) return;
    transitionDoneRef.current = true;

    Animated.parallel([
      Animated.timing(introOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
      Animated.timing(apoScale,     { toValue: 0.4, duration: 380, useNativeDriver: true }),
    ]).start(() => {
      setPhase('main');
      Animated.timing(mainOpacity, { toValue: 1, duration: 480, useNativeDriver: true }).start();
    });
  }, [introOpacity, apoScale, mainOpacity]);

  const toggleSection = useCallback((category: CategoryKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSection((prev) => (prev === category ? null : category));
  }, []);

  // ── 체크박스 ──
  const handleCheck = useCallback((category: CategoryKey) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const displayCare = care ?? FALLBACK_CARE;
  const allCards: CardData[] = [displayCare.primary, ...displayCare.secondary];

  // ── 완료 감지 ──
  useEffect(() => {
    if (phase !== 'main') return;
    if (checked.size < allCards.length || allCards.length === 0) return;

    setPhase('complete');

    // 아포 부유 루프 (완료 화면용)
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(apoCompleteFloat, {
          toValue: -14,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(apoCompleteFloat, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    completeFloatRef.current = floatLoop;
    floatLoop.start();

    // 완료 화면 순차 등장
    Animated.sequence([
      Animated.timing(completeOpacity,      { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(apoCompleteScale,     { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(completeLine1Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(150),
      Animated.timing(completeLine2Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(300),
      Animated.timing(completeBtnOpacity,   { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    return () => { completeFloatRef.current?.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked.size, phase]);

  return (
    <LinearGradient
      colors={['#3A7AB0', '#1A4068', '#0F2840', '#0A1A2E']}
      locations={[0, 0.35, 0.70, 1]}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <OceanBubbles variant="home" />

      {/* ════════════════ 인트로 페이즈 ════════════════ */}
      {phase === 'intro' && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.introContainer, { opacity: introOpacity, paddingTop: insets.top }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={doTransition} />

          <Animated.Image
            source={require('../assets/images/apo_tab.png')}
            style={[
              styles.apoLarge,
              { transform: [{ translateY: apoFloat }, { scale: apoScale }] },
            ]}
            resizeMode="contain"
          />

          <Animated.Text style={[styles.introLine1, { opacity: line1Opacity }]}>
            {INTRO_LINES[0]}
          </Animated.Text>
          <Animated.Text style={[styles.introLine2, { opacity: line2Opacity }]}>
            {INTRO_LINES[1]}
          </Animated.Text>

          <Animated.Text style={[styles.introSkip, { opacity: skipOpacity }]}>
            탭하여 건너뛰기
          </Animated.Text>
        </Animated.View>
      )}

      {/* ════════════════ 메인 페이즈 ════════════════ */}
      {phase === 'main' && (
        <Animated.View style={[styles.flex, { opacity: mainOpacity }]}>

          {/* 헤더 */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
              hitSlop={12}
              accessibilityLabel="뒤로 가기"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={22} color="rgba(168,216,234,0.85)" />
            </Pressable>

            <View style={styles.headerCenter}>
              <Image
                source={require('../assets/images/apo_tab.png')}
                style={styles.apoSmall}
                resizeMode="contain"
              />
              <Text style={styles.headerTitle}>오늘의 케어</Text>
            </View>

            {/* 진행 표시 */}
            <View style={styles.headerBtn}>
              <Text style={styles.headerProgress}>
                {checked.size}/{allCards.length}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 16) + 40 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* AI 요약 카드 */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryShine} />
              <View style={styles.summaryHeaderRow}>
                <Ionicons name="sparkles" size={12} color={T.secondary} />
                <Text style={styles.summaryLabel}>AI가 분석한 내용이에요</Text>
              </View>
              <Text
                style={styles.summaryText}
                lineBreakStrategyIOS="hangul-word"
                textBreakStrategy="balanced"
              >
                {displayCare.summary}
              </Text>
            </View>

            {/* 케어 섹션 목록 */}
            <View style={styles.sectionList}>
              {allCards.map((card, index) => (
                <CareSection
                  key={card.category}
                  card={card}
                  isPrimary={index === 0}
                  isOpen={openSection === card.category}
                  isChecked={checked.has(card.category)}
                  insight={getInsight(summary, card.category)}
                  onToggle={() => toggleSection(card.category)}
                  onCheck={() => handleCheck(card.category)}
                />
              ))}
            </View>

          </ScrollView>
        </Animated.View>
      )}

      {/* ════════════════ 완료 페이즈 ════════════════ */}
      {phase === 'complete' && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.completeContainer, { opacity: completeOpacity, paddingTop: insets.top }]}
        >
          <Animated.Image
            source={require('../assets/images/apo_tab.png')}
            style={[
              styles.apoLarge,
              { transform: [{ translateY: apoCompleteFloat }, { scale: apoCompleteScale }] },
            ]}
            resizeMode="contain"
          />

          <Animated.Text style={[styles.completeLine1, { opacity: completeLine1Opacity }]}>
            오늘의 케어 완료! 💙
          </Animated.Text>
          <Animated.Text style={[styles.completeLine2, { opacity: completeLine2Opacity }]}>
            내일도 만나요
          </Animated.Text>

          <Animated.View style={{ opacity: completeBtnOpacity, marginTop: 36 }}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.completeBtn, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={['rgba(74,144,217,0.90)', 'rgba(46,95,163,0.90)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.completeBtnGradient}
              >
                <Ionicons name="home-outline" size={16} color="#fff" />
                <Text style={styles.completeBtnText}>홈으로 돌아가기</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
    </LinearGradient>
  );
}

// ── 케어 섹션 카드 ─────────────────────────────────────────
function CareSection({
  card,
  isPrimary,
  isOpen,
  isChecked,
  insight,
  onToggle,
  onCheck,
}: {
  card: CardData;
  isPrimary: boolean;
  isOpen: boolean;
  isChecked: boolean;
  insight: string;
  onToggle: () => void;
  onCheck: () => void;
}) {
  const config = CATEGORY_CONFIG[card.category];

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.section,
        isPrimary  && styles.sectionPrimary,
        isOpen     && styles.sectionOpen,
        isChecked  && styles.sectionChecked,
        pressed    && { opacity: 0.92 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${config.label} 케어`}
      accessibilityState={{ expanded: isOpen }}
    >
      {isPrimary && <View style={styles.sectionShine} />}

      {/* ─ 헤더 행 ─ */}
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, isPrimary && styles.sectionIconWrapPrimary, isChecked && styles.sectionIconWrapChecked]}>
          <Ionicons name={config.icon as any} size={isPrimary ? 20 : 17} color={isChecked ? '#7EC8E3' : T.secondary} />
        </View>

        <View style={styles.sectionHeaderMid}>
          <View style={styles.sectionLabelRow}>
            <Text style={[styles.sectionCategory, isChecked && styles.sectionCategoryChecked]}>
              {config.label}
            </Text>
            {isPrimary && !isChecked && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>오늘의 핵심</Text>
              </View>
            )}
            {isChecked && (
              <View style={styles.doneBadge}>
                <Text style={styles.doneBadgeText}>완료</Text>
              </View>
            )}
          </View>
        </View>

        {/* 체크박스 - 별도 터치 영역 */}
        <Pressable
          onPress={onCheck}
          hitSlop={10}
          style={styles.checkboxBtn}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isChecked }}
          accessibilityLabel={`${config.label} 완료 체크`}
        >
          <Ionicons
            name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isChecked ? '#7EC8E3' : 'rgba(168,216,234,0.35)'}
          />
        </Pressable>

        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="rgba(168,216,234,0.50)"
        />
      </View>

      {/* ─ 펼쳐진 내용 ─ */}
      {isOpen && (
        <View style={styles.sectionContent}>
          <View style={styles.sectionDivider} />

          {/* AI 인사이트 */}
          <View style={styles.insightRow}>
            <Ionicons name="analytics-outline" size={13} color={T.secondary} />
            <Text
              style={styles.insightText}
              lineBreakStrategyIOS="hangul-word"
              textBreakStrategy="balanced"
            >
              {insight}
            </Text>
          </View>

          {/* 케어 팁 본문 */}
          <Text
            style={styles.sectionBody}
            lineBreakStrategyIOS="hangul-word"
            textBreakStrategy="balanced"
          >
            {card.body}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ── 스타일 ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // ── 인트로 ──
  introContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  apoLarge: {
    width: 160,
    height: 160,
    marginBottom: 28,
  },
  introLine1: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  introLine2: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(200,223,239,0.85)',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  introSkip: {
    position: 'absolute',
    bottom: 56,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(200,223,239,0.45)',
    letterSpacing: 0.2,
  },

  // ── 헤더 ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(168,216,234,0.18)',
  },
  headerBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  apoSmall: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerProgress: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(126,200,227,0.75)',
    letterSpacing: 0.5,
  },

  // ── 스크롤 ──
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },

  // ── AI 요약 카드 ──
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.28)',
    backgroundColor: 'rgba(74,144,217,0.14)',
    padding: 16,
    overflow: 'hidden',
    marginBottom: 4,
  },
  summaryShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7EC8E3',
    letterSpacing: 0.2,
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22,
    letterSpacing: -0.3,
  },

  // ── 섹션 목록 ──
  sectionList: {
    gap: 10,
  },

  // ── 섹션 카드 (기본) ──
  section: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.20)',
    backgroundColor: 'rgba(120,175,220,0.10)',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sectionPrimary: {
    borderColor: 'rgba(126,200,227,0.38)',
    backgroundColor: 'rgba(74,144,217,0.18)',
  },
  sectionOpen: {
    borderColor: 'rgba(126,200,227,0.32)',
  },
  sectionChecked: {
    borderColor: 'rgba(126,200,227,0.50)',
    backgroundColor: 'rgba(74,144,217,0.22)',
  },
  sectionShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  // ── 섹션 헤더 ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(126,200,227,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionIconWrapPrimary: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(126,200,227,0.18)',
    borderColor: 'rgba(126,200,227,0.35)',
  },
  sectionIconWrapChecked: {
    backgroundColor: 'rgba(126,200,227,0.22)',
    borderColor: 'rgba(126,200,227,0.50)',
  },
  sectionHeaderMid: {
    flex: 1,
    gap: 3,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionCategory: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  sectionCategoryChecked: {
    color: '#7EC8E3',
  },
  primaryBadge: {
    backgroundColor: 'rgba(126,200,227,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.40)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7EC8E3',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  doneBadge: {
    backgroundColor: 'rgba(126,200,227,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.55)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  doneBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7EC8E3',
    letterSpacing: 0.3,
  },
  checkboxBtn: {
    padding: 2,
    flexShrink: 0,
  },

  // ── 섹션 펼쳐진 내용 ──
  sectionContent: {
    gap: 10,
    marginTop: 10,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(168,216,234,0.22)',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: 'rgba(126,200,227,0.10)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.20)',
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#C8DFEF',
    lineHeight: 18,
    letterSpacing: -0.1,
    marginTop: 1,
  },
  sectionBody: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 22,
    letterSpacing: -0.2,
    paddingHorizontal: 2,
  },

  // ── 완료 화면 ──
  completeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeLine1: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  completeLine2: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(200,223,239,0.85)',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  completeBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#1A4FA8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 4,
  },
  completeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.40)',
    borderRadius: 18,
  },
  completeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },

});
