import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../../components/common/GlassCard';
import { OceanBubbles } from '../../components/ocean/OceanBubbles';
import { CharacterShop } from '../../components/home/CharacterShop';
import { DayPainDetailModal } from '../../components/home/DayPainDetailModal';
import { MedicineAlarmSection } from '../../components/home/MedicineAlarmSection';
import { Colors } from '../../constants/colors';
import { floatingTabBarOverlayClearance } from '../../constants/tabBar';
import { getCharacterById } from '../../constants/characters';
import { recommendMagazine, type MagazineBlock } from '../../constants/magazines';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMonthlyRecords, fetchMonthlyStats } from '../../lib/painRecords';
import { fetchUserProfile, type UserProfile } from '../../lib/userProfile';

// ── 디자인 토큰 ──────────────────────────────────────────
const T = {
  text:      '#FFFFFF',
  textMuted: '#C8DFEF',
  primary:   '#4A90D9',
  secondary: '#7EC8E3',
  accent:    '#2E5FA3',
} as const;

const H_PAD      = 16;
const SECTION_GAP = 20;

// ── 통증 강도 → 색상 ─────────────────────────────────────
function intensityToColor(v: number) {
  if (v <= 0) return Colors.heatmap.none;
  if (v <= 3) return Colors.heatmap.low;
  if (v <= 6) return Colors.heatmap.mid;
  if (v <= 8) return Colors.heatmap.high;
  return Colors.heatmap.severe;
}

