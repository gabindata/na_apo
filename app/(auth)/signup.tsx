import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { OceanBubbles } from '../../components/ocean/OceanBubbles';
import { supabase } from '../../lib/supabase';

const T = {
  text:        '#FFFFFF',
  textMuted:   'rgba(210,235,250,0.88)',
  secondary:   '#7EC8E3',
  primary:     '#4A90D9',
  inputBg:     'rgba(120,175,220,0.16)',
  inputBorder: 'rgba(168,216,234,0.32)',
} as const;

// 이메일 형식 정규식 (1차 검증)
const EMAIL_REGEX = /\S+@\S+\.\S+/;

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
    <View style={input.wrapper}>
      <BlurView
        intensity={12}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={input.blur}
      >
        <View style={input.overlay} />
        <View style={input.shine} />
        <TextInput
          style={input.field}
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

export default function SignupScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
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

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (signUpError) {
        console.error('[Signup] Auth error:', signUpError.message, signUpError);
        Alert.alert('회원가입 실패', signUpError.message);
        return;
      }

      if (data.user) {
        const { error: profileError } = await supabase.from('users').insert({
          id: data.user.id,
          nickname: trimmedNickname,
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
        Alert.alert('가입 완료', '나아포에 오신 걸 환영해요!');
      } else {
        Alert.alert(
          '인증 메일 발송 📧',
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
      style={styles.container}
    >
      <OceanBubbles variant="home" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.backText}>← 돌아가기</Text>
          </TouchableOpacity>

          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>나아포와 함께 건강을 기록해요</Text>

          <View style={styles.form}>
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
              onSubmitEditing={handleSignup}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              <LinearGradient
                colors={['#5A9FE9', '#2E6BBF', '#1A4FA8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  {loading ? '가입 중...' : '회원가입'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ── GlassInput 스타일 ─────────────────────────────────────
const input = StyleSheet.create({
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
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 32,
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
  },
  form: {
    gap: 12,
  },
  button: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
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
