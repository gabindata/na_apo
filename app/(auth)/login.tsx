import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';

// Supabase 에러 메시지 → 사용자 친화적 메시지로 변환
function parseAuthError(error: unknown): string {
  if (!(error instanceof Error)) return '알 수 없는 오류가 발생했어요.';

  const msg = error.message.toLowerCase();

  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않아요.';
  }
  if (msg.includes('email not confirmed')) {
    return '이메일 인증이 완료되지 않았어요. 메일함을 확인해주세요.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return '네트워크 연결을 확인해주세요.';
  }
  if (msg.includes('too many requests')) {
    return '요청이 너무 많아요. 잠시 후 다시 시도해주세요.';
  }
  return '로그인 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.';
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // 이메일은 trim, 비밀번호는 trim 안 함
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        // 에러 로그 남기기
        console.error('[Login] Auth error:', error.message, error);
        Alert.alert('로그인 실패', parseAuthError(error));
        return;
      }

      // 로그인 성공 시 명시적 이동 없음
      // → AuthContext의 onAuthStateChange가 session을 감지하면
      //   _layout.tsx의 useEffect가 자동으로 /(tabs)로 이동시킴
      console.log('[Login] 로그인 성공');

    } catch (err) {
      // 네트워크 오류 등 런타임 에러
      console.error('[Login] Unexpected error:', err);
      Alert.alert('오류', parseAuthError(err));
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
      {/* 작은 기기에서 키보드 올라왔을 때 스크롤 가능하도록 */}
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 로고 */}
        <Text style={styles.logo}>🌊</Text>
        <Text style={styles.title}>나아포</Text>
        <Text style={styles.subtitle}>통증을 기록하고, 나아가세요</Text>

        {/* 입력 폼 */}
        <View style={styles.form}>
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
            placeholder="비밀번호"
            placeholderTextColor={Colors.textLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? '로그인 중...' : '로그인'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={styles.linkText}>
              계정이 없으신가요? <Text style={styles.linkBold}>회원가입</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 48,
  },
  form: {
    width: '100%',
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
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: Colors.textLight,
    fontSize: 14,
  },
  linkBold: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
});
