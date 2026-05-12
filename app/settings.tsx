import { useState, useEffect } from 'react';
import {
  Alert, Modal, Pressable, ScrollView,
  StyleSheet, Switch, Text, View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Header } from '../components/common/Header';
import { useAuth } from '../contexts/AuthContext';
import { useBgm } from '../contexts/BgmContext';
import { supabase } from '../lib/supabase';
import {
  YearPicker, GenderCard, GENDER_LABELS,
  type Gender,
} from '../components/common/PersonalizationPicker';

const T = {
  text:      '#0C2A45',
  textMuted: '#4A7898',
  secondary: '#1A6FAD',
  primary:   '#2468B8',
} as const;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { prefsLoaded, enabled, setEnabled, volume, setVolume } = useBgm();
  const [loggingOut, setLoggingOut] = useState(false);

  // 기본 정보
  const [savedBirthYear, setSavedBirthYear] = useState(1995);
  const [savedGender, setSavedGender] = useState<Gender | null>(null);
  const [editingField, setEditingField] = useState<'birthYear' | 'gender' | null>(null);
  // 모달 내 임시 값
  const [draftBirthYear, setDraftBirthYear] = useState(1995);
  const [draftGender, setDraftGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('users')
      .select('birth_year, gender')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setSavedBirthYear(data.birth_year ?? 1995);
        setSavedGender((data.gender as Gender | null) ?? null);
      });
  }, [user?.id]);

  const openEdit = (field: 'birthYear' | 'gender') => {
    if (field === 'birthYear') setDraftBirthYear(savedBirthYear);
    else setDraftGender(savedGender);
    setEditingField(field);
  };

  const handleSave = async () => {
    if (editingField === 'gender' && !draftGender) {
      Alert.alert('알림', '성별을 선택해주세요.\n선택하지 않으려면 "선택 안 함"을 눌러주세요.');
      return;
    }
    if (!user?.id) return;

    setSaving(true);
    try {
      const patch = editingField === 'birthYear'
        ? { birth_year: draftBirthYear }
        : { gender: draftGender };

      const { error } = await supabase
        .from('users')
        .update(patch)
        .eq('id', user.id);

      if (error) {
        Alert.alert('저장 실패', '다시 시도해주세요.');
        return;
      }

      if (editingField === 'birthYear') setSavedBirthYear(draftBirthYear);
      else setSavedGender(draftGender);
      setEditingField(null);
    } catch {
      Alert.alert('오류', '네트워크 연결을 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await signOut();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  return (
    <LinearGradient
      colors={['#F2F9FF', '#D0E9F8', '#A8D4EE']}
      locations={[0, 0.5, 1]}
      style={[styles.screenRoot, { paddingBottom: insets.bottom }]}
    >
      <Header
        title="설정"
        leftIcon={<Text style={styles.backIcon}>‹</Text>}
        onPressLeft={() => router.back()}
        style={styles.headerLight}
      />

      <View style={styles.body}>

        {/* 기본 정보 */}
        <Text style={styles.sectionHeading}>기본 정보</Text>
        <View style={[styles.section, styles.sectionMarginBottom]}>
          <Pressable
            style={({ pressed }) => [styles.infoRow, pressed && styles.infoRowPressed]}
            onPress={() => openEdit('birthYear')}
          >
            <View style={styles.infoLeft}>
              <Text style={styles.infoTitle}>출생 연도</Text>
              <Text style={styles.infoValue}>
                {savedBirthYear ? `${savedBirthYear}년` : '미설정'}
              </Text>
            </View>
            <Text style={styles.infoChevron}>›</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [styles.infoRow, pressed && styles.infoRowPressed]}
            onPress={() => openEdit('gender')}
          >
            <View style={styles.infoLeft}>
              <Text style={styles.infoTitle}>성별</Text>
              <Text style={styles.infoValue}>
                {savedGender ? GENDER_LABELS[savedGender] : '미설정'}
              </Text>
            </View>
            <Text style={styles.infoChevron}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionHeading}>앱 설정</Text>
        <View style={[styles.section, styles.sectionMarginBottom]}>
          <View style={styles.bgmRow}>
            <View style={styles.bgmLabels}>
              <Text style={styles.bgmTitle}>배경음악</Text>
            </View>
            <Switch
              value={prefsLoaded && enabled}
              onValueChange={setEnabled}
              disabled={!prefsLoaded}
              trackColor={{ false: 'rgba(100,160,210,0.30)', true: T.secondary }}
              thumbColor={'#ffffff'}
              accessibilityLabel="배경음악 켜기"
            />
          </View>
          {prefsLoaded && enabled ? (
            <View style={styles.volumeBlock}>
              <View style={styles.volumeLabelRow}>
                <Text style={styles.volumeLabel}>음량</Text>
                <Text style={styles.volumeValue}>{Math.round(volume * 100)}%</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                value={volume}
                onValueChange={setVolume}
                minimumTrackTintColor={T.primary}
                maximumTrackTintColor={'rgba(100,160,210,0.30)'}
                thumbTintColor={T.primary}
                accessibilityLabel="배경음악 음량"
              />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [
              styles.logoutRow,
              pressed && styles.logoutRowPressed,
              loggingOut && styles.logoutRowDisabled,
            ]}
            onPress={handleLogout}
            disabled={loggingOut}
            accessibilityRole="button"
            accessibilityLabel="로그아웃"
            accessibilityState={{ disabled: loggingOut }}
          >
            <Text style={styles.logoutText}>{loggingOut ? '로그아웃 중...' : '로그아웃'}</Text>
          </Pressable>
        </View>
      </View>
      {/* 기본 정보 수정 모달 */}
      <Modal
        visible={editingField !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingField(null)}
      >
        <View style={modal.backdrop}>
          <Pressable style={modal.dismissArea} onPress={() => setEditingField(null)} />
          <LinearGradient
            colors={['#1A4068', '#0F2840', '#0A1A2E']}
            style={modal.sheet}
          >
            <View style={modal.handle} />

            <ScrollView showsVerticalScrollIndicator={false}>
              {editingField === 'birthYear' ? (
                <>
                  <Text style={modal.title}>출생 연도 수정</Text>
                  <Text style={modal.subtitle}>스크롤해서 연도를 선택해주세요.</Text>
                  <BlurView
                    intensity={12}
                    tint="dark"
                    experimentalBlurMethod="dimezisBlurView"
                    style={modal.pickerCard}
                  >
                    <View style={modal.pickerOverlay} />
                    <YearPicker value={draftBirthYear} onChange={setDraftBirthYear} />
                  </BlurView>
                </>
              ) : (
                <>
                  <Text style={modal.title}>성별 수정</Text>
                  <Text style={modal.subtitle}>해당하는 항목을 선택해주세요.</Text>
                  <View style={modal.genderRow}>
                    <GenderCard label="남성" selected={draftGender === 'male'} onPress={() => setDraftGender('male')} />
                    <GenderCard label="여성" selected={draftGender === 'female'} onPress={() => setDraftGender('female')} />
                    <GenderCard label="선택 안 함" selected={draftGender === 'none'} onPress={() => setDraftGender('none')} />
                  </View>
                </>
              )}

              <Pressable
                style={({ pressed }) => [
                  modal.saveButton,
                  pressed && { opacity: 0.8 },
                  saving && { opacity: 0.45 },
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                <LinearGradient
                  colors={['#5A9FE9', '#2E6BBF', '#1A4FA8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={modal.saveGradient}
                >
                  <Text style={modal.saveText}>{saving ? '저장 중...' : '저장하기'}</Text>
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </LinearGradient>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const modal = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(126,200,227,0.35)',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(210,235,250,0.70)',
    marginBottom: 28,
    fontWeight: '500',
  },
  pickerCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.32)',
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(74,144,217,0.08)',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    marginTop: 32,
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1A4FA8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  saveGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#EAF4FF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  headerLight: {
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
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: T.textMuted,
    marginBottom: 10,
    marginLeft: 2,
    letterSpacing: -0.2,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.28)',
    overflow: 'hidden',
  },
  sectionMarginBottom: {
    marginBottom: 16,
  },
  bgmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  bgmLabels: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  bgmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: T.text,
  },
  volumeBlock: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(100,160,210,0.28)',
  },
  volumeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 4,
  },
  volumeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: T.text,
  },
  volumeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: T.primary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  logoutRow: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  logoutRowPressed: {
    backgroundColor: 'rgba(198,40,40,0.06)',
  },
  logoutRowDisabled: {
    opacity: 0.55,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  infoRowPressed: {
    backgroundColor: 'rgba(100,160,210,0.08)',
  },
  infoLeft: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: T.text,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: T.textMuted,
  },
  infoChevron: {
    fontSize: 20,
    color: T.textMuted,
    fontWeight: '300',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(100,160,210,0.28)',
    marginHorizontal: 18,
  },
});
