import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '../../components/common/Card';
import { Header } from '../../components/common/Header';
import { Colors } from '../../constants/colors';
import { fetchMonthlyRecords, fetchWeeklyStats } from '../../lib/painRecords';

const H_PAD = 20;
const SECTION_GAP = 22;

const HEAT_PREVIEW_KEYS = ['none', 'low', 'mid', 'high', 'severe'] as const;

function OceanSectionTitle({ label }: { label: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionAccent} accessibilityElementsHidden />
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [monthlyRecords, setMonthlyRecords] = useState<{ date: string; intensity: number }[]>([]);
  const [stats, setStats] = useState<{
    topBodyPart: string;
    avgIntensity: number;
    recordCount: number;
  } | null>(null);

  const intensityColor = useCallback((intensity: number) => {
    if (intensity <= 0) return Colors.heatmap.none;
    if (intensity <= 3) return Colors.heatmap.low;
    if (intensity <= 6) return Colors.heatmap.mid;
    if (intensity <= 8) return Colors.heatmap.high;
    return Colors.heatmap.severe;
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await fetchMonthlyRecords(visibleMonth.year, visibleMonth.month);
        if (!mounted) return;
        setMonthlyRecords(data);
      } catch (err) {
        console.error('[Home] 월별 통증 기록 조회 실패:', err);
        if (mounted) setMonthlyRecords([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [visibleMonth.month, visibleMonth.year]);

  const markedDates = useMemo(() => {
    return monthlyRecords.reduce<Record<string, { customStyles: { container: { backgroundColor: string } } }>>(
      (acc, item) => {
        acc[item.date] = {
          customStyles: {
            container: {
              backgroundColor: intensityColor(item.intensity),
            },
          },
        };
        return acc;
      },
      {},
    );
  }, [intensityColor, monthlyRecords]);

  // Home 탭이 다시 포커스를 얻을 때마다 주간 통계를 갱신
  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      (async () => {
        try {
          const data = await fetchWeeklyStats();
          if (!mounted) return;
          setStats(data);
        } catch (err) {
          console.error('[Home] 주간 통계 조회 실패:', err);
          if (mounted) setStats(null);
        }
      })();

      return () => {
        mounted = false;
      };
    }, []),
  );

  return (
    <View style={styles.screenRoot}>
      <Header
        title="홈"
        rightIcon={<Text style={styles.headerAction}>설정</Text>}
        onPressRight={() => {
          // TODO: 설정 화면 연결 시 router.push('/settings');
        }}
        style={styles.headerStretch}
        testID="home-header"
        accessibilityLabel="나아포 홈"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBleed}>
          <View style={styles.heroBubbleL} accessibilityElementsHidden />
          <View style={styles.heroBubbleM} accessibilityElementsHidden />
          <View style={styles.heroBubbleS} accessibilityElementsHidden />
          <Text style={styles.heroBrand}>나아포</Text>
          <Text style={styles.heroTagline}>
            🐬 아포 · 라포(해마)와 함께, 오늘의 통증을 가볍게 기록해요
          </Text>
          <View style={styles.heroWave} accessibilityElementsHidden />
        </View>

        <View style={styles.section}>
          <OceanSectionTitle label="프로필 · 캐릭터" />
          <Card
            variant="elevated"
            padding="md"
            style={styles.oceanElevatedCard}
            testID="home-section-profile"
            accessibilityLabel="프로필 및 캐릭터 영역"
          >
            <View style={styles.profileRow}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarEmoji} accessibilityLabel="캐릭터 자리">
                  🐚
                </Text>
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileHint}>닉네임 · 선택 캐릭터 · 코인</Text>
                <Text style={styles.placeholderText}>
                  기록할수록 바다가 조금씩 밝아져요.
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* 처방 관리 */}
        {/* route: app/prescription.tsx가 app 루트(tabs 바깥)에 있으므로 '/prescription'이 올바름 */}
        <View style={styles.section}>
          <OceanSectionTitle label="처방 관리" />
          <Pressable
            onPress={() => router.push('/prescription')}
            style={({ pressed }) => [
              styles.prescriptionCard,
              pressed && styles.prescriptionCardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="처방 관리 화면으로 이동"
            accessibilityHint="복용 중인 약과 처방 메모를 확인하고 추가할 수 있어요"
          >
            <View style={styles.prescriptionCardInner}>
              <View>
                <Text style={styles.prescriptionCardTitle}>💊 내 처방 확인하기</Text>
                <Text style={styles.prescriptionCardSub}>
                  복용 중인 약과 처방 메모를 정리해요
                </Text>
              </View>
              {/* 카드 전체에 accessibilityLabel이 있으므로 화살표는 스크린리더에서 숨김 */}
              <Text
                style={styles.prescriptionCardArrow}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                ›
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <OceanSectionTitle label="건강 매거진" />
          <Card
            variant="outlined"
            padding="md"
            style={styles.oceanOutlinedCard}
            testID="home-section-magazine"
            accessibilityLabel="건강 매거진 배너"
          >
            <View style={styles.bannerOcean}>
              <View style={styles.bannerShine} />
              <View style={styles.bannerRipple} />
              <Text style={styles.bannerTitle}>오늘의 건강 이야기</Text>
              <Text style={styles.bannerSub}>바다처럼 맑은 정보를 모아둘게요</Text>
            </View>
            <Text style={styles.placeholderCaption}>배너 · 추천 콘텐츠</Text>
          </Card>
        </View>

        <View style={styles.section}>
          <OceanSectionTitle label="통증 기록 캘린더" />
          <Card
            variant="outlined"
            padding="md"
            style={styles.oceanOutlinedCard}
            testID="home-section-calendar"
            accessibilityLabel="통증 기록 히트맵 캘린더"
          >
            <Text style={styles.heatmapLegend}>이번 달 강도 미리보기</Text>
            <View style={styles.heatmapStrip}>
              {HEAT_PREVIEW_KEYS.map((key) => (
                <View
                  key={key}
                  style={[styles.heatCell, { backgroundColor: Colors.heatmap[key] }]}
                  accessibilityElementsHidden
                />
              ))}
            </View>
            <Calendar
              markingType="custom"
              markedDates={markedDates}
              onMonthChange={(date: DateData) => {
                setVisibleMonth({ year: date.year, month: date.month });
              }}
              theme={{
                backgroundColor: 'transparent',
                calendarBackground: 'transparent',
                todayTextColor: Colors.accent,
                selectedDayBackgroundColor: Colors.primary,
              }}
              style={styles.calendar}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleWithAction}>
            <OceanSectionTitle label="이번 주 통계" />
            <Pressable
              onPress={() => router.push('/report')}
              style={({ pressed }) => [
                styles.reportLinkBtn,
                pressed && styles.reportLinkBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="레포트 화면으로 이동"
            >
              <Text style={styles.reportLinkBtnText}>레포트 보기</Text>
            </Pressable>
          </View>
          <View style={styles.statsRow}>
            <Card
              variant="outlined"
              padding="md"
              style={[styles.statCard, styles.oceanStatCard]}
              testID="home-stat-frequent"
              accessibilityLabel="가장 자주 아팠던 부위"
            >
              <Text style={styles.statLabel}>가장 자주 아픈 부위</Text>
              <Text style={styles.statValue}>{stats?.topBodyPart ?? '—'}</Text>
            </Card>
            <View style={styles.statsGap} />
            <Card
              variant="outlined"
              padding="md"
              style={[styles.statCard, styles.oceanStatCard]}
              testID="home-stat-intensity"
              accessibilityLabel="평균 통증 강도"
            >
              <Text style={styles.statLabel}>평균 강도</Text>
              <Text style={styles.statValue}>{stats ? `${stats.avgIntensity.toFixed(1)} / 10` : '— / 10'}</Text>
            </Card>
          </View>
          <Card
            variant="outlined"
            padding="md"
            style={[styles.statCardFull, styles.oceanStatCard]}
            testID="home-stat-count"
            accessibilityLabel="기록 횟수"
          >
            <Text style={styles.statLabel}>기록 횟수</Text>
            <Text style={styles.statValue}>{stats ? `${stats.recordCount}회` : '—회'}</Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerStretch: {
    alignSelf: 'stretch',
  },
  headerAction: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 4,
  },
  heroBleed: {
    marginHorizontal: -H_PAD,
    marginBottom: SECTION_GAP,
    paddingHorizontal: H_PAD,
    paddingTop: 18,
    paddingBottom: 20,
    backgroundColor: Colors.ocean.heroWash,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.ocean.tideBorder,
    overflow: 'hidden',
  },
  heroBubbleL: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.ocean.bubbleSoft,
    top: -36,
    right: -44,
  },
  heroBubbleM: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.ocean.bubble,
    top: 28,
    left: -12,
    opacity: 0.9,
  },
  heroBubbleS: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
    top: 12,
    right: 52,
    opacity: 0.85,
  },
  heroBrand: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: -0.8,
  },
  heroTagline: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textLight,
    fontWeight: '500',
  },
  heroWave: {
    marginTop: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.secondary,
    opacity: 0.65,
    alignSelf: 'flex-start',
    width: '42%',
  },
  section: {
    marginBottom: SECTION_GAP,
  },
  sectionTitleWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    flex: 1,
    minWidth: 0,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
  },
  oceanElevatedCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  oceanOutlinedCard: {
    borderColor: Colors.ocean.cardEdge,
    backgroundColor: Colors.white,
  },
  oceanStatCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.secondary,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.ocean.heroWashDeep,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileAvatarEmoji: {
    fontSize: 28,
  },
  profileCopy: {
    flex: 1,
  },
  profileHint: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.textLight,
    lineHeight: 21,
  },
  placeholderCaption: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textLight,
  },
  bannerOcean: {
    height: 118,
    borderRadius: 14,
    backgroundColor: Colors.ocean.bannerDepth,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 14,
  },
  bannerShine: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.ocean.bannerShine,
    top: -70,
    right: -50,
    opacity: 0.7,
  },
  bannerRipple: {
    position: 'absolute',
    width: '100%',
    height: 28,
    bottom: 0,
    left: 0,
    backgroundColor: Colors.primary,
    opacity: 0.12,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: -0.4,
  },
  bannerSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
    opacity: 0.85,
  },
  heatmapLegend: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: 8,
  },
  heatmapStrip: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    height: 12,
    marginBottom: 12,
  },
  heatCell: {
    flex: 1,
    height: '100%',
  },
  calendar: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    paddingBottom: 4,
    backgroundColor: Colors.heatmap.none,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statCard: {
    flex: 1,
    minHeight: 92,
  },
  statCardFull: {
    marginTop: 12,
    minHeight: 76,
  },
  statsGap: {
    width: 12,
  },
  reportLinkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.ocean.heroWash,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    marginBottom: 10,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  reportLinkBtnPressed: {
    opacity: 0.8,
  },
  reportLinkBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
  },
  prescriptionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.ocean.cardEdge,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    padding: 16,
  },
  prescriptionCardPressed: {
    opacity: 0.85,
  },
  prescriptionCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prescriptionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  prescriptionCardSub: {
    fontSize: 13,
    color: Colors.textLight,
  },
  prescriptionCardArrow: {
    fontSize: 24,
    color: Colors.textLight,
    fontWeight: '300',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.4,
  },
});
