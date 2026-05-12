import { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { OceanBubbles } from '../components/ocean/OceanBubbles';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  YearPicker, GenderCard, GENDER_LABELS,
  type Gender,
} from '../components/common/PersonalizationPicker';

const T = {
  text:        '#FFFFFF',
  textMuted:   'rgba(210,235,250,0.88)',
  secondary:   '#7EC8E3',
  inputBorder: 'rgba(168,216,234,0.32)',
} as const;

// ─── OnboardingScreen ───────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const { user, refreshOnboardingStatus } = useAuth();

  const [birthYear, setBirthYear] = useState(1995);
  const [gender, setGender] = useState<Gender | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!gender) {
      Alert.alert('알림', '성별을 선택해주세요.\n선택하지 않으려면 "선택 안 함"을 눌러주세요.');
      return;
    }
    if (!user?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ birth_year: birthYear, gender })
        .eq('id', user.id);

      if (error) {
        console.error('[Onboarding] update error:', error.message);
        Alert.alert('저장 실패', '다시 시도해주세요.');
        return;
      }

      await refreshOnboardingStatus();
      router.replace('/(tabs)');
    } catch (err) {
      console.error('[Onboarding] Unexpected error:', err);
      Alert.alert('오류', '네트워크 연결을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#3A7AB0', '#1A4068', '#0F2840', '#0A1A2E']}
      locations={[0, 0.35, 0.70, 1]}
      style={s.container}
    >
      <OceanBubbles variant="home" />

      <ScrollView
        contentContainerStyle={s.inner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>나를 알려주세요</Text>
        <Text style={s.subtitle}>
          맞춤 케어를 위한 기본 정보예요.{'\n'}언제든지 설정에서 변경할 수 있어요.
        </Text>

        <View style={s.form}>
          <Text style={s.sectionLabel}>출생 연도</Text>
          <BlurView
            intensity={12}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={s.pickerCard}
          >
            <View style={s.pickerOverlay} />
            <YearPicker value={birthYear} onChange={setBirthYear} />
          </BlurView>

          <Text style={[s.sectionLabel, { marginTop: 24 }]}>성별</Text>
          <View style={s.genderRow}>
            <GenderCard label="남성" selected={gender === 'male'} onPress={() => setGender('male')} />
            <GenderCard label="여성" selected={gender === 'female'} onPress={() => setGender('female')} />
            <GenderCard label="선택 안 함" selected={gender === 'none'} onPress={() => setGender('none')} />
          </View>

          <TouchableOpacity
            style={[s.button, { marginTop: 36 }, loading && s.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <LinearGradient
              colors={['#5A9FE9', '#2E6BBF', '#1A4FA8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.buttonGradient}
            >
              <Text style={s.buttonText}>
                {loading ? '저장 중...' : '나아포 시작하기'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: T.textMuted,
    marginBottom: 40,
    fontWeight: '500',
    lineHeight: 20,
  },
  form: { gap: 12 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: T.secondary,
    letterSpacing: 0.4,
    marginBottom: 4,
    marginLeft: 2,
  },
  pickerCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.inputBorder,
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(74,144,217,0.08)',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1A4FA8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    color: '#EAF4FF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
