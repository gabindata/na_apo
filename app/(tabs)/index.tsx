import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../components/common/Card';
import { CharacterShop } from '../../components/home/CharacterShop';
import { MedicineAlarmSection } from '../../components/home/MedicineAlarmSection';
import { Colors } from '../../constants/colors';
import { getCharacterById } from '../../constants/characters';
import { recommendMagazine, type MagazineBlock } from '../../constants/magazines';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMonthlyRecords, fetchMonthlyStats } from '../../lib/painRecords';
import { fetchUserProfile, type UserProfile } from '../../lib/userProfile';

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
  const { user } = useAuth();
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
  const [statsLoading, setStatsLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [shopVisible, setShopVisible] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!user) {
      setProfile(null);
      return;
    }

    (async () => {
      const data = await fetchUserProfile(user.id);
      if (mounted) setProfile(data);
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

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
      setStatsLoading(true);
      try {
        const [records, monthStats] = await Promise.all([
          fetchMonthlyRecords(visibleMonth.year, visibleMonth.month),
          fetchMonthlyStats(visibleMonth.year, visibleMonth.month),
        ]);
        if (!mounted) return;
        setMonthlyRecords(records);
        setStats(monthStats);
      } catch (err) {
        console.error('[Home] 월별 통증 기록 조회 실패:', err);
        if (mounted) {
          setMonthlyRecords([]);
          setStats(null);
        }
      } finally {
        if (mounted) setStatsLoading(false);
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

  const magazine = useMemo(() => recommendMagazine(stats?.topBodyPart), [stats?.topBodyPart]);
  const magazineThumb = useMemo(
    () =>
      magazine.content.find(
        (block): block is Extract<MagazineBlock, { type: 'image' }> => block.type === 'image',
      ),
    [magazine],
  );

  const activeCharacter = useMemo(
    () => getCharacterById(profile?.selectedCharacter ?? 'mulbeom'),
    [profile?.selectedCharacter],
  );

  return (
    <View style={[styles.screenRoot, { paddingTop: insets.top }]}>
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
          <Image
            source={require('../../assets/logo/naapo_typo_logo_white.png')}
            style={styles.heroBrandLogo}
            resizeMode="contain"
            accessibilityLabel="나아포"
          />
          <Text style={styles.heroTagline}>
            아포·라포와 함께, 오늘의 통증을 가볍게 기록해요
          </Text>
          <View style={styles.heroWave} accessibilityElementsHidden />
        </View>

        <View style={styles.section}>
          <OceanSectionTitle label="프로필" />
          <Card
            variant="elevated"
            padding="md"
            style={styles.oceanElevatedCard}
            testID="home-section-profile"
            accessibilityLabel="프로필 및 캐릭터 영역"
          >
            <View style={styles.profileRow}>
              <Pressable
                style={({ pressed }) => [styles.profileAvatar, pressed && styles.profileAvatarPressed]}
                onPress={() => setShopVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="캐릭터 변경"
              >
                <Image
                  source={activeCharacter.image}
                  style={styles.profileAvatarImage}
                  resizeMode="contain"
                />
              </Pressable>
              <View style={styles.profileCopy}>
                <View style={styles.profileNameRow}>
                  <Text
                    style={styles.profileName}
                    numberOfLines={1}
                    accessibilityLabel={`닉네임 ${profile?.nickname ?? ''}`}
                  >
                    {profile?.nickname ?? '닉네임'}
                  </Text>
                  <View style={styles.coinChip} accessibilityLabel={`보유 코인 ${profile?.coins ?? 0}개`}>
                    <Image
                      source={require('../../assets/logo/coin.png')}
                      style={styles.coinIconImage}
                      resizeMode="contain"
                      accessibilityElementsHidden
                    />
                    <Text style={styles.coinValue}>{profile?.coins ?? 0}</Text>
                  </View>
                </View>
                <Text style={styles.placeholderText}>
                  기록할수록 바다가 조금씩 맑아져요.
                </Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <OceanSectionTitle label="건강 매거진" />
          <Pressable
            onPress={() => router.push(`/magazine/${magazine.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`건강 매거진: ${magazine.title}. 탭하면 읽기`}
            style={({ pressed }) => [pressed && styles.magazineCardPressed]}
          >
            <Card
              variant="outlined"
              padding="md"
              style={styles.oceanOutlinedCard}
              testID="home-section-magazine"
            >
              <View style={styles.magazineRow}>
                <View style={styles.magazineThumbWrap}>
                  {magazineThumb ? (
                    <Image
                      source={magazineThumb.source}
                      style={styles.magazineThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.magazineThumb, styles.magazineThumbPlaceholder]} />
                  )}
                </View>
                <View style={styles.magazineTextWrap}>
                  <Text style={styles.magazineTitle} numberOfLines={2}>
                    {magazine.title}
                  </Text>
                  <Text style={styles.magazineSub} numberOfLines={2}>
                    {magazine.subtitle}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
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
            <OceanSectionTitle label="월별 통계" />
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
              <Text style={styles.statValue}>
                {statsLoading ? '—' : stats?.topBodyPart ? stats.topBodyPart : '—'}
              </Text>
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
              <Text style={styles.statValue}>
                {statsLoading ? '— / 10' : stats ? `${stats.avgIntensity.toFixed(1)} / 10` : '— / 10'}
              </Text>
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
            <Text style={styles.statValue}>
              {statsLoading ? '—회' : stats ? `${stats.recordCount}회` : '—회'}
            </Text>
          </Card>
        </View>

        <View style={styles.section}>
          <OceanSectionTitle label="약 알람" />
          <MedicineAlarmSection />
        </View>
      </ScrollView>

      {user && (
        <CharacterShop
          visible={shopVisible}
          onClose={() => setShopVisible(false)}
          userId={user.id}
          coins={profile?.coins ?? 0}
          selectedCharacter={profile?.selectedCharacter ?? 'mulbeom'}
          ownedCharacters={profile?.ownedCharacters ?? ['mulbeom']}
          onUpdate={(newCoins, newSelected, newOwned) => {
            setProfile((prev) =>
              prev
                ? { ...prev, coins: newCoins, selectedCharacter: newSelected, ownedCharacters: newOwned }
                : null,
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: Colors.background,
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
    paddingTop: 22,
    paddingBottom: 24,
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: 'hidden',
  },
  heroBubbleL: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    top: -36,
    right: -44,
  },
  heroBubbleM: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    top: 28,
    left: -12,
  },
  heroBubbleS: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    top: 12,
    right: 52,
  },
  heroBrandLogo: {
    width: 220,
    height: 70,
    alignSelf: 'flex-start',
  },
  heroTagline: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255, 255, 255, 0.92)',
    fontWeight: '500',
  },
  heroWave: {
    marginTop: 16,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileAvatarPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  profileAvatarImage: {
    width: 56,
    height: 56,
  },
  profileCopy: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.ocean.heroWash,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  coinIconImage: {
    width: 16,
    height: 16,
  },
  coinValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: -0.2,
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
  magazineCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  magazineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  magazineThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.ocean.bubbleSoft,
    flexShrink: 0,
  },
  magazineThumb: {
    width: 72,
    height: 72,
  },
  magazineThumbPlaceholder: {
    backgroundColor: Colors.border,
  },
  magazineTextWrap: {
    flex: 1,
  },
  magazineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  magazineSub: {
    fontSize: 12,
    color: Colors.textLight,
    lineHeight: 18,
  },
  reportLinkBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: Colors.ocean.heroWash,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
  },
  reportLinkBtnPressed: {
    opacity: 0.7,
  },
  reportLinkBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statsGap: {
    width: 10,
  },
  statCard: {
    flex: 1,
  },
  statCardFull: {
    marginTop: 10,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: -0.5,
  },
  heatmapLegend: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 8,
  },
  heatmapStrip: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  heatCell: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  calendar: {
    borderRadius: 12,
  },
  headerStretch: {
    alignSelf: 'stretch',
  },
  headerAction: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
});