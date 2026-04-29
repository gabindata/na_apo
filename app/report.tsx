import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { CartesianChart, Line, Bar } from 'victory-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../components/common/Header';
import { Colors } from '../constants/colors';
import { fetchRecentRecords, type PainRecord } from '../lib/painRecords';

type PeriodKey = '7' | '30' | '90';

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

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<PeriodKey>('30');
  const [records, setRecords] = useState<PainRecord[]>([]);
  const [loading, setLoading] = useState(false);

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

  const lineData = useMemo(() => {
    const daily = new Map<string, { sum: number; count: number }>();

    for (const row of records) {
      if (row.intensity == null || Number.isNaN(Number(row.intensity))) continue;
      const key = toDateKey(getRecordTime(row));
      const prev = daily.get(key) ?? { sum: 0, count: 0 };
      daily.set(key, { sum: prev.sum + Number(row.intensity), count: prev.count + 1 });
    }

    const entries = Array.from(daily.entries());
    return entries.map(([x, v]) => ({
      x,
      y: Math.round((v.sum / v.count) * 10) / 10,
    }));
  }, [records]);

  const barData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of records) {
      const part = row.body_part?.trim();
      if (!part) continue;
      counts.set(part, (counts.get(part) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([x, y]) => ({ x, y }));
  }, [records]);

  const emotions = useMemo(() => {
    const summary = { good: 0, normal: 0, bad: 0 };
    for (const row of records) {
      if (row.emotion === '좋음') summary.good += 1;
      else if (row.emotion === '보통') summary.normal += 1;
      else if (row.emotion === '나쁨') summary.bad += 1;
    }
    return summary;
  }, [records]);

  return (
    <View style={[styles.screenRoot, { paddingBottom: insets.bottom }]}>
      <Header
        title="레포트"
        leftIcon={<Text style={styles.backIcon}>‹</Text>}
        onPressLeft={() => router.back()}
        style={styles.headerStretch}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기간 선택</Text>
          <View style={styles.periodRow}>
            {PERIOD_OPTIONS.map((option) => {
              const selected = option.key === period;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setPeriod(option.key)}
                  style={[styles.periodBtn, selected && styles.periodBtnActive]}
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>통증 강도 추이</Text>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : lineData.length === 0 ? (
            <Text style={styles.emptyText}>표시할 기록이 없어요.</Text>
          ) : (
            <View style={styles.chartBoxLine}>
              <CartesianChart
                data={lineData}
                xKey="x"
                yKeys={['y']}
                padding={20}
                domain={{ y: [0, 10] }}
                xAxis={{
                  axisSide: 'bottom',
                  formatXLabel: (label) => String(label),
                  labelColor: Colors.textLight,
                  tickCount: Math.min(6, lineData.length),
                }}
                yAxis={[
                  {
                    axisSide: 'left',
                    domain: [0, 10],
                    tickCount: 5,
                    formatYLabel: (v) => String(v),
                    labelColor: Colors.textLight,
                  },
                ]}
                domainPadding={{ left: 12, right: 12, top: 12, bottom: 12 }}
              >
                {({ points }) => (
                  <Line
                    points={points.y}
                    color={Colors.primary}
                    strokeWidth={3}
                    // 라인 차트의 부드러운 연결을 위해 curveType은 기본값 사용
                  />
                )}
              </CartesianChart>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>부위별 빈도 (상위 5개)</Text>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : barData.length === 0 ? (
            <Text style={styles.emptyText}>표시할 기록이 없어요.</Text>
          ) : (
            <View style={styles.chartBoxBar}>
              <CartesianChart
                data={barData}
                xKey="x"
                yKeys={['y']}
                padding={20}
                domain={{ y: [0, Math.max(...barData.map((d) => d.y), 1)] }}
                xAxis={{
                  axisSide: 'bottom',
                  formatXLabel: (label) => String(label),
                  labelColor: Colors.textLight,
                  tickCount: Math.min(5, barData.length),
                }}
                yAxis={[
                  {
                    axisSide: 'left',
                    domain: [0, Math.max(...barData.map((d) => d.y), 1)],
                    tickCount: 4,
                    formatYLabel: (v) => String(v),
                    labelColor: Colors.textLight,
                  },
                ]}
                domainPadding={{ left: 20, right: 20, top: 12, bottom: 12 }}
              >
                {({ points, chartBounds }) => (
                  <Bar
                    points={points.y}
                    chartBounds={chartBounds}
                    color={Colors.secondary}
                  />
                )}
              </CartesianChart>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>감정 상태 요약</Text>
          <View style={styles.emotionCard}>
            <Text style={styles.emotionText}>
              좋음 {emotions.good}회 · 보통 {emotions.normal}회 · 나쁨 {emotions.bad}회
            </Text>
          </View>
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
  backIcon: {
    fontSize: 28,
    color: Colors.primary,
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
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.ocean.cardEdge,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  periodBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  periodBtnTextActive: {
    color: Colors.white,
  },
  loadingBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textLight,
    paddingVertical: 16,
  },
  chartBoxLine: {
    height: 260,
    width: '100%',
  },
  chartBoxBar: {
    height: 280,
    width: '100%',
  },
  emotionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    backgroundColor: Colors.ocean.heroWash,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emotionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
});
