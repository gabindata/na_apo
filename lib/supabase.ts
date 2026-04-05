import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,        // 세션을 디바이스에 저장 → 앱 재시작 후에도 로그인 유지
    detectSessionInUrl: false,    // React Native에서 URL 파싱 불필요
    persistSession: true,
    autoRefreshToken: true,
  },
});
