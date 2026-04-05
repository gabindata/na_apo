import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

// undefined로 초기화 → Provider 밖에서 useAuth() 쓰면 즉시 에러 발생
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. onAuthStateChange를 먼저 등록
    // → getSession()보다 먼저 구독해야 이벤트를 놓치지 않음
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // auth 상태 이벤트 도착 시에도 loading 종료 보장
      setLoading(false);
    });

    // 2. 초기 세션 복원 (앱 재실행 시 로그인 유지)
    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[AuthContext] getSession error:', error.message);
        }
        setSession(data.session ?? null);
      } catch (err) {
        // 네트워크 오류 등 예상치 못한 예외 처리
        // → loading이 영원히 true로 남는 상황 방지
        console.error('[AuthContext] Unexpected getSession error:', err);
        setSession(null);
      } finally {
        // 성공/실패/예외 모든 경우에 loading 종료 보장
        setLoading(false);
      }
    };

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[AuthContext] signOut error:', error.message);
      }
    } catch (err) {
      console.error('[AuthContext] Unexpected signOut error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null, // session에서 직접 계산 → 불일치 방지
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Provider 바깥에서 useAuth() 사용 시 즉시 에러 → 디버깅 용이
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
