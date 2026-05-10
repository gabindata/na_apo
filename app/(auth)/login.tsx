import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, Image,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { OceanBubbles } from '../../components/ocean/OceanBubbles';
import { supabase } from '../../lib/supabase';

// ── 글래스 토큰 ───────────────────────────────────────────
const G = {
  glassBg: 'rgba(255,255,255,0.80)',
  glassBorder: 'rgba(74,144,217,0.22)',
  glassShine: 'rgba(255,255,255,0.95)',
  text: '#13243C',
  textMuted: '#6B8CAE',
  primary: '#4A90D9',
  accent: '#2E5FA3',
} as const;

// ── Supabase 에러 메시지 변환 ─────────────────────────────
function parseAuthError(error: unknown): string {
  if (!(error instanceof Error)) return '알 수 없는 오류가 발생했어요.';
  const msg = error.message.toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials'))
    return '이메일 또는 비밀번호가 올바르지 않아요.';
  if (msg.includes('email not confirmed'))
    return '이메일 인증이 완료되지 않았어요. 메일함을 확인해주세요.';
  if (msg.includes('network') || msg.includes('fetch'))
    return '네트워크 연결을 확인해주세요.';
  if (msg.includes('too many requests'))
    return '요청이 너무 많아요. 잠시 후 다시 시도해주세요.';
  return '로그인 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.';
}

// ── GlassInput ────────────────────────────────────────────
function GlassInput({
  placeholder, value, onChangeText, secureTextEntry = false,
  keyboardType = 'default' as any,
  iconName, onSubmitEditing, returnKeyType = 'done' as any,
}: {
  placeholder: string; value: string; onChangeText: (v: string) => void;
  secureTextEntry?: boolean; keyboardType?: any;
  iconName: keyof typeof Ionicons.glyphMap;
  onSubmitEditing?: () => void; returnKeyType?: any;
}) {
  return (
    <View style={input.wrapper}>
      <BlurView
        intensity={16}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={input.blur}
      >
        <View style={input.overlay} />
        <View style={input.shine} />
        <Ionicons name={iconName} size={18} color={G.textMuted} style={input.icon} />
        <TextInput
          style={input.field}
          placeholder={placeholder}
          placeholderTextColor={G.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
      </BlurView>
    </View>
  );
}

// ── LoginScreen ───────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const handleLogin = async () => {
    if (!canSubmit) return;
    const trimmedEmail = email.trim();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        console.error('[Login] Auth error:', error.message, error);
        Alert.alert('로그인 실패', parseAuthError(error));
      } else {
        console.log('[Login] 로그인 성공');
      }
    } catch (err) {
      console.error('[Login] Unexpected error:', err);
      Alert.alert('오류', parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#DCF0FC', '#B8DCF0', '#8BBDD9']}
      locations={[0, 0.55, 1]}
      style={styles.container}
    >
      {/* 3D 물방울 배경 */}
      <OceanBubbles />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 로고 */}
          <Image
            source={require('../../assets/logo/logo.png')}
            style={styles.logoImg}
            resizeMode="contain"
          />

          {/* 워드마크 */}
          <Image
            source={require('../../assets/logo/naapo_typo_logo_white.png')}
            style={styles.wordmark}
            resizeMode="contain"
          />

          {/* 서브타이틀 */}
          <Text style={styles.subtitle}>몸의 이야기를 기록하세요</Text>

          {/* 입력 폼 */}
          <View style={styles.form}>
            <GlassInput
              placeholder="이메일"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              iconName="mail-outline"
              returnKeyType="next"
            />
            <GlassInput
              placeholder="비밀번호"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              iconName="lock-closed-outline"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            {/* 로그인 버튼 */}
            <Pressable
              onPress={handleLogin}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.loginBtn,
                { opacity: canSubmit ? 1 : 0.45, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <LinearGradient
                colors={['#4F96DF', '#2D6BBF', '#1A4FA8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.loginGradient}
              >
                <Text style={styles.loginText}>{loading ? '로그인 중…' : '로그인'}</Text>
              </LinearGradient>
            </Pressable>

            {/* 회원가입 링크 */}
            <TouchableOpacity
              style={styles.signupBtn}
              onPress={() => router.push('/(auth)/signup')}
            >
              <Text style={styles.signupText}>
                계정이 없으신가요?{'  '}
                <Text style={styles.signupBold}>회원가입</Text>
              </Text>
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
    borderColor: G.glassBorder,
    // subtle shadow
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
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
    backgroundColor: G.glassBg,
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: G.glassShine,
  },
  icon: {
    marginLeft: 16,
    marginRight: 4,
    zIndex: 1,
  },
  field: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '500',
    color: G.text,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },

  // 로고
  logoImg: {
    width: 160,
    height: 160,
    marginBottom: 8,
  },
  wordmark: {
    width: 200,
    height: 60,
    marginTop: -20,
    marginBottom: 8,
  },

  // 서브타이틀
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(19,36,60,0.55)',
    letterSpacing: 0.1,
    marginBottom: 36,
  },

  // 폼
  form: {
    width: '100%',
    gap: 12,
  },

  // 로그인 버튼
  loginBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: '#1A4FA8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  loginGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // 회원가입 링크
  signupBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  signupText: {
    fontSize: 13,
    color: 'rgba(19,36,60,0.50)',
    fontWeight: '500',
  },
  signupBold: {
    color: G.text,
    fontWeight: '800',
  },
});
