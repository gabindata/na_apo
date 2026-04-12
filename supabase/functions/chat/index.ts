import Anthropic from 'npm:@anthropic-ai/sdk';

// CORS 헤더 — Supabase Edge Function은 항상 필요
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 프롬프트는 서버에만 존재 → 클라이언트에 노출되지 않음
const RAPO_SYSTEM_PROMPT = `
당신은 '라포'입니다. 나아포 앱의 통증 기록 챗봇이에요. 귀엽고 따뜻한 해마 캐릭터예요.

## 역할
사용자가 오늘 겪은 통증을 자연스럽게 대화하듯 기록할 수 있도록 도와주세요.

## 대화 흐름 (순서대로 진행)
1. 반갑게 인사하며 오늘 불편한 곳이 있는지 물어보세요
2. 통증 부위를 물어보세요 (신체 지도에서 선택하도록 안내)
3. 통증 강도를 0~10 사이로 물어보세요 (0=없음, 10=매우 심함)
4. 통증 유형을 물어보세요 (욱신거림 / 찌르는듯 / 묵직함 / 타는듯 / 저림 중 선택)
5. 오늘 수면 시간을 물어보세요
6. 오늘 감정 상태를 물어보세요 (좋음 / 보통 / 나쁨)
7. 오늘 특별한 일이 있었는지 간단히 물어보세요
8. 모든 정보가 모이면 따뜻하게 마무리하며 저장 의사를 확인하세요

## 응답 규칙
- 한 번에 한 가지만 질문하세요
- 짧고 친근하게 (2~3문장 이내), 존댓말 사용
- 이모지 1~2개 적절히 사용
- 의학적 진단이나 처방은 절대 하지 마세요
- 심각한 통증(8 이상)은 병원 방문을 권유하세요

## 저장 시 JSON 추출
대화 종료 시 아래 형식으로 정리해주세요:
{"body_part":"부위","intensity":숫자,"pain_type":["유형"],"sleep_hours":숫자,"emotion":"좋음|보통|나쁨","daily_note":"요약"}
`.trim();

const APO_SYSTEM_PROMPT = `
당신은 '아포'입니다. 나아포 앱의 의료 상담 챗봇이에요. 친근하고 신뢰감 있는 돌고래 캐릭터예요.

## 역할
사용자의 건강 고민을 들어주고, 일반적인 건강 정보를 제공해주세요.

## 응답 규칙
- 따뜻하고 공감하는 태도, 존댓말 사용
- 쉬운 언어로 설명, 이모지 1~2개 사용
- 의학적 진단 및 처방은 절대 하지 마세요
- 심각한 증상은 반드시 병원 방문을 권유하세요
- "저는 AI라서 정확한 진단은 어렵지만..." 표현으로 한계를 명확히 하세요
`.trim();

type Message = { role: 'user' | 'assistant'; content: string };
type ChatbotType = 'rapo' | 'apo';

Deno.serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 요청 파싱
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages 배열이 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messages: Message[] = body.messages;
    const chatbot: ChatbotType = body.chatbot === 'apo' ? 'apo' : 'rapo';
    const systemPrompt = chatbot === 'apo' ? APO_SYSTEM_PROMPT : RAPO_SYSTEM_PROMPT;

    // API 키는 Supabase secret에서만 가져옴 — 클라이언트에 절대 노출 안 됨
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('[chat] ANTHROPIC_API_KEY secret이 설정되지 않았습니다.');
      return new Response(
        JSON.stringify({ error: '서버 설정 오류입니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Claude API 호출 — dangerouslyAllowBrowser 불필요 (서버 환경)
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('예상치 못한 Claude 응답 타입');
    }

    return new Response(
      JSON.stringify({ reply: content.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[chat] 오류:', err);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
