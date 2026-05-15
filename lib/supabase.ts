import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// EAS Build는 로컬 .env를 자동으로 읽지 않습니다.
// EAS Dashboard 또는 `eas env:push --environment preview --path .env` 로 등록해야
// 클라이언트 번들에 두 값이 들어옵니다. 누락 시 createClient(undefined, undefined)가
// 즉시 throw → 스플래시 직후 앱이 종료되므로, 여기서 명확한 메시지로 throw해
// adb logcat 에 원인이 분명히 찍히도록 한다.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase 환경변수가 비어 있어요. ' +
      'EAS env(EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY)가 ' +
      '해당 빌드 프로파일(preview/production)에 등록됐는지 확인하세요.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,        // 세션을 디바이스에 저장 → 앱 재시작 후에도 로그인 유지
    detectSessionInUrl: false,    // React Native에서 URL 파싱 불필요
    persistSession: true,
    autoRefreshToken: true,
  },
});
