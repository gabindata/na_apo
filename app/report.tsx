import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFont } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { Bar, CartesianChart, Line, Scatter } from 'victory-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../components/common/Header';
import { fetchRecentRecords, type PainRecord } from '../lib/painRecords';
import { sendMessage } from '../lib/claude';

const T = {
  text:      '#0C2A45',
  textMuted: '#4A7898',
  secondary: '#1A6FAD',
  primary:   '#2468B8',
} as const;

const AXIS_GRID_COLOR = 'rgba(100,160,210,0.30)';
const AXIS_TICK_WIDTH = 1;
/** Skia 축 숫자·날짜 라벨 (font 없으면 victory-native가 텍스트를 그리지 않음) */
const CHART_AXIS_FONT_SRC = require('../assets/fonts/SeoulNamsan/alternative/Pretendard-Regular.ttf');
const CHART_AXIS_FONT_SIZE = 11;

/** ScrollView 좌우(20×2) + 카드 패딩(styles.section 과 동일 14×2) — 차트 높이 비율 계산용 */
const SCROLL_H_PAD = 20;
const SECTION_CARD_PAD = 14;
const CHART_HORIZONTAL_INSETS = SCROLL_H_PAD * 2 + SECTION_CARD_PAD * 2;
/** 차트 래퍼 높이 ≈ chartInnerWidth × 비율 — 값이 클수록 그래프 플롯이 커짐 */
const LINE_CHART_HEIGHT_RATIO = 0.75;
const BAR_CHART_HEIGHT_RATIO = 0.75;
/** Y축: 위=좋음(3)·아래=나쁨(1) — 일별 최빈 감정 */
const EMOTION_CHART_HEIGHT_RATIO = 0.62;

/** 통증 추이 차트 부위 탭 최대 개수 (= 막대 그래프 상위 개수와 동일) */
const INTENSITY_PART_LINE_COUNT = 5;

type PeriodKey = '7' | '30' | '90';

/** 차트별 AI/안내 토글 키 */
type ChartHintKey = 'intensity' | 'barFreq' | 'emotion';

type AiBoolPanels = Record<ChartHintKey, boolean>;
type AiTextPanels = Record<ChartHintKey, string | null>;

const INITIAL_AI_OPEN: AiBoolPanels = {
  intensity: false,
  barFreq: false,
  emotion: false,
};

const INITIAL_AI_TEXT: AiTextPanels = {
  intensity: null,
  barFreq: null,
  emotion: null,
};

function initialAiOpenByPeriod(): Record<PeriodKey, AiBoolPanels> {
  return {
    '7': { ...INITIAL_AI_OPEN },
    '30': { ...INITIAL_AI_OPEN },
    '90': { ...INITIAL_AI_OPEN },
  };
}

function initialAiTextByPeriod(): Record<PeriodKey, AiTextPanels> {
  return {
    '7': { ...INITIAL_AI_TEXT },
    '30': { ...INITIAL_AI_TEXT },
    '90': { ...INITIAL_AI_TEXT },
  };
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number }[] = [
  { key: '7', label: '1주', days: 7 },
  { key: '30', label: '1달', days: 30 },
  { key: '90', label: '3달', days: 90 },
];

function getRecordTime(row: PainRecord): string {
  return row.recorded_at;
}

