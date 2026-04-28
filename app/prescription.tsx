import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../components/common/Header';
import { Colors } from '../constants/colors';
import {
  fetchPrescriptions,
  addPrescription,
  deletePrescription,
  setPrescriptionActive,
  analyzePrescriptionPhoto,
  type Prescription,
  type PrescriptionVisionResult,
} from '../lib/prescription';

// ─────────────────────────────────────────────
// 알림 설정
// ─────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const NOTIFY_OPTIONS = [
  { label: '아침', hour: 8, minute: 0 },
  { label: '점심', hour: 12, minute: 30 },
  { label: '저녁', hour: 18, minute: 0 },
  { label: '자기 전', hour: 21, minute: 0 },
];

// [4] YYYY-MM-DD 형식 검증
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function scheduleNotifications(
  medicineName: string,
  timeIndices: number[],
): Promise<string[]> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medication', {
      name: '복약 알림',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const ids: string[] = [];
  for (const idx of timeIndices) {
    const { hour, minute } = NOTIFY_OPTIONS[idx];
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💊 복약 알림',
        body: `${medicineName} 복용 시간이에요!`,
        ...(Platform.OS === 'android' ? { channelId: 'medication' } : {}),
      },
      trigger: { hour, minute, repeats: true } as Notifications.NotificationTriggerInput,
    });
    ids.push(id);
  }
  return ids;
}

async function cancelNotifications(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
}

