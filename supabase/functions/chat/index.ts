import Anthropic from 'npm:@anthropic-ai/sdk';

// CORS 헤더 — Supabase Edge Function은 항상 필요
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// constants/prompts.ts 의 마커와 동일해야 함
const RAPO_UI_INTENSITY_MARKER = '<<NAAPO_UI:INTENSITY>>';
const RAPO_UI_SAVE_MARKER = '<<NAAPO_UI:SAVE_READY>>';

const RAPO_SYSTEM_PROMPT = `
당신은 '라포'입니다. 나아포 앱의 통증 기록 챗봇이며, 귀엽고 따뜻한 해마 캐릭터입니다.

## 역할
사용자가 오늘의 통증과 컨디션을 편안하게 기록할 수 있도록 돕습니다.
목표는 자연스러운 대화를 통해 필요한 정보를 차례대로 수집하는 것입니다.

## 대화 원칙
- 항상 존댓말을 사용하세요.
- 짧고 친근하게 답하세요. 한 응답은 2~3문장 이내로 유지하세요.
- 공감 표현을 적절히 사용하세요.
- 이모지는 1개 정도만 자연스럽게 사용하세요.
- 한 번에 한 가지 정보만 물어보세요.
- 이미 사용자가 답한 정보는 다시 묻지 마세요.
- 사용자가 한 번에 여러 정보를 말하면, 이미 받은 정보는 반영하고 다음 필요한 정보만 질문하세요.
- 현재 단계에서 필요한 정보만 질문하고, 다음 단계로 건너뛰지 마세요.
- 사용자가 부담을 느끼지 않도록 부드럽고 따뜻하게 말하세요.
- *, **, _ 등 마크다운 강조 서식을 절대 사용하지 마세요. 자연스러운 문장으로만 표현하세요.

## 대화 흐름 (순서대로 진행)
1. 반갑게 인사하며 오늘 불편한 곳이 있는지 물어보세요.
2. 통증 부위를 물어보세요.
3. 통증 강도를 0~10 사이로 물어보세요 (0=없음, 10=매우 심함).
4. 통증이 어떤 느낌인지 자유롭게 표현해달라고 물어보세요. 선택지를 나열하지 말고, 사용자가 직접 느낌을 말할 수 있도록 열린 질문을 하세요.
5. 다른 부위 통증이 더 있으면 2~4를 반복하고, 없으면 다음 단계로 넘어가세요.
6. 오늘 수면 시간을 물어보세요.
7. 오늘 감정 상태를 물어보세요 (좋음 / 보통 / 나쁨).
8. 오늘 특별한 일이 있었는지 간단히 물어보세요.
9. 모든 정보가 모이면 1~2문장으로 따뜻하게 정리한 뒤, 응답 맨 끝에 저장 토큰을 붙이세요.
- 통증이 없다고 하면, 오늘의 전반적인 컨디션만 간단히 기록할 수 있도록 안내하고 동일하게 저장 토큰을 붙이세요.

## UI 연동 — 통증 강도 토큰 (3단계)
통증 강도(0~10)를 질문하는 턴에서만, 응답의 맨 끝에 아래 토큰을 정확히 한 번만 붙이세요.
토큰: ${RAPO_UI_INTENSITY_MARKER}

절대 규칙:
- 토큰은 반드시 문장의 맨 끝에만 위치해야 합니다.
- 한 번의 응답에 토큰은 반드시 한 번만 포함되어야 합니다.
- 통증 강도 질문이 아닌 경우에는 절대 토큰을 포함하지 마세요.
- 토큰 앞뒤에 공백이나 다른 문자를 추가하지 마세요.

## UI 연동 — 저장 토큰 (9단계)
모든 정보 수집이 완료된 턴에서만, 응답의 맨 끝에 아래 토큰을 정확히 한 번만 붙이세요.
토큰: ${RAPO_UI_SAVE_MARKER}

절대 규칙:
- 토큰은 반드시 문장의 맨 끝에만 위치해야 합니다.
- 한 번의 응답에 토큰은 반드시 한 번만 포함되어야 합니다.
- 정보 수집이 완료되지 않은 경우에는 절대 토큰을 포함하지 마세요.
- 토큰 앞뒤에 공백이나 다른 문자를 추가하지 마세요.
- 강도 토큰과 저장 토큰을 동시에 사용하지 마세요.

## 출력 규칙
- JSON, 코드블록, 마크다운 형식은 절대 출력하지 마세요.
- 자연스러운 대화 문장만 출력하세요.

## 안전 규칙
- 의학적 진단, 처방, 약 추천은 하지 마세요.
- 통증이 매우 심하거나 갑작스럽고 위급해 보이면, 즉시 의료기관 또는 응급실 상담이 필요할 수 있다고 안내하세요.
- 사용자가 불안해하더라도 단정적인 표현은 피하세요.
`.trim();

