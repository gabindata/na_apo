import { supabase } from './supabase';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatbotType = 'rapo' | 'apo';

/**
 * Claude API 호출 — Supabase Edge Function을 통해 안전하게 호출
 * API 키는 서버(Edge Function secret)에만 존재, 클라이언트에 노출 없음
 */
export async function sendMessage(
  messages: Message[],
  chatbot: ChatbotType = 'rapo'
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: { messages, chatbot },
  });

  if (error) {
    // 실제 응답 바디 추출 — 어떤 에러인지 정확히 파악
    let errorBody: unknown = '(파싱 실패)';
    try {
      if ('context' in error && error.context instanceof Response) {
        errorBody = await (error.context as Response).json();
      }
    } catch {}
    console.error('[Claude] Edge Function 오류:', error.message);
    console.error('[Claude] 실제 응답 바디:', JSON.stringify(errorBody));
    throw new Error(error.message ?? '챗봇 연결에 실패했어요.');
  }

  if (!data?.reply || typeof data.reply !== 'string') {
    console.error('[Claude] 잘못된 응답 형식:', data);
    throw new Error('서버 응답이 올바르지 않아요.');
  }

  return data.reply;
}
