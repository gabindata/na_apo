import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { fetchPainRecordsForLocalDate, type PainRecord } from '../../lib/painRecords';

type Props = {
  visible: boolean;
  /** YYYY-MM-DD */
  dateKey: string | null;
  onClose: () => void;
};

function koreanDateLabel(dateKey: string): string {
  const [ys, ms, ds] = dateKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return dateKey;
  return `${y}년 ${m}월 ${d}일`;
}

function clockLabel(iso: string): string {
  const t = new Date(iso);
  const h = t.getHours();
  const mi = t.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function DayPainDetailModal({ visible, dateKey, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<PainRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !dateKey) {
      setRows([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await fetchPainRecordsForLocalDate(dateKey);
        if (!cancelled) setRows(data);
      } catch (e) {
        console.error('[DayPainDetailModal] 로드 실패:', e);
        if (!cancelled) {
          setRows([]);
          setError('기록을 불러오지 못했어요.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, dateKey]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.sheetHandle} accessibilityElementsHidden />

          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {dateKey ? koreanDateLabel(dateKey) : ''} 통증 기록
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <Text style={styles.closeBtnText}>닫기</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : rows.length === 0 ? (
            <Text style={styles.emptyText}>표시할 기록이 없어요.</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {rows.map((rec, idx) => {
                const types = rec.pain_type?.filter(Boolean) ?? [];
                const intensity =
                  rec.intensity != null && !Number.isNaN(Number(rec.intensity))
                    ? Math.max(0, Math.min(10, Number(rec.intensity)))
                    : null;

                return (
                  <View
                    key={rec.id}
                    style={[styles.card, idx < rows.length - 1 && styles.cardGap]}
                  >
                    <Text style={styles.cardTime}>
                      {rows.length > 1
                        ? `${clockLabel(rec.recorded_at)} · ${idx + 1}번째`
                        : clockLabel(rec.recorded_at)}
                    </Text>
                    {rec.body_part?.trim() ? (
                      <DetailRow label="부위" value={rec.body_part.trim()} />
                    ) : null}
                    {intensity !== null ? (
                      <DetailRow label="강도" value={`${intensity} / 10`} />
                    ) : null}
                    {types.length > 0 ? (
                      <DetailRow label="유형" value={types.join(', ')} />
                    ) : null}
                    {rec.sleep_hours != null && !Number.isNaN(Number(rec.sleep_hours)) ? (
                      <DetailRow
                        label="수면"
                        value={`${Number(rec.sleep_hours)}시간`}
                      />
                    ) : null}
                    {rec.emotion?.trim() ? (
                      <DetailRow label="감정" value={rec.emotion.trim()} />
                    ) : null}
                    {rec.daily_note?.trim() ? (
                      <View style={styles.noteBlock}>
                        <Text style={styles.detailLabel}>한 줄 메모</Text>
                        <Text style={styles.noteBody}>{rec.daily_note.trim()}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 20, 40, 0.45)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '78%',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.ocean.heroWash,
  },
  closeBtnPressed: {
    opacity: 0.75,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  centerBlock: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  errorText: {
    textAlign: 'center',
    color: Colors.textLight,
    paddingVertical: 20,
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textLight,
    paddingVertical: 20,
    fontSize: 14,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    backgroundColor: Colors.background,
    padding: 14,
  },
  cardGap: {
    marginBottom: 12,
  },
  cardTime: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 10,
  },
  detailLabel: {
    width: 72,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textLight,
    flexShrink: 0,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
    fontWeight: '500',
  },
  noteBlock: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  noteBody: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
});
