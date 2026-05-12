import { useEffect, useState, type ComponentProps } from 'react';
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
import {
  clearSavedLogin,
  loadSavedLogin,
  saveSavedLogin,
} from '../../lib/savedLoginCredentials';

// ── 다크 오션 토큰 ─────────────────────────────────────────
const G = {
  text:        '#FFFFFF',
  textMuted:   '#C8DFEF',
  secondary:   '#7EC8E3',
  primary:     '#4A90D9',
  inputBg:     'rgba(120,175,220,0.16)',
  inputBorder: 'rgba(168,216,234,0.40)',
  inputShine:  'rgba(255,255,255,0.22)',
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
  textContentType,
  autoComplete,
}: {
  placeholder: string; value: string; onChangeText: (v: string) => void;
  secureTextEntry?: boolean; keyboardType?: any;
  iconName: keyof typeof Ionicons.glyphMap;
  onSubmitEditing?: () => void; returnKeyType?: any;
  textContentType?: ComponentProps<typeof TextInput>['textContentType'];
  autoComplete?: ComponentProps<typeof TextInput>['autoComplete'];
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
        <Ionicons name={iconName} size={18} color={G.secondary} style={input.icon} />
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
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          selectionColor={G.secondary}
          textContentType={textContentType}
          autoComplete={autoComplete}
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
  const [rememberLogin, setRememberLogin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await loadSavedLogin();
      if (!active || !saved) return;
      setEmail(saved.email);
      setPassword(saved.password);
      setRememberLogin(true);
    })();
    return () => {
      active = false;
    };
  }, []);

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
        if (rememberLogin) {
          await saveSavedLogin(trimmedEmail, password);
        } else {
          await clearSavedLogin();
        }
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
              textContentType="emailAddress"
              autoComplete="email"
            />
            <GlassInput
              placeholder="비밀번호"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              iconName="lock-closed-outline"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              textContentType="password"
              autoComplete="password"
            />

            <Pressable
              onPress={() => setRememberLogin((v) => !v)}
              style={({ pressed }) => [styles.rememberRow, pressed && { opacity: 0.85 }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberLogin }}
              accessibilityLabel="로그인 정보 저장"
            >
              <Ionicons
                name={rememberLogin ? 'checkbox' : 'square-outline'}
                size={22}
                color={rememberLogin ? G.secondary : 'rgba(168,216,234,0.55)'}
              />
              <Text style={styles.rememberLabel}>로그인 정보 저장</Text>
            </Pressable>

            {/* 로그인 버튼 */}
            <Pressable
              onPress={handleLogin}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.loginBtn,
                { opacity: canSubmit ? 1 : 0.40, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <LinearGradient
                colors={['#5A9FE9', '#2E6BBF', '#1A4FA8']}
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
    borderColor: G.inputBorder,
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
    backgroundColor: G.inputBg,
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: G.inputShine,
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
    color: 'rgba(210,235,250,0.90)',
    letterSpacing: 0.3,
    marginBottom: 36,
  },

  // 폼
  form: {
    width: '100%',
    gap: 12,
  },

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  rememberLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(210,235,250,0.88)',
    letterSpacing: -0.1,
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
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  loginGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: {
    color: '#EAF4FF',
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
    color: 'rgba(210,235,250,0.80)',
    fontWeight: '500',
  },
  signupBold: {
    color: G.secondary,
    fontWeight: '800',
  },
});