function toDateKey(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}/${day}`;
}

/** 빈 문자열/null/문자열 "undefined"는 축 라벨에 그리지 않음 */
function chartAxisLabelText(label: unknown): string {
  if (label == null) return '';
  const s = String(label).trim();
  if (!s || s === 'undefined' || s === 'NaN') return '';
  return s;
}

function emotionScore(emotion: string | null): number | null {
  if (emotion === '좋음') return 3;
  if (emotion === '보통') return 2;
  if (emotion === '나쁨') return 1;
  return null;
}

function emotionYAxisLabel(score: number): string {
  const n = Math.round(Number(score));
  if (n >= 3) return '좋음';
  if (n === 2) return '보통';
  return '나쁨';
}

/** 하루 안에서 가장 많이 기록된 감정 점수 — 동률이면 시간상 가장 마지막 기록 */
function dominantEmotionScore(pairs: { ts: number; s: number }[]): number {
  if (pairs.length === 0) return 1;
  const freq = new Map<number, number>();
  for (const { s } of pairs) {
    freq.set(s, (freq.get(s) ?? 0) + 1);
  }
  let maxC = 0;
  for (const c of freq.values()) {
    if (c > maxC) maxC = c;
  }
  const tops: number[] = [];
  for (const [score, c] of freq) {
    if (c === maxC) tops.push(score);
  }
  if (tops.length === 1) return tops[0]!;
  const topSet = new Set(tops);
  for (let i = pairs.length - 1; i >= 0; i -= 1) {
    if (topSet.has(pairs[i].s)) return pairs[i].s;
  }
  return tops[0]!;
}

/** 하루 안에서 가장 많이 나온 통증 강도 — 동률이면 시간상 가장 마지막 기록 (pairs는 ts 오름차순 정렬 전제) */
function dominantIntensityValue(pairs: { ts: number; v: number }[]): number {
  if (pairs.length === 0) return 0;
  const freq = new Map<number, number>();
  for (const { v } of pairs) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  let maxC = 0;
  for (const c of freq.values()) {
    if (c > maxC) maxC = c;
  }
  const tops: number[] = [];
  for (const [val, c] of freq) {
    if (c === maxC) tops.push(val);
  }
  if (tops.length === 1) return tops[0]!;
  const topSet = new Set(tops);
  for (let i = pairs.length - 1; i >= 0; i -= 1) {
    if (topSet.has(pairs[i].v)) return pairs[i].v;
  }
  return tops[0]!;
}

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [period, setPeriod] = useState<PeriodKey>('30');
  const [records, setRecords] = useState<PainRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const chartAxisFont = useFont(CHART_AXIS_FONT_SRC, CHART_AXIS_FONT_SIZE);

  const selectedDays = useMemo(
    () => PERIOD_OPTIONS.find((p) => p.key === period)?.days ?? 30,
    [period],
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const data = await fetchRecentRecords(selectedDays);
        if (!mounted) return;
        setRecords(data);
      } catch (err) {
        console.error('[Report] 기록 조회 실패:', err);
        if (mounted) setRecords([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedDays]);

  const barData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of records) {
      const part = row.body_part?.trim();
      if (!part || part === 'undefined') continue;
      counts.set(part, (counts.get(part) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, INTENSITY_PART_LINE_COUNT)
      .map(([x, y]) => ({ x, y }));
  }, [records]);

  const [intensityPartTabIdx, setIntensityPartTabIdx] = useState(0);

  /** 차트별 안내 문구 접기/펼치기 */
  const [chartHintOpen, setChartHintOpen] = useState<Record<ChartHintKey, boolean>>({
    intensity: false,
    barFreq: false,
    emotion: false,
  });
  const toggleChartHint = (key: ChartHintKey) => {
    setChartHintOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /** 차트별 AI 분석 — 기간(1주/1달/3달) 탭마다 열림·결과 상태 분리 */
  const [aiOpenByPeriod, setAiOpenByPeriod] = useState<Record<PeriodKey, AiBoolPanels>>(() =>
    initialAiOpenByPeriod(),
  );
  const [aiLoadingByPeriod, setAiLoadingByPeriod] = useState<Record<PeriodKey, AiBoolPanels>>(() => ({
    '7': { ...INITIAL_AI_OPEN },
    '30': { ...INITIAL_AI_OPEN },
    '90': { ...INITIAL_AI_OPEN },
  }));
  const [aiResultByPeriod, setAiResultByPeriod] = useState<Record<PeriodKey, AiTextPanels>>(() =>
    initialAiTextByPeriod(),
  );
  const [aiErrorByPeriod, setAiErrorByPeriod] = useState<Record<PeriodKey, AiTextPanels>>(() =>
    initialAiTextByPeriod(),
  );
  /** key: `${chart}:${JSON.stringify(payload)}` — 동일 입력 재호출 방지 */
  const aiCacheRef = useRef<Map<string, string>>(new Map());

  const intensityPartTabSig = useMemo(() => barData.map((d) => d.x).join('|'), [barData]);

  useEffect(() => {
    setIntensityPartTabIdx(0);
  }, [intensityPartTabSig]);

  const selectedIntensityPartLabel = barData[intensityPartTabIdx]?.x ?? '';

  /** 선택된 부위의 날짜별 최빈 통증 강도(0~10) — 같은 날 여러 건은 빈도 최댓값, 동률은 마지막 기록 */
  const intensityLineForSelectedPart = useMemo(() => {
    if (!selectedIntensityPartLabel) return [];

    const daily = new Map<string, { pairs: { ts: number; v: number }[]; firstTs: number }>();
    for (const row of records) {
      if (row.intensity == null || Number.isNaN(Number(row.intensity))) continue;
      const part = row.body_part?.trim();
      if (!part || part !== selectedIntensityPartLabel) continue;
      const key = toDateKey(getRecordTime(row));
      const ts = new Date(getRecordTime(row)).getTime();
      const v = Math.round(Number(row.intensity) * 10) / 10;
      const prev = daily.get(key) ?? { pairs: [], firstTs: ts };
      prev.pairs.push({ ts, v });
      daily.set(key, {
        pairs: prev.pairs,
        firstTs: Math.min(prev.firstTs, ts),
      });
    }

    const entries = Array.from(daily.entries()).sort((a, b) => a[1].firstTs - b[1].firstTs);
    return entries.map(([x, blob]) => {
      const chron = [...blob.pairs].sort((a, b) => a.ts - b.ts);
      return { x, y: dominantIntensityValue(chron) };
    });
  }, [records, selectedIntensityPartLabel]);

  const barYMax = useMemo(() => Math.max(...barData.map((d) => d.y), 1), [barData]);
  const barYTickValues = useMemo(() => {
    const max = barYMax;
    const ticks: number[] = [0];
    const divisions = Math.min(max, 5);
    for (let i = 1; i <= divisions; i += 1) {
      ticks.push(Math.round((max * i) / divisions));
    }
    return Array.from(new Set(ticks)).sort((a, b) => a - b);
  }, [barYMax]);

  /** 막대 개수가 적을수록 victory-native가 막대를 매우 넓게 그려 축·카드와 붙어 보임 → 여백 보정 */
  const barDensityPadX = barData.length <= 1 ? 56 : barData.length === 2 ? 48 : 38;
  const barInnerGap =
    barData.length <= 1 ? 0.58 : barData.length === 2 ? 0.48 : barData.length <= 4 ? 0.4 : 0.38;

  const emotions = useMemo(() => {
    const summary = { good: 0, normal: 0, bad: 0 };
    for (const row of records) {
      if (row.emotion === '좋음') summary.good += 1;
      else if (row.emotion === '보통') summary.normal += 1;
      else if (row.emotion === '나쁨') summary.bad += 1;
    }
    return summary;
  }, [records]);

  /** 날짜별 최빈 감정(1~3) — 동률이면 그날 가장 늦게 남긴 기록 기준 */
  const emotionLineData = useMemo(() => {
    const daily = new Map<string, { pairs: { ts: number; s: number }[]; firstTs: number }>();
    for (const row of records) {
      const s = emotionScore(row.emotion);
      if (s == null) continue;
      const key = toDateKey(getRecordTime(row));
      const ts = new Date(getRecordTime(row)).getTime();
      const prev = daily.get(key) ?? { pairs: [], firstTs: ts };
      prev.pairs.push({ ts, s });
      daily.set(key, {
        pairs: prev.pairs,
        firstTs: Math.min(prev.firstTs, ts),
      });
    }

    const entries = Array.from(daily.entries()).sort((a, b) => a[1].firstTs - b[1].firstTs);
    return entries.map(([x, v]) => {
      const sorted = [...v.pairs].sort((a, b) => a.ts - b.ts);
      return { x, y: dominantEmotionScore(sorted) };
    });
  }, [records]);

  /** 차트별 AI 분석 입력 페이로드 — 데이터가 비어 있으면 null (호출 자체를 막음) */
  const intensityPayload = useMemo(() => {
    if (!selectedIntensityPartLabel || intensityLineForSelectedPart.length === 0) return null;
    return {
      chart: 'intensity_trend_by_part' as const,
      period_days: selectedDays,
      body_part: selectedIntensityPartLabel,
      daily: intensityLineForSelectedPart.map((d) => ({ date: d.x, intensity: d.y })),
    };
  }, [selectedIntensityPartLabel, intensityLineForSelectedPart, selectedDays]);

  const barFreqPayload = useMemo(() => {
    if (barData.length === 0) return null;
    return {
      chart: 'top_body_parts_frequency' as const,
      period_days: selectedDays,
      items: barData.map((d) => ({ body_part: d.x, count: d.y })),
    };
  }, [barData, selectedDays]);

  const emotionPayload = useMemo(() => {
    const total = emotions.good + emotions.normal + emotions.bad;
    if (emotionLineData.length === 0 && total === 0) return null;
    return {
      chart: 'emotion_trend' as const,
      period_days: selectedDays,
      summary: { good: emotions.good, normal: emotions.normal, bad: emotions.bad },
      daily: emotionLineData.map((d) => ({ date: d.x, score: d.y })),
    };
  }, [emotionLineData, emotions, selectedDays]);

  const aiPayloadByKey = useMemo(
    () =>
      ({
        intensity: intensityPayload,
        barFreq: barFreqPayload,
        emotion: emotionPayload,
      }) as Record<ChartHintKey, unknown>,
    [intensityPayload, barFreqPayload, emotionPayload],
  );

  const cacheKeyFor = useCallback((key: ChartHintKey, payload: unknown) => {
    return `${key}:${JSON.stringify(payload)}`;
  }, []);

  /** 캐시 우선 → 없으면 sendMessage 호출. 동일 입력은 같은 결과를 즉시 반환 (periodKey별 UI 상태 갱신) */
  const fetchAnalysis = useCallback(
    async (key: ChartHintKey, payload: unknown, periodKey: PeriodKey) => {
      if (payload == null) return;
      const cacheKey = cacheKeyFor(key, payload);
      const cached = aiCacheRef.current.get(cacheKey);
      if (cached) {
        setAiResultByPeriod((prev) => ({
          ...prev,
          [periodKey]: { ...prev[periodKey], [key]: cached },
        }));
        setAiErrorByPeriod((prev) => ({
          ...prev,
          [periodKey]: { ...prev[periodKey], [key]: null },
        }));
        setAiLoadingByPeriod((prev) => ({
          ...prev,
          [periodKey]: { ...prev[periodKey], [key]: false },
        }));
        return;
      }

      setAiLoadingByPeriod((prev) => ({
        ...prev,
        [periodKey]: { ...prev[periodKey], [key]: true },
      }));
      setAiErrorByPeriod((prev) => ({
        ...prev,
        [periodKey]: { ...prev[periodKey], [key]: null },
      }));
      setAiResultByPeriod((prev) => ({
        ...prev,
        [periodKey]: { ...prev[periodKey], [key]: null },
      }));

      try {
        const text = await sendMessage(
          [{ role: 'user', content: JSON.stringify(payload) }],
          'report-insight',
        );
        const trimmed = text.trim();
        aiCacheRef.current.set(cacheKey, trimmed);
        setAiResultByPeriod((prev) => ({
          ...prev,
          [periodKey]: { ...prev[periodKey], [key]: trimmed },
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI 분석을 불러오지 못했어요.';
        setAiErrorByPeriod((prev) => ({
          ...prev,
          [periodKey]: { ...prev[periodKey], [key]: msg },
        }));
      } finally {
        setAiLoadingByPeriod((prev) => ({
          ...prev,
          [periodKey]: { ...prev[periodKey], [key]: false },
        }));
      }
    },
    [cacheKeyFor],
  );

  const aiOpen = aiOpenByPeriod[period];
  const aiLoading = aiLoadingByPeriod[period];
  const aiResult = aiResultByPeriod[period];
  const aiError = aiErrorByPeriod[period];

  /** 카드가 열려 있는 동안 데이터(=payload)가 바뀌면 자동 재분석 (캐시 hit이면 즉시) */
  useEffect(() => {
    if (!aiOpen.intensity || !intensityPayload) return;
    fetchAnalysis('intensity', intensityPayload, period);
  }, [period, aiOpen.intensity, intensityPayload, fetchAnalysis]);

  useEffect(() => {
    if (!aiOpen.barFreq || !barFreqPayload) return;
    fetchAnalysis('barFreq', barFreqPayload, period);
  }, [period, aiOpen.barFreq, barFreqPayload, fetchAnalysis]);

  useEffect(() => {
    if (!aiOpen.emotion || !emotionPayload) return;
    fetchAnalysis('emotion', emotionPayload, period);
  }, [period, aiOpen.emotion, emotionPayload, fetchAnalysis]);

  const toggleAi = useCallback((key: ChartHintKey) => {
    setAiOpenByPeriod((prev) => ({
      ...prev,
      [period]: {
        ...prev[period],
        [key]: !prev[period][key],
      },
    }));
  }, [period]);

  const retryAi = useCallback(
    (key: ChartHintKey) => {
      const payload = aiPayloadByKey[key];
      if (payload == null) return;
      const cacheKey = cacheKeyFor(key, payload);
      aiCacheRef.current.delete(cacheKey);
      fetchAnalysis(key, payload, period);
    },
    [aiPayloadByKey, cacheKeyFor, fetchAnalysis, period],
  );

  const chartsReady = Boolean(chartAxisFont);

  /** 차트 아래에 붙는 'AI 분석 보기' 카드 — 닫혀 있을 때는 버튼만, 열리면 결과/로딩/에러 노출 */
  const renderAiCard = (key: ChartHintKey) => {
    const open = aiOpen[key];
    const isLoading = aiLoading[key];
    const result = aiResult[key];
    const error = aiError[key];

    return (
      <View style={styles.aiCard}>
        <Pressable
          onPress={() => toggleAi(key)}
          style={({ pressed }) => [styles.aiToggleBtn, pressed && styles.aiToggleBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={open ? 'AI 분석 접기' : 'AI 분석 보기'}
          accessibilityState={{ expanded: open }}
        >
          <Text style={styles.aiToggleText}>{open ? 'AI 분석 접기' : 'AI 분석 보기'}</Text>
        </Pressable>
        {open ? (
          <View style={styles.aiBody}>
            {isLoading ? (
              <View style={styles.aiLoadingBox}>
                <ActivityIndicator size="small" color={T.secondary} />
                <Text style={styles.aiLoadingText}>AI가 분석 중이에요…</Text>
              </View>
            ) : error ? (
              <>
                <Text style={styles.aiErrorText}>{error}</Text>
                <Pressable
                  onPress={() => retryAi(key)}
                  style={({ pressed }) => [styles.aiRetryBtn, pressed && styles.aiRetryBtnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="AI 분석 다시 시도"
                >
                  <Text style={styles.aiRetryText}>다시 시도</Text>
                </Pressable>
              </>
            ) : result ? (
              <Text style={styles.aiText}>{result}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const chartInnerWidth = Math.max(0, windowWidth - CHART_HORIZONTAL_INSETS);
  const lineChartHeight = Math.round(
    Math.min(Math.max(chartInnerWidth * LINE_CHART_HEIGHT_RATIO, 224), 360),
  );
  const barChartHeight = Math.round(
    Math.min(Math.max(chartInnerWidth * BAR_CHART_HEIGHT_RATIO, 256), 400),
  );
  const emotionChartHeight = Math.round(
    Math.min(Math.max(chartInnerWidth * EMOTION_CHART_HEIGHT_RATIO, 200), 300),
  );

  return (
    <LinearGradient
      colors={['#F2F9FF', '#D0E9F8', '#A8D4EE']}
      locations={[0, 0.5, 1]}
      style={[styles.screenRoot, { paddingBottom: insets.bottom }]}
    >
      <Header
        title="레포트"
        leftIcon={<Text style={styles.backIcon}>‹</Text>}
        onPressLeft={() => router.back()}
        style={styles.headerDark}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.sectionTitleSpacing]}>기간 선택</Text>
          <View style={styles.periodRow}>
            {PERIOD_OPTIONS.map((option) => {
              const selected = option.key === period;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setPeriod(option.key)}
                  style={({ pressed }) => [
                    styles.periodBtn,
                    selected && styles.periodBtnActive,
                    pressed && { opacity: 0.82 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label} 레포트 보기`}
                >
                  <Text style={[styles.periodBtnText, selected && styles.periodBtnTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, styles.sectionChartOverflow]}>
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.sectionTitle, styles.chartTitleInRow]}>통증 강도 추이 (부위별)</Text>
            <Pressable
              onPress={() => toggleChartHint('intensity')}
              style={({ pressed }) => [styles.hintToggleBtn, pressed && styles.hintToggleBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="통증 강도 추이 안내"
              accessibilityState={{ expanded: chartHintOpen.intensity }}
            >
              <Text style={styles.hintToggleText}>
                안내 {chartHintOpen.intensity ? '접기' : '보기'}
              </Text>
            </Pressable>
          </View>
          {chartHintOpen.intensity ? (
            <Text style={styles.chartHint}>
              부위는 탭으로 바꿔서 볼 수 있어요. 하루에 여러 번 기록했다면 그중 가장 많이 나온
              강도를 그날의 점으로 표시하고, 횟수가 같을 때는 마지막에 남긴 기록을 따라가요.
              여기에는 기간 안에서 자주 기록된 부위가 많은 순으로 최대 {INTENSITY_PART_LINE_COUNT}
              개만 나와요.
            </Text>
          ) : null}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={T.secondary} />
            </View>
          ) : barData.length === 0 ? (
            <Text style={styles.emptyText}>표시할 기록이 없어요.</Text>
          ) : !chartsReady ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={T.secondary} />
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.intensityPartTabScroll}
              >
                {barData.map((row, idx) => {
                  const selected = idx === intensityPartTabIdx;
                  return (
                    <Pressable
                      key={row.x}
                      onPress={() => setIntensityPartTabIdx(idx)}
                      style={({ pressed }) => [
                        styles.intensityPartTab,
                        selected && styles.intensityPartTabActive,
                        pressed && styles.intensityPartTabPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${row.x} 통증 추이`}
                    >
                      <Text
                        style={[
                          styles.intensityPartTabText,
                          selected && styles.intensityPartTabTextActive,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {row.x}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {intensityLineForSelectedPart.length === 0 ? (
                <Text style={styles.emptyText}>
                  이 부위에는 통증 강도가 기록된 날짜가 없어요.
                </Text>
              ) : (
                <View style={[styles.chartCenterRow, styles.chartPlotCardInset]}>
                  <View style={[styles.chartWrap, { height: lineChartHeight }]}>
                    <CartesianChart
                      data={intensityLineForSelectedPart}
                      xKey="x"
                      yKeys={['y']}
                      padding={{ left: 38, right: 36, top: 8, bottom: 24 }}
                      domain={{ y: [0, 10] }}
                      frame={{
                        lineColor: AXIS_GRID_COLOR,
                        lineWidth: AXIS_TICK_WIDTH,
                      }}
                      xAxis={{
                        axisSide: 'bottom',
                        font: chartAxisFont ?? undefined,
                        formatXLabel: (label: string | number) => chartAxisLabelText(label),
                        labelColor: T.textMuted,
                        lineColor: AXIS_GRID_COLOR,
                        lineWidth: AXIS_TICK_WIDTH,
                        labelOffset: 6,
                        tickCount: Math.min(
                          8,
                          Math.max(1, intensityLineForSelectedPart.length),
                        ),
                      }}
                      yAxis={[
                        {
                          axisSide: 'left',
                          font: chartAxisFont ?? undefined,
                          domain: [0, 10],
                          tickValues: [0, 2, 4, 6, 8, 10],
                          formatYLabel: (v: number | null) => {
                            const n = Number(v);
                            if (!Number.isFinite(n)) return '';
                            return Number.isInteger(n) ? String(n) : n.toFixed(1);
                          },
                          labelColor: T.textMuted,
                          lineColor: AXIS_GRID_COLOR,
                          lineWidth: AXIS_TICK_WIDTH,
                          labelOffset: 6,
                        },
                      ]}
                      domainPadding={{ left: 6, right: 20, top: 8, bottom: 6 }}
                    >
                      {({ points }) => (
                        <>
                          <Line
                            points={points.y}
                            color={T.secondary}
                            strokeWidth={2.5}
                            curveType="linear"
                          />
                          <Scatter points={points.y} radius={6} color={T.primary} />
                        </>
                      )}
                    </CartesianChart>
                  </View>
                </View>
              )}
            </>
          )}
          {!loading && intensityPayload ? renderAiCard('intensity') : null}
        </View>

        <View style={[styles.section, styles.sectionChartOverflow]}>
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.sectionTitle, styles.chartTitleInRow]}>
              부위별 빈도 (상위 {INTENSITY_PART_LINE_COUNT}개)
            </Text>
            <Pressable
              onPress={() => toggleChartHint('barFreq')}
              style={({ pressed }) => [styles.hintToggleBtn, pressed && styles.hintToggleBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="부위별 빈도 안내"
              accessibilityState={{ expanded: chartHintOpen.barFreq }}
            >
              <Text style={styles.hintToggleText}>
                안내 {chartHintOpen.barFreq ? '접기' : '보기'}
              </Text>
            </Pressable>
          </View>
          {chartHintOpen.barFreq ? (
            <Text style={styles.chartHint}>
              선택한 기간 안에서 부위별로 통증을 기록한 횟수예요. 위 통증 추이 탭과 같은 순서로, 자주
              기록된 부위 상위 {INTENSITY_PART_LINE_COUNT}개만 보여요.
            </Text>
          ) : null}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={T.secondary} />
            </View>
          ) : barData.length === 0 ? (
            <Text style={styles.emptyText}>표시할 기록이 없어요.</Text>
          ) : !chartsReady ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={T.secondary} />
            </View>
          ) : (
            <View style={[styles.chartCenterRow, styles.chartPlotCardInset]}>
              <View style={[styles.chartWrapBar, { height: barChartHeight }]}>
                <CartesianChart
                  data={barData}
                  xKey="x"
                  yKeys={['y']}
                  padding={{ left: 44, right: 44, top: 8, bottom: 46 }}
                  domain={{ y: [0, barYMax] }}
                  frame={{
                    lineColor: AXIS_GRID_COLOR,
                    lineWidth: AXIS_TICK_WIDTH,
                  }}
                  xAxis={{
                    axisSide: 'bottom',
                    font: chartAxisFont ?? undefined,
                    formatXLabel: (label: string | number) => {
                      const raw = chartAxisLabelText(label);
                      if (!raw) return '';
                      return raw.length > 8 ? `${raw.slice(0, 7)}…` : raw;
                    },
                    labelColor: T.textMuted,
                    lineColor: AXIS_GRID_COLOR,
                    lineWidth: AXIS_TICK_WIDTH,
                    labelOffset: 6,
                    tickCount: Math.min(5, barData.length),
                  }}
                  yAxis={[
                    {
                      axisSide: 'left',
                      font: chartAxisFont ?? undefined,
                      domain: [0, barYMax],
                      tickValues: barYTickValues,
                      formatYLabel: (v: number) => `${Math.round(Number(v))}회`,
                      labelColor: T.textMuted,
                      lineColor: AXIS_GRID_COLOR,
                      lineWidth: AXIS_TICK_WIDTH,
                      labelOffset: 6,
                    },
                  ]}
                  domainPadding={{ left: barDensityPadX, right: barDensityPadX, top: 8, bottom: 8 }}
                >
                  {({ points, chartBounds }) => (
                    <Bar
                      points={points.y}
                      chartBounds={chartBounds}
                      barCount={barData.length}
                      innerPadding={barInnerGap}
                      color={T.primary}
                    />
                  )}
                </CartesianChart>
              </View>
            </View>
          )}
          {!loading && barFreqPayload ? renderAiCard('barFreq') : null}
        </View>

        <View style={[styles.section, styles.sectionChartOverflow]}>
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.sectionTitle, styles.chartTitleInRow]}>감정 상태 추이</Text>
            <Pressable
              onPress={() => toggleChartHint('emotion')}
              style={({ pressed }) => [styles.hintToggleBtn, pressed && styles.hintToggleBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="감정 상태 추이 안내"
              accessibilityState={{ expanded: chartHintOpen.emotion }}
            >
              <Text style={styles.hintToggleText}>
                안내 {chartHintOpen.emotion ? '접기' : '보기'}
              </Text>
            </Pressable>
          </View>
          {chartHintOpen.emotion ? (
            <Text style={styles.chartHint}>
              같은 날 여러 번 기록한 경우 그날 가장 많이 나온 감정으로 표시해요. 동률이면 가장 마지막
              기록을 써요.
            </Text>
          ) : null}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={T.secondary} />
            </View>
          ) : emotionLineData.length === 0 ? (
            <Text style={styles.emptyText}>표시할 감정 기록이 없어요.</Text>
          ) : !chartsReady ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={T.secondary} />
            </View>
          ) : (
            <>
              <View style={[styles.chartCenterRow, styles.chartPlotCardInset]}>
                <View style={[styles.chartWrap, { height: emotionChartHeight }]}>
                  <CartesianChart
                    data={emotionLineData}
                    xKey="x"
                    yKeys={['y']}
                    padding={{ left: 46, right: 36, top: 12, bottom: 24 }}
                    domain={{ y: [1, 3] }}
                    frame={{
                      lineColor: AXIS_GRID_COLOR,
                      lineWidth: AXIS_TICK_WIDTH,
                    }}
                    xAxis={{
                      axisSide: 'bottom',
                      font: chartAxisFont ?? undefined,
                      formatXLabel: (label: string | number) => chartAxisLabelText(label),
                      labelColor: T.textMuted,
                      lineColor: AXIS_GRID_COLOR,
                      lineWidth: AXIS_TICK_WIDTH,
                      labelOffset: 6,
                      tickCount: Math.min(8, Math.max(1, emotionLineData.length)),
                    }}
                    yAxis={[
                      {
                        axisSide: 'left',
                        font: chartAxisFont ?? undefined,
                        domain: [1, 3],
                        tickValues: [1, 2, 3],
                        formatYLabel: (v: number) => emotionYAxisLabel(v),
                        labelColor: T.textMuted,
                        lineColor: AXIS_GRID_COLOR,
                        lineWidth: AXIS_TICK_WIDTH,
                        labelOffset: 6,
                      },
                    ]}
                    domainPadding={{ left: 8, right: 20, top: 10, bottom: 8 }}
                  >
                    {({ points }) => (
                      <>
                        <Line
                          points={points.y}
                          color={T.secondary}
                          strokeWidth={2.5}
                          curveType="linear"
                        />
                        <Scatter points={points.y} radius={6} color={T.primary} />
                      </>
                    )}
                  </CartesianChart>
                </View>
              </View>
              <View style={styles.emotionCard}>
                <Text style={styles.emotionText}>
                  기간 요약 · 좋음 {emotions.good}회 · 보통 {emotions.normal}회 · 나쁨{' '}
                  {emotions.bad}회
                </Text>
              </View>
            </>
          )}
          {!loading && emotionPayload ? renderAiCard('emotion') : null}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  headerDark: {
    backgroundColor: 'rgba(242,249,255,0.94)',
    borderBottomColor: 'rgba(100,160,210,0.30)',
  },
  backIcon: {
    fontSize: 28,
    color: T.secondary,
    fontWeight: '500',
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 18,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.28)',
    padding: 16,
  },
  /** 차트 라벨이 카드 모서리에 잘리지 않도록 */
  sectionChartOverflow: {
    overflow: 'visible',
  },
  chartCenterRow: {
    width: '100%',
    alignItems: 'center',
  },
  /** 카드 border(섹션 padding)과 그래프 캔버스 사이 시각적 여백 축소 — Victory padding과 별개 */
  chartPlotCardInset: {
    marginHorizontal: -6,
    marginBottom: -6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: T.text,
    marginBottom: 10,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  chartTitleInRow: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  hintToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(36,104,184,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.35)',
    flexShrink: 0,
  },
  hintToggleBtnPressed: {
    opacity: 0.82,
  },
  hintToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.secondary,
  },
  sectionTitleSpacing: {
    marginBottom: 12,
  },
  chartWrap: {
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'visible',
  },
  chartWrapBar: {
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'visible',
  },
  intensityPartTabScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 14,
    flexGrow: 0,
  },
  intensityPartTab: {
    maxWidth: 160,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.30)',
    backgroundColor: 'rgba(255,255,255,0.50)',
  },
  intensityPartTabActive: {
    borderColor: T.secondary,
    backgroundColor: 'rgba(36,104,184,0.14)',
  },
  intensityPartTabPressed: {
    opacity: 0.82,
  },
  intensityPartTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.textMuted,
  },
  intensityPartTabTextActive: {
    color: T.text,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.30)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.50)',
  },
  periodBtnActive: {
    backgroundColor: 'rgba(36,104,184,0.18)',
    borderColor: T.secondary,
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: T.textMuted,
  },
  periodBtnTextActive: {
    color: T.text,
  },
  loadingBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: T.textMuted,
    paddingVertical: 16,
  },
  chartHint: {
    fontSize: 11,
    color: T.textMuted,
    lineHeight: 16,
    marginBottom: 12,
  },
  emotionCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.28)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emotionText: {
    fontSize: 14,
    fontWeight: '600',
    color: T.text,
  },
  aiCard: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.28)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  aiToggleBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(36,104,184,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.35)',
  },
  aiToggleBtnPressed: {
    opacity: 0.82,
  },
  aiToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: T.secondary,
  },
  aiBody: {
    marginTop: 10,
  },
  aiLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  aiLoadingText: {
    fontSize: 12,
    color: T.textMuted,
  },
  aiText: {
    fontSize: 13,
    lineHeight: 20,
    color: T.text,
  },
  aiErrorText: {
    fontSize: 12,
    color: T.textMuted,
    marginBottom: 8,
    lineHeight: 18,
  },
  aiRetryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(36,104,184,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.35)',
  },
  aiRetryBtnPressed: {
    opacity: 0.82,
  },
  aiRetryText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.secondary,
  },
});
