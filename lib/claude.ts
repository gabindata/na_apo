import { supabase } from './supabase';
import type { PainRecordExtracted } from '../constants/prompts';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatbotType = 'rapo' | 'apo' | 'rapo-extract';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1200;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Supabase 일시적 장애인지 판별 — 재시도 가치 있는 에러만 true */
function isRetryable(errorBody: unknown): boolean {
  if (!errorBody || typeof errorBody !== 'object') return false;
  const code = (errorBody as Record<string, unknown>).code;
  const message = String((errorBody as Record<string, unknown>).message ?? '').toLowerCase();
  return (
    code === 'SUPABASE_EDGE_RUNTIME_ERROR' ||
    message.includes('temporarily unavailable') ||
    message.includes('timeout') ||
    message.includes('service unavailable')
  );
}

/**
 * Claude API 호출 — Supabase Edge Function을 통해 안전하게 호출
 * 일시적 서버 오류 시 최대 MAX_RETRIES번 자동 재시도
 */
export async function sendMessage(
  messages: Message[],
  chatbot: ChatbotType = 'rapo'
): Promise<string> {
  let lastError: Error = new Error('챗봇 연결에 실패했어요.');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[Claude] 재시도 ${attempt}/${MAX_RETRIES}...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }

    const { data, error } = await supabase.functions.invoke('chat', {
      body: { messages, chatbot },
    });

    if (error) {
      let errorBody: unknown = '(파싱 실패)';
      try {
        if ('context' in error && error.context instanceof Response) {
          errorBody = await (error.context as Response).json();
        }
      } catch {}
      console.error(`[Claude] Edge Function 오류 (시도 ${attempt + 1}):`, error.message);
      console.error('[Claude] 실제 응답 바디:', JSON.stringify(errorBody));

      lastError = new Error(error.message ?? '챗봇 연결에 실패했어요.');

      if (isRetryable(errorBody) && attempt < MAX_RETRIES) continue;
      throw lastError;
    }

    if (!data?.reply || typeof data.reply !== 'string') {
      console.error('[Claude] 잘못된 응답 형식:', data);
      throw new Error('서버 응답이 올바르지 않아요.');
    }

    return data.reply;
  }

  throw lastError;
}

/**
 * 라포 대화 히스토리에서 통증 기록 JSON 추출
 * RAPO_EXTRACT_PROMPT 시스템 프롬프트로 Claude를 한 번 더 호출해 구조화된 데이터를 얻음
 */
export async function extractPainRecord(
  conversationHistory: Message[]
): Promise<PainRecordExtracted> {
  // sendMessage와 동일한 재시도 로직 재사용
  const raw = await sendMessage(conversationHistory, 'rapo-extract');

  try {
    return JSON.parse(raw.trim()) as PainRecordExtracted;
  } catch {
    console.error('[Claude] JSON 파싱 실패:', raw);
    throw new Error('기록 데이터 파싱에 실패했어요.');
  }
}