// ── SectionTitle ─────────────────────────────────────────
function SectionTitle({ label, accessory, onAccessory }: {
  label: string; accessory?: string; onAccessory?: () => void;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionDot} />
      <Text style={styles.sectionLabel}>{label}</Text>
      {accessory && (
        <TouchableOpacity onPress={onAccessory} style={styles.sectionAccessory} activeOpacity={0.75}>
          <LinearGradient
            colors={['rgba(74,144,217,0.32)', 'rgba(46,95,163,0.28)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sectionAccessoryGradient}
          >
            <Text style={styles.sectionAccessoryText}>{accessory}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const HEAT_PREVIEW_KEYS = ['none', 'low', 'mid', 'high', 'severe'] as const;

// ── HomeScreen ────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [monthlyRecords, setMonthlyRecords] = useState<{ date: string; intensity: number }[]>([]);
  const [stats, setStats] = useState<{
    topBodyPart: string; avgIntensity: number; recordCount: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [shopVisible, setShopVisible]   = useState(false);
  const [detailDateKey, setDetailDateKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!user) { setProfile(null); return; }
    (async () => {
      const data = await fetchUserProfile(user.id);
      if (mounted) setProfile(data);
    })();
    return () => { mounted = false; };
  }, [user]);

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
        if (mounted) { setMonthlyRecords([]); setStats(null); }
      } finally {
        if (mounted) setStatsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [visibleMonth.month, visibleMonth.year]);

  const markedDates = useMemo(() => {
    return monthlyRecords.reduce<Record<string, { customStyles: { container: object; text: object } }>>((acc, item) => {
      const color = intensityToColor(item.intensity);
      acc[item.date] = {
        customStyles: {
          container: { backgroundColor: color, borderRadius: 10 },
          text: { color: item.intensity >= 4 ? '#fff' : '#13243C', fontWeight: '700' },
        },
      };
      return acc;
    }, {});
  }, [monthlyRecords]);

  const datesWithRecords = useMemo(
    () => new Set(monthlyRecords.map((r) => r.date)),
    [monthlyRecords],
  );

  const magazine = useMemo(() => recommendMagazine(stats?.topBodyPart), [stats?.topBodyPart]);
  const magazineThumb = useMemo(
    () => magazine.content.find(
      (block): block is Extract<MagazineBlock, { type: 'image' }> => block.type === 'image',
    ),
    [magazine],
  );
  const activeCharacter = useMemo(
    () => getCharacterById(profile?.selectedCharacter ?? 'mulbeom'),
    [profile?.selectedCharacter],
  );

  // 오늘 날짜 표시
  const todayLabel = useMemo(() => {
    const now = new Date();
    return `${now.getMonth() + 1}월 ${now.getDate()}일`;
  }, []);

  return (
    <LinearGradient
      colors={['#3A7AB0', '#1A4068', '#0F2840', '#0A1A2E']}
      locations={[0, 0.35, 0.70, 1]}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <OceanBubbles variant="home" />
      {/* 설정 버튼 */}
      <Pressable
        style={({ pressed }) => [
          styles.settingsBtn,
          { top: insets.top + 6 },
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => router.push('/settings')}
        accessibilityLabel="설정"
        hitSlop={12}
      >
        <Ionicons name="settings-outline" size={22} color="rgba(168,216,234,0.85)" />
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: floatingTabBarOverlayClearance(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ──────────────────────────────────────── */}
        <View style={styles.hero}>
          <Text style={styles.heroGreeting}>
            안녕하세요, {profile?.nickname ?? ''}님
          </Text>
          <Image
            source={require('../../assets/logo/naapo_typo_logo_white.png')}
            style={styles.heroLogo}
            resizeMode="contain"
            accessibilityLabel="나아포"
          />
          <Text style={styles.heroTagline}>오늘의 통증을 기록해보아요.</Text>
        </View>

        {/* ── 프로필 ───────────────────────────────────── */}
        <SectionTitle label="프로필" />
        <GlassCard style={styles.sectionCard}>
          <View style={styles.profileRow}>
            <Pressable
              style={({ pressed }) => [
                styles.profileAvatar,
                pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
              ]}
              onPress={() => setShopVisible(true)}
              accessibilityLabel="캐릭터 변경"
            >
              <Image
                source={activeCharacter.image}
                style={styles.profileAvatarImage}
                resizeMode="contain"
              />
            </Pressable>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile?.nickname ?? '닉네임'}
              </Text>
              <Text style={styles.profileSub}>
                오늘 · {todayLabel}
              </Text>
            </View>
            <View style={styles.coinChip}>
              <Image
                source={require('../../assets/logo/coin.png')}
                style={styles.coinIcon}
                resizeMode="contain"
              />
              <Text style={styles.coinValue}>{profile?.coins ?? 0}</Text>
            </View>
          </View>

          {/* 통증 기록 버튼 */}
          <Pressable
            style={({ pressed }) => [
              styles.recordBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
            onPress={() => router.push('/(tabs)/rapo')}
            accessibilityLabel="오늘 통증 기록하기"
          >
            <LinearGradient
              colors={['rgba(74,144,217,0.95)', 'rgba(46,95,163,0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.recordBtnGradient}
            >
              <Text style={styles.recordBtnText}>오늘의 통증 기록하기</Text>
            </LinearGradient>
          </Pressable>
        </GlassCard>

        {/* ── 건강 매거진 ──────────────────────────────── */}
        <SectionTitle label="건강 매거진" />
        <Pressable
          onPress={() => router.push(`/magazine/${magazine.id}`)}
          style={({ pressed }) => pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }}
          accessibilityLabel={`건강 매거진: ${magazine.title}`}
        >
          <GlassCard style={styles.sectionCard}>
            <View style={styles.magazineRow}>
              {/* 썸네일 */}
              <View style={styles.magazineThumbWrap}>
                {magazineThumb ? (
                  <Image
                    source={magazineThumb.source}
                    style={styles.magazineThumbImg}
                    resizeMode="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={['#4A90D9', '#1A2E4A']}
                    style={styles.magazineThumbImg}
                  />
                )}
              </View>
              {/* 텍스트 */}
              <View style={styles.magazineTextWrap}>
                <Text style={styles.magazinePickLabel}>EDITOR'S PICK</Text>
                <Text style={styles.magazineTitle} numberOfLines={3}
                  lineBreakStrategyIOS="hangul-word"
                  textBreakStrategy="balanced"
                >
                  {magazine.title}
                </Text>
                <Text style={styles.magazineSub} numberOfLines={2}
                  lineBreakStrategyIOS="hangul-word"
                  textBreakStrategy="balanced"
                >
                  {magazine.subtitle}
                </Text>
                <View style={styles.magazineReadRow}>
                  <Text style={styles.magazineReadText}>읽어보기</Text>
                  <Ionicons name="chevron-forward" size={12} color={T.secondary} />
                </View>
              </View>
            </View>
          </GlassCard>
        </Pressable>

        {/* ── 통증 기록 캘린더 ─────────────────────────── */}
        <SectionTitle label="통증 기록 캘린더" accessory="이번 달" />
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.heatmapLegendLabel}>이번 달 강도 미리보기</Text>
          <View style={styles.heatmapStrip}>
            {HEAT_PREVIEW_KEYS.map((key) => (
              <View key={key} style={[styles.heatCell, { backgroundColor: Colors.heatmap[key] }]} />
            ))}
          </View>
          <Text style={styles.calHint}>
            색칠된 날짜를 탭하면 그날 기록을 확인할 수 있어요.
          </Text>
          <Calendar
            markingType="custom"
            markedDates={markedDates}
            onDayPress={(day: DateData) => {
              if (datesWithRecords.has(day.dateString)) setDetailDateKey(day.dateString);
            }}
            onMonthChange={(date: DateData) => {
              setVisibleMonth({ year: date.year, month: date.month });
            }}
            theme={{
              backgroundColor: 'transparent',
              calendarBackground: 'transparent',
              todayTextColor: '#FFFFFF',
              todayBackgroundColor: 'rgba(74,144,217,0.38)',
              selectedDayBackgroundColor: T.primary,
              selectedDayTextColor: '#FFFFFF',
              dayTextColor: 'rgba(234,244,255,0.88)',
              textDisabledColor: 'rgba(164,194,219,0.28)',
              monthTextColor: T.text,
              arrowColor: T.secondary,
              textDayFontWeight: '700',
              textMonthFontWeight: '800',
              textDayHeaderFontWeight: '700',
              textDayFontSize: 13,
              textMonthFontSize: 15,
              textDayHeaderFontSize: 11,
              'stylesheet.calendar.header': {
                dayTextAtIndex0: { color: 'rgba(240,150,150,0.80)' },
                dayTextAtIndex6: { color: 'rgba(150,200,240,0.80)' },
              },
            }}
            style={styles.calendar}
          />
        </GlassCard>

        {/* ── 월별 통계 ─────────────────────────────────── */}
        <SectionTitle
          label="월별 통계"
          accessory="레포트 보기 →"
          onAccessory={() => router.push('/report')}
        />
        <View style={styles.statsGrid}>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>평균 강도</Text>
            <Text style={styles.statValue}>
              {statsLoading ? '—' : stats ? stats.avgIntensity.toFixed(1) : '—'}
              <Text style={styles.statUnit}> /10</Text>
            </Text>
            <View style={styles.statBar}>
              <LinearGradient
                colors={[T.secondary, T.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.statBarFill,
                  { width: `${Math.min((stats?.avgIntensity ?? 0) * 10, 100)}%` },
                ]}
              />
            </View>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>기록 횟수</Text>
            <Text style={styles.statValue}>
              {statsLoading ? '—' : stats?.recordCount ?? '—'}
              <Text style={styles.statUnit}> 회</Text>
            </Text>
          </GlassCard>
        </View>
        <GlassCard style={[styles.sectionCard, { marginTop: 10 }]}>
          <View style={styles.statFullRow}>
            <View>
              <Text style={styles.statLabel}>가장 자주 아픈 부위</Text>
              <Text style={styles.statValue}>
                {statsLoading ? '—' : stats?.topBodyPart ?? '—'}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* ── 약 알람 ──────────────────────────────────── */}
        <SectionTitle label="약 알람" />
        <MedicineAlarmSection />
      </ScrollView>

      <DayPainDetailModal
        visible={!!detailDateKey}
        dateKey={detailDateKey}
        onClose={() => setDetailDateKey(null)}
      />

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
              prev ? { ...prev, coins: newCoins, selectedCharacter: newSelected, ownedCharacters: newOwned } : null,
            );
          }}
        />
      )}
    </LinearGradient>
  );
}