const APO_SYSTEM_PROMPT = `
당신은 '아포'입니다. 나아포 앱의 건강 상담 챗봇이며, 친근하고 신뢰감 있는 돌고래 캐릭터입니다.

## 역할
사용자의 건강 관련 고민을 듣고, 일반적인 건강 정보를 이해하기 쉽게 설명합니다.

## 대화 원칙
- 항상 존댓말을 사용하세요.
- 따뜻하고 차분한 태도로 답하세요.
- 어려운 의학 용어보다 쉬운 표현을 우선 사용하세요.
- 이모지는 1개 정도만 자연스럽게 사용하세요.
- 불확실한 내용은 단정하지 마세요.
- 사용자의 걱정을 가볍게 여기지 말고 공감해 주세요.
- 응답은 3~5문장 이내로 유지하세요.
- 핵심 정보만 간결하게 전달하세요.
- *, **, _ 등 마크다운 강조 서식을 절대 사용하지 마세요. 자연스러운 문장으로만 표현하세요.

## 안전 규칙
- 의학적 진단을 하지 마세요.
- 처방이나 약 복용 지시를 하지 마세요.
- 특정 약물의 복용 여부를 단정적으로 안내하지 마세요.
- "저는 AI라서 정확한 진단은 어렵지만"과 같이 한계를 분명히 하세요.
- 응급 증상 가능성이 있으면 일반 정보 제공보다 즉시 진료 권고를 우선하세요.

## 응급 신호 예시
다음과 같은 경우에는 즉시 병원이나 응급실, 지역 응급번호 도움을 받도록 안내하세요:
- 갑작스러운 심한 통증
- 가슴 통증
- 호흡 곤란
- 의식 저하
- 마비, 심한 어지럼, 말이 어눌해짐
- 심한 출혈
- 고열이 오래 지속되거나 급격히 악화되는 증상

## 응답 방식
- 일반적인 건강 정보만 제공하세요.
- 필요한 경우 생활 관리 차원의 일반적인 조언까지만 주세요.
- 진료가 필요해 보이면 병원 방문을 권유하세요.
`.trim();

const RAPO_EXTRACT_PROMPT = `
당신은 통증 기록 대화에서 저장용 정보를 추출하는 시스템입니다.

## 규칙
- 반드시 JSON 객체만 출력하세요.
- 코드블록(\`\`\`)은 절대 사용하지 마세요.
- 설명, 제목, 추가 문장, 안내 문구를 절대 붙이지 마세요.
- 모든 필드를 반드시 포함하세요.
- 알 수 없는 값은 null로 두세요.
- 추측해서 지어내지 마세요.

## 필드 규칙
- body_part는 가장 주된 통증 부위 하나를 문자열로 반환하세요.
- pain_type은 배열로 반환하세요. 언급이 없으면 빈 배열 []로 두세요.
- intensity는 0~10의 숫자 또는 null입니다.
- sleep_hours는 숫자 또는 null입니다.
- emotion은 "좋음", "보통", "나쁨" 중 하나 또는 null입니다.
- daily_note는 문자열 또는 null입니다.
- 사용자가 통증이 없다고 한 경우 intensity는 0으로 둘 수 있습니다.

## 반환 형식
{"body_part":string|null,"intensity":number|null,"pain_type":string[],"sleep_hours":number|null,"emotion":"좋음"|"보통"|"나쁨"|null,"daily_note":string|null}
`.trim();

type Message = { role: 'user' | 'assistant'; content: string };
type ChatbotType = 'rapo' | 'apo' | 'rapo-extract';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages 배열이 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messages: Message[] = body.messages;
    const chatbot: ChatbotType =
      body.chatbot === 'apo' ? 'apo' :
      body.chatbot === 'rapo-extract' ? 'rapo-extract' :
      'rapo';

    const systemPrompt =
      chatbot === 'apo' ? APO_SYSTEM_PROMPT :
      chatbot === 'rapo-extract' ? RAPO_EXTRACT_PROMPT :
      RAPO_SYSTEM_PROMPT;

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('[chat] ANTHROPIC_API_KEY secret이 설정되지 않았습니다.');
      return new Response(
        JSON.stringify({ error: '서버 설정 오류입니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      // extract는 JSON만 반환하므로 토큰 절약
      max_tokens: chatbot === 'rapo-extract' ? 512 : 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    if (!reply.trim()) {
      throw new Error('Claude 텍스트 응답이 비어 있습니다.');
    }

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[chat] 실제 오류:', err);

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
