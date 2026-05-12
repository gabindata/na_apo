import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
  Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { OceanBubbles } from '../../components/ocean/OceanBubbles';
import { supabase } from '../../lib/supabase';
import {
  YearPicker, GenderCard, GENDER_LABELS,
  type Gender,
} from '../../components/common/PersonalizationPicker';

const T = {
  text:        '#FFFFFF',
  textMuted:   'rgba(210,235,250,0.88)',
  secondary:   '#7EC8E3',
  primary:     '#4A90D9',
  inputBg:     'rgba(120,175,220,0.16)',
  inputBorder: 'rgba(168,216,234,0.32)',
} as const;

const EMAIL_REGEX = /\S+@\S+\.\S+/;

// ─── GlassInput ────────────────────────────────────────────
function GlassInput({
  placeholder, value, onChangeText,
  secureTextEntry = false, keyboardType = 'default' as any,
  textContentType, returnKeyType = 'done' as any, onSubmitEditing,
}: {
  placeholder: string; value: string; onChangeText: (v: string) => void;
  secureTextEntry?: boolean; keyboardType?: any; textContentType?: any;
  returnKeyType?: any; onSubmitEditing?: () => void;
}) {
  return (
    <View style={inp.wrapper}>
      <BlurView
        intensity={12}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={inp.blur}
      >
        <View style={inp.overlay} />
        <View style={inp.shine} />
        <TextInput
          style={inp.field}
          placeholder={placeholder}
          placeholderTextColor="rgba(164,194,219,0.50)"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          selectionColor={T.secondary}
        />
      </BlurView>
    </View>
  );
}

// ─── SignupScreen ───────────────────────────────────────────
export default function SignupScreen() {
  const router = useRouter();

  // Step 1 fields
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Step 2 fields
  const [birthYear, setBirthYear] = useState(1995);
  const [gender, setGender] = useState<Gender | null>(null);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // 부드럽게 스텝 전환
  const animateStep = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0, duration: 180, useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }),
      Animated.timing(slideAnim, {
        toValue: nextStep > step ? -20 : 20, duration: 180, useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(nextStep > step ? 24 : -24);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 260, useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(slideAnim, {
          toValue: 0, duration: 260, useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]).start();
    });
  };

  const handleNext = () => {
    const trimmedNickname = nickname.trim();
    const trimmedEmail = email.trim();

    if (!trimmedNickname || !trimmedEmail || !password || !passwordConfirm) {
      Alert.alert('알림', '모든 항목을 입력해주세요.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert('알림', '올바른 이메일 형식을 입력해주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('알림', '비밀번호가 일치하지 않아요.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('알림', '비밀번호는 6자 이상이어야 해요.');
      return;
    }

    animateStep(2);
  };

  const handleSignup = async () => {
    if (!gender) {
      Alert.alert('알림', '성별을 선택해주세요.\n선택하지 않으려면 "선택 안 함"을 눌러주세요.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { nickname: nickname.trim() } },
      });

      if (signUpError) {
        console.error('[Signup] Auth error:', signUpError.message, signUpError);
        const isAlreadyRegistered =
          signUpError.message.toLowerCase().includes('already registered') ||
          signUpError.message.toLowerCase().includes('already exists');
        Alert.alert(
          isAlreadyRegistered ? '이미 가입된 이메일이에요' : '회원가입 실패',
          isAlreadyRegistered
            ? '이미 사용 중인 이메일입니다. 로그인 화면에서 로그인해 주세요.'
            : signUpError.message,
        );
        return;
      }

      if (data.user) {
        const { error: profileError } = await supabase.from('users').upsert({
          id: data.user.id,
          nickname: nickname.trim(),
          birth_year: birthYear,
          gender,
          coins: 0,
          selected_character: 'default',
        });

        if (profileError) {
          console.error('[Signup] Profile insert error:', profileError.message, profileError);
          Alert.alert('회원가입은 되었지만', '프로필 저장 중 문제가 발생했어요. 로그인 후 다시 시도해주세요.');
          return;
        }
      }

      if (data.session) {
        Alert.alert('환영해요!', '나아포에 오신 걸 환영해요.');
      } else {
        Alert.alert(
          '인증 메일을 보냈어요',
          '이메일 인증 후 로그인해주세요.',
          [{ text: '확인', onPress: () => router.replace('/(auth)/login') }]
        );
      }

    } catch (err) {
      console.error('[Signup] Unexpected error:', err);
      Alert.alert('오류', '네트워크 연결을 확인하고 다시 시도해주세요.');
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

      {/* 진행 도트 */}
      <View style={s.progress}>
        <View style={[s.dot, step === 1 && s.dotActive]} />
        <View style={[s.dot, step === 2 && s.dotActive]} />
      </View>

      <Animated.View
        style={[
          { flex: 1 },
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {step === 1 ? (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={s.inner}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity
                style={s.backButton}
                onPress={() => router.replace('/(auth)/login')}
              >
                <Text style={s.backText}>← 돌아가기</Text>
              </TouchableOpacity>

              <Text style={s.title}>회원가입</Text>
              <Text style={s.subtitle}>나아포와 함께 건강을 기록해요</Text>

              <View style={s.form}>
                <GlassInput
                  placeholder="닉네임"
                  value={nickname}
                  onChangeText={setNickname}
                  returnKeyType="next"
                />
                <GlassInput
                  placeholder="이메일"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                />
                <GlassInput
                  placeholder="비밀번호 (6자 이상)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="newPassword"
                  returnKeyType="next"
                />
                <GlassInput
                  placeholder="비밀번호 확인"
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  secureTextEntry
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={handleNext}
                />

                <TouchableOpacity style={s.button} onPress={handleNext}>
                  <LinearGradient
                    colors={['#5A9FE9', '#2E6BBF', '#1A4FA8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.buttonGradient}
                  >
                    <Text style={s.buttonText}>다음</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <ScrollView
            contentContainerStyle={s.inner}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={s.backButton}
              onPress={() => animateStep(1)}
            >
              <Text style={s.backText}>← 이전</Text>
            </TouchableOpacity>

            <Text style={s.title}>나를 알려주세요</Text>
            <Text style={s.subtitle}>
              맞춤 케어를 위한 기본 정보예요.{'\n'}언제든지 변경할 수 있어요.
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
                <GenderCard
                  label="남성"
                  selected={gender === 'male'}
                  onPress={() => setGender('male')}
                />
                <GenderCard
                  label="여성"
                  selected={gender === 'female'}
                  onPress={() => setGender('female')}
                />
                <GenderCard
                  label="선택 안 함"
                  selected={gender === 'none'}
                  onPress={() => setGender('none')}
                />
              </View>

              <TouchableOpacity
                style={[s.button, { marginTop: 32 }, loading && s.buttonDisabled]}
                onPress={handleSignup}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#5A9FE9', '#2E6BBF', '#1A4FA8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.buttonGradient}
                >
                  <Text style={s.buttonText}>
                    {loading ? '가입 중...' : '나아포 시작하기'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </LinearGradient>
  );
}

// ── GlassInput 스타일 ─────────────────────────────────────
const inp = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.inputBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  blur: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.inputBg,
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  field: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '500',
    color: T.text,
    zIndex: 1,
  },
});

// ── 화면 스타일 ───────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 56,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(126,200,227,0.28)',
  },
  dotActive: {
    width: 20,
    backgroundColor: T.secondary,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 28,
  },
  backText: {
    color: T.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: T.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: T.textMuted,
    marginBottom: 36,
    fontWeight: '500',
    lineHeight: 20,
  },
  form: {
    gap: 12,
  },
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
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#EAF4FF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