// ── 캘린더 스타일 ─────────────────────────────────────────
// ── 화면 스타일 ───────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  settingsBtn: {
    position: 'absolute',
    right: H_PAD,
    zIndex: 30,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll:  { flex: 1 },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 8,
  },

  // Hero
  hero: {
    paddingTop: 10,
    paddingBottom: 26,
    paddingLeft: 4,
  },
  heroGreeting: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C8DFF0',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroLogo: {
    width: 150,
    height: 48,
    marginBottom: 6,
  },
  heroTagline: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(210,232,248,0.88)',
  },

  // 공통 카드 간격
  sectionCard: {
    marginBottom: SECTION_GAP,
  },

  // SectionTitle
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.secondary,
    shadowColor: T.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: T.text,
    letterSpacing: -0.2,
  },
  sectionAccessory: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.40)',
  },
  sectionAccessoryGradient: {
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  sectionAccessoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: T.secondary,
    letterSpacing: 0.2,
  },

  // 프로필
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  profileAvatar: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: 'rgba(126,200,227,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: 56,
    height: 56,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
    color: T.text,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'center',
  },
  coinIcon: { width: 15, height: 15 },
  coinValue: {
    fontSize: 13,
    fontWeight: '700',
    color: T.secondary,
  },
  profileSub: {
    fontSize: 11,
    fontWeight: '700',
    color: T.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 3,
  },

  // 통증 기록 버튼
  recordBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1A4FA8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  recordBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.45)',
    borderRadius: 16,
  },
  recordBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  recordBtnIcon: {
    fontSize: 16,
  },

  // 매거진
  magazineRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  magazineThumbWrap: {
    width: 86,
    height: 86,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.25)',
  },
  magazineThumbImg: {
    width: 86,
    height: 86,
  },
  magazineTextWrap: {
    flex: 1,
    gap: 3,
  },
  magazinePickLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: T.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  magazineTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: T.text,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  magazineSub: {
    fontSize: 12,
    fontWeight: '600',
    color: T.textMuted,
    lineHeight: 17,
  },
  magazineReadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  magazineReadText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.secondary,
  },

  // 캘린더
  heatmapLegendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: T.textMuted,
    marginBottom: 6,
  },
  heatmapStrip: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  heatCell: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  calHint: {
    fontSize: 11,
    color: T.secondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  calendar: {
    borderRadius: 12,
  },

  // 통계
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 0,
  },
  statCard: {
    flex: 1,
  },
  statFullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: T.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    color: T.text,
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  statUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: T.textMuted,
  },
  statBar: {
    marginTop: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});