// ─────────────────────────────────────────────
// 처방 카드
// ─────────────────────────────────────────────
function PrescriptionCard({
  item,
  onToggle,
  onDelete,
}: {
  item: Prescription;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string, notificationIds: string[] | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasExtra = (item.effects?.length ?? 0) > 0 || (item.side_effects?.length ?? 0) > 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardMedicine}>{item.medicine_name ?? '약 이름 미입력'}</Text>
          {item.diagnosis ? (
            <View style={styles.diagnosisChip}>
              <Text style={styles.diagnosisChipText}>{item.diagnosis}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={() =>
            Alert.alert('삭제', '이 처방 기록을 삭제할까요?', [
              { text: '취소', style: 'cancel' },
              {
                text: '삭제',
                style: 'destructive',
                onPress: () => onDelete(item.id, item.notification_ids),
              },
            ])
          }
          hitSlop={8}
          accessibilityLabel="처방 삭제"
        >
          <Text style={styles.deleteIcon}>🗑</Text>
        </Pressable>
      </View>

      {item.dosage_rule ? (
        <Text style={styles.cardDetail}>💊 {item.dosage_rule}</Text>
      ) : null}
      <Text style={styles.cardDetail}>
        📅 시작: {item.start_date ?? '—'}
        {!item.is_active && item.end_date ? `  →  종료: ${item.end_date}` : ''}
      </Text>

      {hasExtra && (
        <Pressable onPress={() => setExpanded((v) => !v)} style={styles.expandBtn}>
          <Text style={styles.expandBtnText}>
            {expanded ? '▲ 정보 접기' : '▼ 효능·부작용 보기'}
          </Text>
        </Pressable>
      )}

      {expanded && (
        <View style={styles.extraBlock}>
          {/* [6] AI 참고 정보임을 명시 */}
          <Text style={styles.extraAiNotice}>⚠️ 아래 정보는 AI가 추출한 참고 자료예요. 정확한 내용은 처방전·약사에게 확인하세요.</Text>
          {(item.effects?.length ?? 0) > 0 && (
            <View style={styles.extraSection}>
              <Text style={styles.extraLabel}>효능 (참고)</Text>
              {item.effects!.map((e, i) => (
                <Text key={i} style={styles.extraItem}>• {e}</Text>
              ))}
            </View>
          )}
          {(item.side_effects?.length ?? 0) > 0 && (
            <View style={styles.extraSection}>
              <Text style={styles.extraLabel}>부작용 (참고)</Text>
              {item.side_effects!.map((e, i) => (
                <Text key={i} style={styles.extraItem}>• {e}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      <Pressable
        onPress={() => onToggle(item.id, !item.is_active)}
        style={[styles.toggleBtn, item.is_active ? styles.toggleBtnEnd : styles.toggleBtnResume]}
        accessibilityRole="button"
      >
        <Text style={styles.toggleBtnText}>
          {item.is_active ? '복용 종료' : '복용 재개'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────
// 추가 모달
// ─────────────────────────────────────────────
function AddModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [diagnosis, setDiagnosis] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [dosageRule, setDosageRule] = useState('');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [notifyTimes, setNotifyTimes] = useState<number[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [visionResult, setVisionResult] = useState<PrescriptionVisionResult | null>(null);

  const resetForm = () => {
    setDiagnosis('');
    setMedicineName('');
    setDosageRule('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setNotifyTimes([]);
    setVisionResult(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleNotify = (idx: number) => {
    setNotifyTimes((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  const applyVisionResult = (vision: PrescriptionVisionResult) => {
    setVisionResult(vision);
    if (vision.medicine_name) setMedicineName(vision.medicine_name);
    if (vision.diagnosis) setDiagnosis(vision.diagnosis);
    if (vision.dosage_rule) setDosageRule(vision.dosage_rule);
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    try {
      const vision = await analyzePrescriptionPhoto(base64, 'image/jpeg');
      applyVisionResult(vision);
    } catch (err) {
      // [7] 에러 로깅
      console.error('[Prescription] 사진 분석 실패:', err);
      Alert.alert('분석 실패', '사진 분석에 실패했어요. 직접 입력해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요해요.');
      return;
    }

    // [5] MediaTypeOptions.Images deprecated → ['images'] (Expo SDK 52+)
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.7,
      mediaTypes: ['images'],
    });

    if (result.canceled || !result.assets[0]?.base64) return;
    await analyzeImage(result.assets[0].base64!);
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요해요.');
      return;
    }

    // [5] MediaTypeOptions.Images deprecated → ['images'] (Expo SDK 52+)
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
      mediaTypes: ['images'],
    });

    if (result.canceled || !result.assets[0]?.base64) return;
    await analyzeImage(result.assets[0].base64!);
  };

  const handleSave = async () => {
    if (!medicineName.trim()) {
      Alert.alert('입력 필요', '약 이름을 입력해주세요.');
      return;
    }

    // [4] 날짜 형식 검증
    if (startDate && !isValidDate(startDate)) {
      Alert.alert('날짜 형식 오류', 'YYYY-MM-DD 형식으로 입력해주세요.\n예: 2026-04-28');
      return;
    }

    setIsSaving(true);
    let notificationIds: string[] | null = null;

    try {
      if (notifyTimes.length > 0) {
        const granted = await requestNotificationPermission();
        if (granted) {
          notificationIds = await scheduleNotifications(medicineName.trim(), notifyTimes);
        } else {
          // [2] 권한 거부 시 유저에게 알림 없이 저장됨을 안내
          Alert.alert(
            '알림 권한 없음',
            '알림 권한이 거부되어 복약 알림 없이 처방이 저장돼요.\n설정에서 권한을 허용하면 다음에 알림을 설정할 수 있어요.',
          );
        }
      }

      await addPrescription({
        diagnosis: diagnosis.trim() || null,
        medicine_name: medicineName.trim(),
        dosage_rule: dosageRule.trim() || null,
        start_date: startDate || null,
        effects: visionResult?.effects?.length ? visionResult.effects : null,
        side_effects: visionResult?.side_effects?.length ? visionResult.side_effects : null,
        notification_ids: notificationIds,
      });

      resetForm();
      onSaved();
    } catch (err) {
      // [1] DB 저장 실패 시 이미 등록된 알림 롤백
      if (notificationIds?.length) {
        await cancelNotifications(notificationIds);
      }
      // [7] 에러 로깅
      console.error('[Prescription] 처방 저장 실패:', err);
      Alert.alert('저장 실패', '처방 저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHandle} />
        <View style={styles.modalTitleRow}>
          <Text style={styles.modalTitle}>처방 추가</Text>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={styles.modalClose}>닫기</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 사진 버튼 */}
          <View style={styles.photoRow}>
            <Pressable
              onPress={handlePhoto}
              disabled={isAnalyzing}
              style={[styles.photoBtn, isAnalyzing && styles.photoBtnDisabled]}
            >
              {isAnalyzing ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.photoBtnText}>📷  카메라로 자동 입력</Text>
              )}
            </Pressable>
            <Pressable
              onPress={handleGallery}
              disabled={isAnalyzing}
              style={[styles.galleryBtn, isAnalyzing && styles.photoBtnDisabled]}
            >
              <Text style={styles.galleryBtnText}>🖼  갤러리</Text>
            </Pressable>
          </View>

          {/* [6] 분석 결과 프리뷰 — AI 참고 정보임을 명시 */}
          {visionResult && (
            <View style={styles.visionBanner}>
              <Text style={styles.visionBannerText}>
                ✅ 사진 분석 완료 — AI가 추출한 참고 정보예요. 반드시 내용을 확인·수정한 뒤 저장하세요.
              </Text>
              {visionResult.effects?.length > 0 && (
                <Text style={styles.visionDetail}>
                  효능 (참고): {visionResult.effects.join(', ')}
                </Text>
              )}
              {visionResult.side_effects?.length > 0 && (
                <Text style={styles.visionDetail}>
                  부작용 (참고): {visionResult.side_effects.join(', ')}
                </Text>
              )}
            </View>
          )}

          <View style={styles.divider} />

          {/* 입력 필드 */}
          <Text style={styles.fieldLabel}>약 이름 *</Text>
          <TextInput
            style={styles.fieldInput}
            value={medicineName}
            onChangeText={setMedicineName}
            placeholder="예: 타이레놀"
            placeholderTextColor={Colors.textLight}
          />

          <Text style={styles.fieldLabel}>병명</Text>
          <TextInput
            style={styles.fieldInput}
            value={diagnosis}
            onChangeText={setDiagnosis}
            placeholder="예: 감기, 요통"
            placeholderTextColor={Colors.textLight}
          />

          <Text style={styles.fieldLabel}>복용 규칙</Text>
          <TextInput
            style={styles.fieldInput}
            value={dosageRule}
            onChangeText={setDosageRule}
            placeholder="예: 아침·점심·저녁 식후 30분"
            placeholderTextColor={Colors.textLight}
          />

          <Text style={styles.fieldLabel}>시작일</Text>
          <TextInput
            style={styles.fieldInput}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textLight}
            keyboardType="numbers-and-punctuation"
          />

          {/* 알림 선택 */}
          <Text style={styles.fieldLabel}>복약 알림</Text>
          <View style={styles.notifyRow}>
            {NOTIFY_OPTIONS.map((opt, idx) => (
              <Pressable
                key={idx}
                onPress={() => toggleNotify(idx)}
                style={[
                  styles.notifyChip,
                  notifyTimes.includes(idx) && styles.notifyChipActive,
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: notifyTimes.includes(idx) }}
              >
                <Text
                  style={[
                    styles.notifyChipText,
                    notifyTimes.includes(idx) && styles.notifyChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* 저장 버튼 */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.saveBtn,
              isSaving && styles.saveBtnDisabled,
              pressed && !isSaving && styles.saveBtnPressed,
            ]}
            accessibilityRole="button"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>저장하기</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// 메인 화면
// ─────────────────────────────────────────────
export default function PrescriptionScreen() {
  const insets = useSafeAreaInsets();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const prescriptionsRef = useRef<Prescription[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'ended'>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    prescriptionsRef.current = prescriptions;
  }, [prescriptions]);

  // [8] showIndicator=true일 때만 로딩 스피너 표시 — 최초 진입은 true, 갱신은 false(silent)
  const load = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsLoading(true);
    try {
      const data = await fetchPrescriptions();
      setPrescriptions(data);
    } catch (err) {
      console.error('[Prescription] 불러오기 실패:', err);
    } finally {
      // 로딩 표시 중이었을 때만 false로 전환하여 stale loading state 방지
      if (showIndicator) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true); // 최초 진입 시 스피너 표시
  }, [load]);

  const handleToggle = useCallback(async (id: string, isActive: boolean) => {
    try {
      await setPrescriptionActive(id, isActive);
      // [3] 복용 종료 시 알림 취소
      if (!isActive) {
        const target = prescriptionsRef.current.find((p) => p.id === id);
        if (target?.notification_ids?.length) {
          await cancelNotifications(target.notification_ids);
        }
      }
      // [3] 복용 재개 시 알림을 자동으로 다시 생성하지 않음
      // 이유: notification_ids는 처방 저장 시 설정한 시간 기반으로만 생성되며,
      //       재개 시점에서 어떤 시간대를 원하는지 알 수 없기 때문.
      //       필요하면 처방을 삭제 후 다시 추가하거나 별도 알림 설정 기능 구현 필요.
      await load();
    } catch (err) {
      // [7] 에러 로깅
      console.error('[Prescription] 상태 변경 실패:', err);
      Alert.alert('오류', '상태 변경에 실패했어요.');
    }
  }, [load]);

  const handleDelete = useCallback(async (id: string, notificationIds: string[] | null) => {
    try {
      if (notificationIds?.length) {
        await cancelNotifications(notificationIds);
      }
      await deletePrescription(id);
      await load();
    } catch (err) {
      // [7] 에러 로깅
      console.error('[Prescription] 삭제 실패:', err);
      Alert.alert('오류', '삭제에 실패했어요.');
    }
  }, [load]);

  const filtered = prescriptions.filter((p) =>
    activeTab === 'active' ? p.is_active : !p.is_active,
  );

  return (
    <View style={[styles.screenRoot, { paddingBottom: insets.bottom }]}>
      <Header
        title="처방 관리"
        rightIcon={<Text style={styles.addBtn}>+ 추가</Text>}
        onPressRight={() => setShowAddModal(true)}
        style={styles.headerStretch}
      />

      {/* 탭 */}
      <View style={styles.tabRow}>
        {(['active', 'ended'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'active' ? '복용 중' : '종료'}
              {'  '}
              <Text style={styles.tabCount}>
                {prescriptions.filter((p) => (tab === 'active' ? p.is_active : !p.is_active)).length}
              </Text>
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {activeTab === 'active'
              ? '복용 중인 처방이 없어요.\n+ 추가 버튼으로 기록해보세요.'
              : '종료된 처방이 없어요.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PrescriptionCard
              item={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <AddModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => {
          setShowAddModal(false);
          load(); // silent refresh — 스피너 없이 목록 갱신
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────
const H_PAD = 20;

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerStretch: { alignSelf: 'stretch' },
  addBtn: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  tabCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: H_PAD,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: H_PAD,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  // 카드
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.ocean.cardEdge,
    padding: 16,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginRight: 8,
  },
  cardMedicine: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  diagnosisChip: {
    backgroundColor: Colors.ocean.heroWash,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  diagnosisChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
  },
  deleteIcon: {
    fontSize: 16,
  },
  cardDetail: {
    fontSize: 13,
    color: Colors.textLight,
    lineHeight: 20,
  },
  expandBtn: {
    marginTop: 4,
  },
  expandBtnText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  extraBlock: {
    marginTop: 6,
    padding: 12,
    backgroundColor: Colors.ocean.heroWash,
    borderRadius: 10,
    gap: 8,
  },
  extraAiNotice: {
    fontSize: 11,
    color: Colors.textLight,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  extraSection: { gap: 3 },
  extraLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
  },
  extraItem: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  toggleBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  toggleBtnEnd: {
    backgroundColor: Colors.border,
  },
  toggleBtnResume: {
    backgroundColor: Colors.ocean.heroWash,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  // 모달
  modalRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  modalClose: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600',
  },
  modalScroll: { flex: 1 },
  modalScrollContent: {
    padding: H_PAD,
    paddingBottom: 40,
    gap: 4,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  galleryBtn: {
    backgroundColor: Colors.ocean.heroWash,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtnDisabled: { opacity: 0.6 },
  photoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  galleryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },
  visionBanner: {
    backgroundColor: '#EAF7EE',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    gap: 4,
  },
  visionBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D7A4F',
  },
  visionDetail: {
    fontSize: 12,
    color: '#2D7A4F',
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textLight,
    marginTop: 12,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ocean.cardEdge,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
  },
  notifyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  notifyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  notifyChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  notifyChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textLight,
  },
  notifyChipTextActive: {
    color: Colors.white,
  },
  saveBtn: {
    marginTop: 24,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
