import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
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
import { fetchUserProfile } from '../lib/userProfile';
import { useAuth } from '../contexts/AuthContext';

const MODAL_SCROLL_MAX_H = Dimensions.get('window').height * 0.86 - 200;

if (Platform.OS === 'android') {
  (UIManager as any).setLayoutAnimationEnabledExperimental?.(true);
}

const T = {
  text: '#FFFFFF',
  textMuted: '#C8DFEF',
  primary: '#4A90D9',
  secondary: '#7EC8E3',
};

type Phase = 'intro' | 'main' | 'complete';

const INTRO_LINES = [
  '오늘의 케어를 준비해봤어요 💙',
  '최근 기록을 바탕으로 추천드릴게요.',
];

const LOCAL_FALLBACK_CARE: ParsedCare = {
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
        steps: ['어깨를 천천히 돌리기', '목을 좌우로 가볍게 기울이기'],
        apoMessage: '처음부터 무리하지 말고, 몸이 편안해지는 정도만 해도 충분해요.',
      },
    },
    {
      category: 'hydration',
      title: '수분 보충',
      preview: '따뜻한 물 한 컵으로 하루를 가볍게 시작해보세요.',
      cta: '수분 체크',
      detail: {
        why: '수분 섭취는 기본적인 컨디션 관리에 도움이 될 수 있어요.',
        recommendation: '오늘은 차가운 음료보다 따뜻한 물이나 무카페인 차를 조금씩 마셔보세요.',
        routine: ['아침에 물 한 컵', '점심 전후 물 한 컵'],
        avoid: ['늦은 카페인', '당이 많은 음료'],
        apoMessage: '작게 자주 마시는 게 좋아요.',
      },
    },
    {
      category: 'nutrition',
      title: '회복 식단',
      preview: '단백질과 마그네슘이 있는 가벼운 식사를 추천드려요.',
      cta: '식단 보기',
      detail: {
        why: '몸에 부담이 적은 영양 루틴을 기본으로 추천드려요.',
        recommendation: '오늘은 자극적인 음식보다 따뜻하고 단백질이 있는 식사를 추천드려요.',
        foods: ['계란', '두유', '바나나', '견과류'],
        avoid: ['늦은 카페인', '과한 당류'],
        routine: ['아침: 바나나 + 두유', '저녁: 따뜻한 단백질 식사'],
        apoMessage: '오늘은 회복 쪽으로 천천히 가보면 좋아요.',
      },
    },
    {
      category: 'sleep',
      title: '수면 준비',
      preview: '자기 전 화면과 카페인을 조금 멀리해보세요.',
      cta: '수면 루틴',
      detail: {
        why: '수면은 몸의 회복과 컨디션 관리에 도움이 될 수 있어요.',
        recommendation: '잠들기 전 화면 밝기를 줄이고 몸을 쉬는 모드로 바꿔보세요.',
        routine: ['자기 전 화면 줄이기', '가벼운 호흡 3분'],
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
        why: '마음의 긴장도 몸의 컨디션에 영향을 줄 수 있어요.',
        recommendation: '잠깐 멈춰서 호흡을 정리하는 시간을 가져보세요.',
        steps: ['4초 동안 들이마시기', '6초 동안 길게 내쉬기'],
        apoMessage: '오늘은 조금 느리게 가도 괜찮아요.',
      },
    },
  ],
};

function getSafeFallbackCare(): ParsedCare {
  if (
    FALLBACK_CARE &&
    typeof FALLBACK_CARE === 'object' &&
    typeof FALLBACK_CARE.summary === 'string' &&
    Array.isArray(FALLBACK_CARE.cards) &&
    FALLBACK_CARE.cards.length > 0
  ) {
    return FALLBACK_CARE;
  }

  return LOCAL_FALLBACK_CARE;
}

function isValidCare(value: ParsedCare | null | undefined): value is ParsedCare {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof value.summary === 'string' &&
    Array.isArray(value.cards) &&
    value.cards.length > 0
  );
}

