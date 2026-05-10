import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../common/GlassCard';
import {
  activateMedicineAlarm,
  createAlarm,
  createTimer,
  formatTime,
  hasSeenAlarmPermissionGuide,
  loadMedicineAlarms,
  markAlarmPermissionGuideSeen,
  saveMedicineAlarms,
  stopMedicineAlarm,
  type MedicineAlarm,
  type MedicineAlarmTimer,
} from '../../lib/medicineAlarms';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const T = {
  text:      '#EAF4FF',
  textMuted: '#A4C2DB',
  primary:   '#4A90D9',
  secondary: '#7EC8E3',
  accent:    '#2E5FA3',
};

function TimerEditor({
  timer,
  onPressPick,
  onRemove,
  removable,
}: {
  timer: MedicineAlarmTimer;
  onPressPick: () => void;
  onRemove: () => void;
  removable: boolean;
}) {
  return (
    <View style={styles.timerRow}>
      <Text style={styles.timerIcon}>⏰</Text>
      <Pressable onPress={onPressPick} style={styles.timePickBtn}>
        <Text style={styles.timePickText}>{formatTime(timer.hour, timer.minute)}</Text>
      </Pressable>
      <Text style={styles.timerHint}>매일 반복</Text>
      {removable ? (
        <Pressable onPress={onRemove} style={styles.timerRemoveBtn}>
          <Text style={styles.timerRemoveText}>삭제</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MedicineAlarmSection() {
  const insets = useSafeAreaInsets();
  const [alarms, setAlarms] = useState<MedicineAlarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [medicineName, setMedicineName] = useState('');
  const [dosageRule, setDosageRule] = useState('');
  const [timers, setTimers] = useState<MedicineAlarmTimer[]>([createTimer(8, 0)]);
  const [pickerTimerId, setPickerTimerId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const loaded = await loadMedicineAlarms();
        if (!mounted) return;
        setAlarms(loaded);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const activeCount = useMemo(() => alarms.filter((alarm) => alarm.isActive).length, [alarms]);
  const pickerTarget = useMemo(
    () => timers.find((timer) => timer.id === pickerTimerId) ?? null,
    [pickerTimerId, timers],
  );
  const pickerValue = useMemo(() => {
    const source = pickerTarget ?? timers[0];
    const date = new Date();
    date.setHours(source?.hour ?? 8, source?.minute ?? 0, 0, 0);
    return date;
  }, [pickerTarget, timers]);

  const resetForm = () => {
    setMedicineName('');
    setDosageRule('');
    setTimers([createTimer(8, 0)]);
    setPickerTimerId(null);
  };

  const syncAlarms = async (nextAlarms: MedicineAlarm[]) => {
    setAlarms(nextAlarms);
    await saveMedicineAlarms(nextAlarms);
  };

  const confirmFirstPermissionGuide = () =>
    new Promise<boolean>((resolve) => {
      Alert.alert(
        '알림 권한 안내',
        '약 알람 기능을 사용하려면 알림 권한이 필요해요.\n다음 단계에서 권한 요청 팝업이 표시됩니다.',
        [
          { text: '취소', style: 'cancel', onPress: () => resolve(false) },
          { text: '확인', onPress: () => resolve(true) },
        ],
      );
    });

  const handleAddAlarm = async () => {
    const trimmedName = medicineName.trim();
    const trimmedRule = dosageRule.trim();

    if (!trimmedName) {
      Alert.alert('입력 필요', '약 이름을 입력해주세요.');
      return;
    }
    if (!trimmedRule) {
      Alert.alert('입력 필요', '복용 규칙을 입력해주세요.');
      return;
    }
    if (timers.length === 0) {
      Alert.alert('입력 필요', '최소 1개의 알람 시간을 설정해주세요.');
      return;
    }

    setSaving(true);
    try {
      const seenGuide = await hasSeenAlarmPermissionGuide();
      if (!seenGuide) {
        const proceed = await confirmFirstPermissionGuide();
        if (!proceed) return;
        await markAlarmPermissionGuideSeen();
      }

      const baseAlarm = createAlarm({
        medicineName: trimmedName,
        dosageRule: trimmedRule,
        timers,
      });
      const activeAlarm = await activateMedicineAlarm(baseAlarm);
      const nextAlarms = [activeAlarm, ...alarms];
      await syncAlarms(nextAlarms);
      resetForm();
      setShowModal(false);
      Alert.alert('저장 완료', '약 알람이 설정되었어요.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '알람 설정에 실패했어요.';
      Alert.alert('알람 설정 실패', message);
    } finally {
      setSaving(false);
    }
  };

  const handleStopAlarm = async (target: MedicineAlarm) => {
    try {
      const stopped = await stopMedicineAlarm(target);
      const nextAlarms = alarms.map((alarm) => (alarm.id === target.id ? stopped : alarm));
      await syncAlarms(nextAlarms);
    } catch {
      Alert.alert('중단 실패', '알람 중단 중 문제가 발생했어요.');
    }
  };

  const handleRestartAlarm = async (target: MedicineAlarm) => {
    try {
      const restarted = await activateMedicineAlarm(target);
      const nextAlarms = alarms.map((alarm) => (alarm.id === target.id ? restarted : alarm));
      await syncAlarms(nextAlarms);
    } catch (error) {
      const message = error instanceof Error ? error.message : '알람 재시작에 실패했어요.';
      Alert.alert('재시작 실패', message);
    }
  };

  const handleDeleteAlarm = (target: MedicineAlarm) => {
    Alert.alert('알람 삭제', '이 약 알람을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const stopped = await stopMedicineAlarm(target);
            const nextAlarms = alarms.filter((alarm) => alarm.id !== stopped.id);
            await syncAlarms(nextAlarms);
          } catch {
            Alert.alert('삭제 실패', '알람 삭제 중 문제가 발생했어요.');
          }
        },
      },
    ]);
  };

  const updateTimerTime = (timerId: string, selectedDate: Date) => {
    const hour = selectedDate.getHours();
    const minute = selectedDate.getMinutes();
    setTimers((prev) =>
      prev.map((timer) => (timer.id === timerId ? { ...timer, hour, minute } : timer)),
    );
  };

  const handleTimerPickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const targetId = pickerTimerId;
    if (Platform.OS === 'android') {
      setPickerTimerId(null);
    }
    if (event.type !== 'set' || !selectedDate || !targetId) return;
    updateTimerTime(targetId, selectedDate);
  };

  return (
    <>
      <GlassCard style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>💊 약 알람 관리</Text>
          <Pressable onPress={() => setShowModal(true)} accessibilityRole="button">
            <LinearGradient
              colors={['#5A9FE9', '#2E6BBF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addBtn}
            >
              <Text style={styles.addBtnText}>+ 알람 추가</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusText}>등록 {alarms.length}개</Text>
          <Text style={styles.statusDivider}>·</Text>
          <Text style={styles.statusText}>동작 중 {activeCount}개</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={T.secondary} />
          </View>
        ) : alarms.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>아직 설정된 약 알람이 없어요.</Text>
            <Text style={styles.emptySubText}>+ 알람 추가 버튼으로 첫 알람을 만들어보세요.</Text>
          </View>
        ) : (
          <View style={styles.alarmList}>
            {alarms.map((alarm) => (
              <View key={alarm.id} style={styles.alarmItem}>
                <View style={styles.alarmItemTop}>
                  <View style={styles.alarmInfo}>
                    <Text style={styles.alarmName}>{alarm.medicineName}</Text>
                    <Text style={styles.alarmRule}>{alarm.dosageRule}</Text>
                  </View>
                  <View style={[styles.stateBadge, alarm.isActive ? styles.stateBadgeOn : styles.stateBadgeOff]}>
                    <Text style={[styles.stateBadgeText, alarm.isActive ? styles.stateBadgeTextOn : styles.stateBadgeTextOff]}>
                      {alarm.isActive ? '알람 동작 중' : '알람 중단됨'}
                    </Text>
                  </View>
                </View>

                <View style={styles.timerChipRow}>
                  {alarm.timers.map((timer) => (
                    <View key={timer.id} style={styles.timerChip}>
                      <Text style={styles.timerChipText}>{formatTime(timer.hour, timer.minute)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.alarmActionRow}>
                  {alarm.isActive ? (
                    <Pressable onPress={() => handleStopAlarm(alarm)} style={styles.stopBtn}>
                      <Text style={styles.stopBtnText}>복용 종료 · 알람 중단</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => handleRestartAlarm(alarm)}>
                      <LinearGradient
                        colors={['#5A9FE9', '#2E6BBF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.restartBtn}
                      >
                        <Text style={styles.restartBtnText}>알람 다시 시작</Text>
                      </LinearGradient>
                    </Pressable>
                  )}
                  <Pressable onPress={() => handleDeleteAlarm(alarm)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>삭제</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </GlassCard>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setPickerTimerId(null);
          setShowModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
            style={styles.modalKeyboardAvoid}
          >
            <BlurView
              intensity={40}
              tint="dark"
              experimentalBlurMethod="dimezisBlurView"
              style={styles.modalCard}
            >
              {/* dark ocean overlay */}
              <View style={[StyleSheet.absoluteFill, styles.modalOverlay, { borderTopLeftRadius: 24, borderTopRightRadius: 24 }]} />
              {/* top shine */}
              <View style={styles.modalShine} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>약 알람 추가</Text>
                <Pressable
                  onPress={() => {
                    setPickerTimerId(null);
                    setShowModal(false);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.modalClose}>닫기</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={[
                  styles.modalContent,
                  { paddingBottom: 24 + Math.max(insets.bottom, 10) },
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                <Text style={styles.fieldLabel}>약 이름</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={medicineName}
                  onChangeText={setMedicineName}
                  placeholder="예: 타이레놀"
                  placeholderTextColor={T.textMuted}
                  selectionColor={T.secondary}
                />

                <Text style={styles.fieldLabel}>복용 규칙</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={dosageRule}
                  onChangeText={setDosageRule}
                  placeholder="예: 식후 30분, 1정"
                  placeholderTextColor={T.textMuted}
                  selectionColor={T.secondary}
                />

                <View style={styles.timerHeader}>
                  <Text style={styles.fieldLabel}>알람 타이머</Text>
                  <Pressable
                    onPress={() => setTimers((prev) => [...prev, createTimer(8, 0)])}
                    style={styles.timerAddBtn}
                  >
                    <Text style={styles.timerAddBtnText}>+ 타이머 추가</Text>
                  </Pressable>
                </View>

                <Text style={styles.timerGuide}>복용 횟수만큼 타이머를 추가하세요.</Text>

                <View style={styles.timerEditorList}>
                  {timers.map((timer) => (
                    <TimerEditor
                      key={timer.id}
                      timer={timer}
                      onPressPick={() => setPickerTimerId(timer.id)}
                      onRemove={() =>
                        setTimers((prev) => prev.filter((item) => item.id !== timer.id))
                      }
                      removable={timers.length > 1}
                    />
                  ))}
                </View>

                {pickerTarget ? (
                  <View style={styles.pickerWrap}>
                    <DateTimePicker
                      value={pickerValue}
                      mode="time"
                      is24Hour
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleTimerPickerChange}
                      {...(Platform.OS === 'ios'
                        ? { textColor: T.text, themeVariant: 'dark' as const }
                        : {})}
                    />
                    {Platform.OS === 'ios' ? (
                      <Pressable onPress={() => setPickerTimerId(null)} style={styles.pickerDoneBtn}>
                        <Text style={styles.pickerDoneText}>시간 선택 완료</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </ScrollView>

              <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <Pressable onPress={handleAddAlarm} disabled={saving}>
                  <LinearGradient
                    colors={saving ? ['#2A4A70', '#1A3050'] : ['#4F96DF', '#2D6BBF', '#1A4FA8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveBtn}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={T.text} />
                    ) : (
                      <Text style={styles.saveBtnText}>알람 저장</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </BlurView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    // GlassCard handles the visual; no extra overrides needed
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: T.text,
  },
  addBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EAF4FF',
  },
  statusRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: T.textMuted,
    fontWeight: '600',
  },
  statusDivider: {
    marginHorizontal: 6,
    color: T.textMuted,
  },
  loadingWrap: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(126,180,220,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.45)',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.secondary,
  },
  emptySubText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: T.textMuted,
  },
  alarmList: {
    marginTop: 12,
    gap: 10,
  },
  alarmItem: {
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.32)',
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(126,180,220,0.14)',
  },
  alarmItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  alarmInfo: {
    flex: 1,
  },
  alarmName: {
    fontSize: 14,
    fontWeight: '700',
    color: T.text,
  },
  alarmRule: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: T.textMuted,
  },
  stateBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  stateBadgeOn: {
    backgroundColor: 'rgba(100,210,160,0.15)',
    borderColor: 'rgba(100,210,160,0.40)',
  },
  stateBadgeOff: {
    backgroundColor: 'rgba(126,180,220,0.10)',
    borderColor: 'rgba(168,216,234,0.25)',
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stateBadgeTextOn: {
    color: '#7EDCB0',
  },
  stateBadgeTextOff: {
    color: T.textMuted,
  },
  timerChipRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timerChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(74,144,217,0.20)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.40)',
  },
  timerChipText: {
    fontSize: 12,
    color: T.secondary,
    fontWeight: '700',
  },
  alarmActionRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  stopBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(220,80,80,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(220,120,120,0.35)',
    paddingVertical: 9,
    alignItems: 'center',
  },
  stopBtnText: {
    fontSize: 12,
    color: '#F0AAAA',
    fontWeight: '700',
  },
  restartBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  restartBtnText: {
    fontSize: 12,
    color: '#EAF4FF',
    fontWeight: '700',
  },
  deleteBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(126,180,220,0.08)',
  },
  deleteBtnText: {
    fontSize: 12,
    color: T.textMuted,
    fontWeight: '700',
  },
  // ── Modal ──────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,12,18,0.75)',
    justifyContent: 'flex-end',
  },
  modalKeyboardAvoid: {
    width: '100%',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(168,216,234,0.30)',
  },
  modalOverlay: {
    backgroundColor: 'rgba(8,26,48,0.82)',
  },
  modalShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(168,216,234,0.50)',
    zIndex: 1,
  },
  modalHeader: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(168,216,234,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: T.text,
  },
  modalClose: {
    fontSize: 14,
    fontWeight: '600',
    color: T.secondary,
  },
  modalScroll: {
    maxHeight: '100%',
  },
  modalContent: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  modalFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(168,216,234,0.22)',
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  fieldLabel: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: T.textMuted,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.48)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: T.text,
    backgroundColor: 'rgba(126,180,220,0.20)',
  },
  timerHeader: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerAddBtn: {
    borderRadius: 10,
    backgroundColor: 'rgba(74,144,217,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  timerAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: T.secondary,
  },
  timerGuide: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: T.textMuted,
  },
  timerEditorList: {
    marginTop: 10,
    gap: 8,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.45)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(126,180,220,0.18)',
  },
  timerIcon: {
    fontSize: 15,
  },
  timePickBtn: {
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.40)',
    borderRadius: 12,
    minWidth: 92,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(74,144,217,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickText: {
    color: T.secondary,
    fontSize: 16,
    fontWeight: '700',
  },
  timerHint: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: T.textMuted,
    flex: 1,
  },
  timerRemoveBtn: {
    borderWidth: 1,
    borderColor: 'rgba(220,120,120,0.35)',
    backgroundColor: 'rgba(220,80,80,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  timerRemoveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F0AAAA',
  },
  pickerWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.25)',
    borderRadius: 12,
    backgroundColor: 'rgba(126,180,220,0.10)',
    padding: 8,
  },
  pickerDoneBtn: {
    marginTop: 6,
    alignSelf: 'flex-end',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(74,144,217,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.40)',
  },
  pickerDoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: T.secondary,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EAF4FF',
  },
});
