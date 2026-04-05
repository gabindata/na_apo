import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';

// 이메일 형식 정규식 (1차 검증)
const EMAIL_REGEX = /\S+@\S+\.\S+/;

export default function SignupScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    // trim 처리 (비밀번호는 trim 안 함)
    const trimmedNickname = nickname.trim();
    const trimmedEmail = email.trim();

    // 빈값 체크
    if (!trimmedNickname || !trimmedEmail || !password || !passwordConfirm) {
      Alert.alert('알림', '모든 항목을 입력해주세요.');
      return;
    }

    // 이메일 형식 1차 검증
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

    // 닉네임 중복 여부: 현재는 중복 허용 정책
    // 중복 비허용으로 변경 시 → users 테이블에 unique constraint 추가 +
    // profileError 처리에서 unique violation 에러 코드(23505) 체크 필요

    setLoading(true);
    try {
      // 1단계: Supabase Auth 회원가입
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (signUpError) {
        console.error('[Signup] Auth error:', signUpError.message, signUpError);
        Alert.alert('회원가입 실패', signUpError.message);
        return;
      }

      // 2단계: users 테이블에 프로필 저장
      // insert() 사용: 신규 가입이므로 적합
      // 추후 소셜 로그인 추가 시 upsert() 전환 검토 필요
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
        // Confirm email OFF → 세션이 즉시 생성됨
        // AuthContext가 세션을 감지하여 자동으로 (tabs)로 리디렉트하므로
        // 수동 네비게이션 없이 환영 메시지만 표시
        Alert.alert('가입 완료 🌊', '나아포에 오신 걸 환영해요!');
      } else {
        // Confirm email ON → 이메일 인증 필요
        Alert.alert(
          '인증 메일 발송 📧',
          '이메일 인증 후 로그인해주세요.',
          [{ text: '확인', onPress: () => router.replace('/(auth)/login') }]
        );
      }

    } catch (err) {
      // 네트워크 오류 등 런타임 에러
      console.error('[Signup] Unexpected error:', err);
      Alert.alert('오류', '네트워크 연결을 확인하고 다시 시도해주세요.');
    } finally {
      // 성공/실패/에러 모든 경우에 로딩 해제 보장
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 딥링크 등 진입 경로와 무관하게 로그인 화면으로 명확히 이동 */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.backText}>← 돌아가기</Text>
        </TouchableOpacity>

        <Text style={styles.title}>회원가입</Text>
        <Text style={styles.subtitle}>나아포와 함께 건강을 기록해요</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="닉네임"
            placeholderTextColor={Colors.textLight}
            value={nickname}
            onChangeText={setNickname}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="이메일"
            placeholderTextColor={Colors.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호 (6자 이상)"
            placeholderTextColor={Colors.textLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="비밀번호 확인"
            placeholderTextColor={Colors.textLight}
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleSignup}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? '가입 중...' : '회원가입'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 32,
  },
  backText: {
    color: Colors.primary,
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 40,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
