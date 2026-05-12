import { supabase } from './supabase';
import type { PainRecordExtracted } from '../constants/prompts';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatbotType =
  | 'rapo'
  | 'apo'
  | 'rapo-extract'
  | 'report-insight'
  | 'care-suggestion';

/** 초회 + 재시도 횟수(Anthropic 529 overloaded 등 일시 오류 대비) */
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 1800;
const RETRY_BACKOFF_CAP_MS = 12_000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function errorBodyToSearchString(body: unknown): string {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

/**
 * Supabase / 상류(Anthropic) 일시 오류인지 판별 — 재시도 가치 있는 경우만 true
 * Edge Function은 과부하 시 error 문자열에 529 · overloaded_error JSON을 실어 보냄
 */
function isRetryable(errorBody: unknown): boolean {
  const haystack = errorBodyToSearchString(errorBody).toLowerCase();

  if (
    haystack.includes('overloaded_error') ||
    haystack.includes('overloaded') ||
    /\b529\b/.test(haystack) ||
    haystack.includes('rate_limit') ||
    haystack.includes('too many requests')
  ) {
    return true;
  }

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

function retryDelayMs(attemptIndex: number): number {
  const exp = RETRY_DELAY_MS * 2 ** (attemptIndex - 1);
  return Math.min(exp, RETRY_BACKOFF_CAP_MS);
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
      const delay = retryDelayMs(attempt);
      console.log(`[Claude] 재시도 ${attempt}/${MAX_RETRIES} (${delay}ms 후)...`);
      await sleep(delay);
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
