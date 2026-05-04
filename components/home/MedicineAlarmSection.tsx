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
import { Card } from '../common/Card';
import { Colors } from '../../constants/colors';
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
      <Card variant="outlined" padding="md" style={styles.card}>
        <View style={styles.cardTopRow}>
          <View>
            <Text style={styles.cardTitle}>💊 약 알람 관리</Text>
            <Text style={styles.cardSub}>
              복용 규칙에 맞춰 알람을 추가하고, 복용 종료 시 바로 중단할 수 있어요.
            </Text>
          </View>
          <Pressable onPress={() => setShowModal(true)} style={styles.addBtn} accessibilityRole="button">
            <Text style={styles.addBtnText}>+ 알람 추가</Text>
          </Pressable>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusText}>등록 {alarms.length}개</Text>
          <Text style={styles.statusDivider}>·</Text>
          <Text style={styles.statusText}>동작 중 {activeCount}개</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={Colors.accent} />
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
                    <Pressable onPress={() => handleRestartAlarm(alarm)} style={styles.restartBtn}>
                      <Text style={styles.restartBtnText}>알람 다시 시작</Text>
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
      </Card>

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
            <View style={styles.modalCard}>
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
                  placeholderTextColor={Colors.textLight}
                />

                <Text style={styles.fieldLabel}>복용 규칙</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={dosageRule}
                  onChangeText={setDosageRule}
                  placeholderTextColor={Colors.textLight}
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
                        ? { textColor: Colors.text, themeVariant: 'light' as const }
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
                <Pressable
                  onPress={handleAddAlarm}
                  disabled={saving}
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>알람 저장</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: Colors.ocean.cardEdge,
    backgroundColor: Colors.white,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  cardSub: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textLight,
    lineHeight: 18,
    maxWidth: 210,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  statusRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '600',
  },
  statusDivider: {
    marginHorizontal: 6,
    color: Colors.textLight,
  },
  loadingWrap: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.ocean.heroWash,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
  },
  emptySubText: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textLight,
  },
  alarmList: {
    marginTop: 12,
    gap: 10,
  },
  alarmItem: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.background,
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
    color: Colors.text,
  },
  alarmRule: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textLight,
  },
  stateBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  stateBadgeOn: {
    backgroundColor: '#EAF7EE',
    borderColor: '#B8E3C6',
  },
  stateBadgeOff: {
    backgroundColor: '#F4F5F7',
    borderColor: '#D6D9DD',
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stateBadgeTextOn: {
    color: '#2D7A4F',
  },
  stateBadgeTextOff: {
    color: '#6A7380',
  },
  timerChipRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timerChip: {
    borderRadius: 999,
    backgroundColor: Colors.ocean.heroWash,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
  },
  timerChipText: {
    fontSize: 12,
    color: Colors.accent,
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
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F2B9B9',
    paddingVertical: 9,
    alignItems: 'center',
  },
  stopBtnText: {
    fontSize: 12,
    color: '#A33A3A',
    fontWeight: '700',
  },
  restartBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    alignItems: 'center',
  },
  restartBtnText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '700',
  },
  deleteBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 26, 43, 0.35)',
    justifyContent: 'flex-end',
  },
  modalKeyboardAvoid: {
    width: '100%',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  modalClose: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
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
    borderTopColor: Colors.border,
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: Colors.white,
  },
  fieldLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textLight,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  timerHeader: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerAddBtn: {
    borderRadius: 10,
    backgroundColor: Colors.ocean.heroWash,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  timerAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
  },
  timerGuide: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.textLight,
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
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  timerIcon: {
    fontSize: 15,
  },
  timePickBtn: {
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    borderRadius: 12,
    minWidth: 92,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  timerHint: {
    marginLeft: 4,
    fontSize: 12,
    color: Colors.textLight,
    flex: 1,
  },
  timerRemoveBtn: {
    borderWidth: 1,
    borderColor: '#E7C9C9',
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  timerRemoveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A33A3A',
  },
  pickerWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    padding: 8,
  },
  pickerDoneBtn: {
    marginTop: 6,
    alignSelf: 'flex-end',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: Colors.ocean.heroWash,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
  },
  pickerDoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
  },
  saveBtn: {
    borderRadius: 14,
    backgroundColor: Colors.accent,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
});