export default function CareScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('intro');
  const [summary, setSummary] = useState<CareSummary | null>(null);
  const [care, setCare] = useState<ParsedCare | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [checked, setChecked] = useState<Set<CategoryKey>>(new Set());

  const apoFloat = useRef(new Animated.Value(0)).current;
  const apoScale = useRef(new Animated.Value(1)).current;
  const introOpacity = useRef(new Animated.Value(0)).current;
  const line1Opacity = useRef(new Animated.Value(0)).current;
  const line2Opacity = useRef(new Animated.Value(0)).current;
  const skipOpacity = useRef(new Animated.Value(0)).current;
  const mainOpacity = useRef(new Animated.Value(0)).current;

  const completeOpacity = useRef(new Animated.Value(0)).current;
  const apoCompleteFloat = useRef(new Animated.Value(0)).current;
  const apoCompleteScale = useRef(new Animated.Value(0)).current;
  const completeLine1Opacity = useRef(new Animated.Value(0)).current;
  const completeLine2Opacity = useRef(new Animated.Value(0)).current;
  const completeBtnOpacity = useRef(new Animated.Value(0)).current;

  const transitionDoneRef = useRef(false);
  const completeFloatRef = useRef<Animated.CompositeAnimation | null>(null);

  const fallbackCare = useMemo(() => getSafeFallbackCare(), []);

  const displayCare = useMemo(() => {
    return isValidCare(care) ? care : fallbackCare;
  }, [care, fallbackCare]);

  const allCards = useMemo(() => {
    return Array.isArray(displayCare?.cards) && displayCare.cards.length > 0
      ? displayCare.cards
      : fallbackCare.cards;
  }, [displayCare, fallbackCare]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const userProfile = user?.id ? await fetchUserProfile(user.id) : null;

        const profile = userProfile
          ? {
              birthYear: userProfile.birthYear,
              gender: userProfile.gender,
            }
          : null;

        const result = await fetchCareData(profile);

        if (cancelled) return;

        setSummary(result.summary);
        setCare(isValidCare(result.care) ? result.care : fallbackCare);
      } catch (error) {
        console.warn('[CARE SCREEN] fetch failed:', error);

        if (cancelled) return;

        setCare(fallbackCare);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, fallbackCare]);

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
      Animated.timing(skipOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => doTransition(), 3200);

    return () => {
      clearTimeout(timer);
      floatLoop.stop();
    };
  }, []);

  const doTransition = useCallback(() => {
    if (transitionDoneRef.current) return;
    transitionDoneRef.current = true;

    Animated.parallel([
      Animated.timing(introOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
      Animated.timing(apoScale, { toValue: 0.4, duration: 380, useNativeDriver: true }),
    ]).start(() => {
      setPhase('main');
      Animated.timing(mainOpacity, { toValue: 1, duration: 480, useNativeDriver: true }).start();
    });
  }, [introOpacity, apoScale, mainOpacity]);

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

  useEffect(() => {
    if (phase !== 'main') return;
    if (!Array.isArray(allCards) || allCards.length === 0) return;
    if (checked.size < allCards.length) return;

    setPhase('complete');

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

    Animated.sequence([
      Animated.timing(completeOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(apoCompleteScale, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
      Animated.delay(200),
      Animated.timing(completeLine1Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(150),
      Animated.timing(completeLine2Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(300),
      Animated.timing(completeBtnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    return () => {
      completeFloatRef.current?.stop();
    };
  }, [
    checked.size,
    phase,
    allCards.length,
    apoCompleteFloat,
    apoCompleteScale,
    completeOpacity,
    completeLine1Opacity,
    completeLine2Opacity,
    completeBtnOpacity,
  ]);

  return (
    <LinearGradient
      colors={['#3A7AB0', '#1A4068', '#0F2840', '#0A1A2E']}
      locations={[0, 0.35, 0.7, 1]}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <OceanBubbles variant="home" />

      {phase === 'intro' && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.introContainer,
            { opacity: introOpacity, paddingTop: insets.top },
          ]}
        >
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

      {phase === 'main' && (
        <Animated.View style={[styles.flex, { opacity: mainOpacity }]}>
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
            <View style={styles.summaryCard}>
              <View style={styles.summaryShine} />
              <View style={styles.summaryHeaderRow}>
                <Ionicons name="sparkles" size={13} color={T.secondary} />
                <Text style={styles.summaryLabel}>아포가 분석한 오늘의 방향</Text>
              </View>
              <Text style={styles.summaryText}>
                {displayCare?.summary ?? fallbackCare.summary}
              </Text>
            </View>

            <View style={styles.guideCard}>
              <Text style={styles.guideTitle}>오늘은 이렇게 케어해볼게요</Text>
              <Text style={styles.guideText}>
                각 카드를 눌러 자세한 추천을 확인하고, 실천한 항목은 체크해보세요.
              </Text>
            </View>

            <View style={styles.sectionGrid}>
              {allCards.map((card, index) => (
                <CareCategoryCard
                  key={`${card.category}-${index}`}
                  card={card}
                  isPrimary={index === 0}
                  isChecked={checked.has(card.category)}
                  insight={getInsight(summary, card.category)}
                  onPress={() => setSelectedCard(card)}
                  onCheck={() => handleCheck(card.category)}
                />
              ))}
            </View>
          </ScrollView>

          <CareDetailModal
            card={selectedCard}
            summary={summary}
            visible={!!selectedCard}
            isChecked={selectedCard ? checked.has(selectedCard.category) : false}
            onClose={() => setSelectedCard(null)}
            onCheck={() => {
              if (selectedCard) handleCheck(selectedCard.category);
            }}
          />
        </Animated.View>
      )}

      {phase === 'complete' && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.completeContainer,
            { opacity: completeOpacity, paddingTop: insets.top },
          ]}
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
            내일도 아포가 함께할게요
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

function CareCategoryCard({
  card,
  isPrimary,
  isChecked,
  insight,
  onPress,
  onCheck,
}: {
  card: CardData;
  isPrimary: boolean;
  isChecked: boolean;
  insight: string;
  onPress: () => void;
  onCheck: () => void;
}) {
  const config = CATEGORY_CONFIG?.[card.category] ?? {
    icon: 'ellipse-outline',
    label: card.category,
    description: '',
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryCard,
        isPrimary && styles.categoryCardPrimary,
        isChecked && styles.categoryCardChecked,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${config.label} 자세히 보기`}
    >
      <View style={styles.categoryTopRow}>
        <View
          style={[
            styles.categoryIconWrap,
            isPrimary && styles.categoryIconWrapPrimary,
            isChecked && styles.categoryIconWrapChecked,
          ]}
        >
          <Ionicons
            name={config.icon as any}
            size={20}
            color={isChecked ? '#FFFFFF' : T.secondary}
          />
        </View>

        <Pressable
          onPress={onCheck}
          hitSlop={10}
          style={styles.checkboxBtn}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isChecked }}
        >
          <Ionicons
            name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isChecked ? '#7EC8E3' : 'rgba(168,216,234,0.35)'}
          />
        </Pressable>
      </View>

      <View style={styles.categoryTitleRow}>
        <Text style={styles.categoryLabel}>{config.label}</Text>
        {isPrimary && !isChecked && (
          <View style={styles.primaryBadge}>
            <Text style={styles.primaryBadgeText}>핵심</Text>
          </View>
        )}
      </View>

      <Text style={styles.categoryTitle}>{card.title}</Text>
      <Text style={styles.categoryPreview}>{card.preview}</Text>

      <View style={styles.categoryInsight}>
        <Ionicons name="analytics-outline" size={12} color={T.secondary} />
        <Text style={styles.categoryInsightText} numberOfLines={2}>
          {insight}
        </Text>
      </View>

      <View style={styles.cardBottomRow}>
        <Text style={styles.cardCta}>{card.cta}</Text>
        <Ionicons name="chevron-forward" size={15} color="rgba(126,200,227,0.75)" />
      </View>
    </Pressable>
  );
}

function CareDetailModal({
  card,
  summary,
  visible,
  isChecked,
  onClose,
  onCheck,
}: {
  card: CardData | null;
  summary: CareSummary | null;
  visible: boolean;
  isChecked: boolean;
  onClose: () => void;
  onCheck: () => void;
}) {
  if (!card) return null;

  const config = CATEGORY_CONFIG?.[card.category] ?? {
    icon: 'ellipse-outline',
    label: card.category,
    description: '',
  };

  const detail = card.detail ?? {
    why: '최근 기록을 바탕으로 오늘의 케어를 준비했어요.',
    recommendation: '오늘은 몸에 부담이 적은 루틴부터 가볍게 시작해보세요.',
    apoMessage: '오늘도 무리하지 말고 천천히 케어해봐요.',
  };

  const insight = getInsight(summary, card.category);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.modalCard}>
          <LinearGradient colors={['#1A4068', '#0A1A2E']} style={styles.modalGradient}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name={config.icon as any} size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalCategory}>{config.label}</Text>
                  <Text style={styles.modalTitle}>{card.title}</Text>
                </View>
              </View>

              <Pressable onPress={onClose} hitSlop={10} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: MODAL_SCROLL_MAX_H }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScroll}
            >
              <InfoBox icon="sparkles" label="아포의 분석" text={insight} />

              <DetailSection title="왜 추천하나요?" body={detail.why} />
              <DetailSection title="오늘의 추천" body={detail.recommendation} />

              {Array.isArray(detail.steps) && detail.steps.length > 0 && (
                <BulletSection title="실천 방법" items={detail.steps} />
              )}
              {Array.isArray(detail.foods) && detail.foods.length > 0 && (
                <BulletSection title="추천 음식" items={detail.foods} />
              )}
              {Array.isArray(detail.routine) && detail.routine.length > 0 && (
                <BulletSection title="오늘의 루틴" items={detail.routine} />
              )}
              {Array.isArray(detail.avoid) && detail.avoid.length > 0 && (
                <BulletSection title="피하면 좋은 것" items={detail.avoid} />
              )}

              <View style={styles.apoMessageBox}>
                <Image
                  source={require('../assets/images/apo_tab.png')}
                  style={styles.apoMessageImage}
                  resizeMode="contain"
                />
                <Text style={styles.apoMessageText}>{detail.apoMessage}</Text>
              </View>
            </ScrollView>

            <Pressable
              onPress={onCheck}
              style={({ pressed }) => [styles.modalActionBtn, pressed && { opacity: 0.8 }]}
            >
              <LinearGradient
                colors={
                  isChecked
                    ? ['rgba(126,200,227,0.25)', 'rgba(126,200,227,0.18)']
                    : ['rgba(74,144,217,0.95)', 'rgba(46,95,163,0.95)']
                }
                style={styles.modalActionGradient}
              >
                <Ionicons
                  name={isChecked ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.modalActionText}>
                  {isChecked ? '완료했어요' : '이 케어 완료하기'}
                </Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

function InfoBox({ icon, label, text }: { icon: any; label: string; text: string }) {
  return (
    <View style={styles.infoBox}>
      <View style={styles.infoBoxHeader}>
        <Ionicons name={icon} size={13} color={T.secondary} />
        <Text style={styles.infoBoxLabel}>{label}</Text>
      </View>
      <Text style={styles.infoBoxText}>{text}</Text>
    </View>
  );
}

function DetailSection({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailTitle}>{title}</Text>
      <Text style={styles.detailBody}>{body}</Text>
    </View>
  );
}

function BulletSection({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailTitle}>{title}</Text>
      <View style={styles.bulletList}>
        {items.map((item, index) => (
          <View key={`${title}-${index}`} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  introContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },

  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.28)',
    backgroundColor: 'rgba(74,144,217,0.14)',
    padding: 16,
    overflow: 'hidden',
  },
  summaryShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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

  guideCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.14)',
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  guideText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(200,223,239,0.78)',
    lineHeight: 18,
    letterSpacing: -0.1,
  },

  sectionGrid: {
    gap: 10,
  },

  categoryCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.20)',
    backgroundColor: 'rgba(120,175,220,0.10)',
    padding: 15,
    overflow: 'hidden',
  },
  categoryCardPrimary: {
    borderColor: 'rgba(126,200,227,0.42)',
    backgroundColor: 'rgba(74,144,217,0.20)',
  },
  categoryCardChecked: {
    borderColor: 'rgba(126,200,227,0.50)',
    backgroundColor: 'rgba(74,144,217,0.24)',
  },
  categoryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(126,200,227,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconWrapPrimary: {
    backgroundColor: 'rgba(126,200,227,0.20)',
    borderColor: 'rgba(126,200,227,0.38)',
  },
  categoryIconWrapChecked: {
    backgroundColor: 'rgba(126,200,227,0.30)',
    borderColor: 'rgba(126,200,227,0.55)',
  },
  checkboxBtn: {
    padding: 2,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    marginBottom: 5,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7EC8E3',
    letterSpacing: 0.1,
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
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.45,
    marginBottom: 6,
  },
  categoryPreview: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  categoryInsight: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 7,
    backgroundColor: 'rgba(126,200,227,0.10)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.18)',
  },
  categoryInsightText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#C8DFEF',
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  cardBottomRow: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCta: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7EC8E3',
    letterSpacing: -0.1,
  },

  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,10,20,0.62)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '86%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.26)',
  },
  modalGradient: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(126,200,227,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCategory: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7EC8E3',
    marginBottom: 3,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    gap: 12,
    paddingBottom: 14,
  },
  infoBox: {
    borderRadius: 16,
    backgroundColor: 'rgba(126,200,227,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.22)',
    padding: 13,
  },
  infoBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoBoxLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7EC8E3',
  },
  infoBoxText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  detailSection: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.14)',
    padding: 13,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 7,
    letterSpacing: -0.2,
  },
  detailBody: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 21,
    letterSpacing: -0.15,
  },
  bulletList: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#7EC8E3',
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  apoMessageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(74,144,217,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.24)',
    padding: 13,
  },
  apoMessageImage: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  apoMessageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  modalActionBtn: {
    marginTop: 4,
    borderRadius: 18,
    overflow: 'hidden',
  },
  modalActionGradient: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

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
    shadowOpacity: 0.3,
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