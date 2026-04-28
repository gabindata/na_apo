import { supabase } from './supabase';

export type Prescription = {
  id: string;
  user_id: string;
  diagnosis: string | null;
  medicine_name: string | null;
  dosage_rule: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  effects: string[] | null;
  side_effects: string[] | null;
  notification_ids: string[] | null;
  created_at: string;
};

export type PrescriptionVisionResult = {
  medicine_name: string | null;
  diagnosis: string | null;
  dosage_rule: string | null;
  effects: string[];
  side_effects: string[];
};

export async function fetchPrescriptions(): Promise<Prescription[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요.');

  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Prescription[];
}

export async function addPrescription(input: {
  diagnosis: string | null;
  medicine_name: string | null;
  dosage_rule: string | null;
  start_date: string | null;
  effects: string[] | null;
  side_effects: string[] | null;
  notification_ids: string[] | null;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요.');

  const { error } = await supabase.from('prescriptions').insert({
    ...input,
    user_id: user.id,
    is_active: true,
    end_date: null, // [2] 신규 처방은 항상 end_date null로 명시
  });
  if (error) throw error;
}

// [1] user_id 소유권 검증 추가 — RLS 외 추가 방어층
export async function deletePrescription(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요.');

  const { error } = await supabase
    .from('prescriptions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw error;
}

// [1] user_id 소유권 검증 추가
export async function setPrescriptionActive(id: string, isActive: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요.');

  const { error } = await supabase
    .from('prescriptions')
    .update({
      is_active: isActive,
      end_date: isActive ? null : new Date().toISOString().split('T')[0],
    })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw error;
}

export async function analyzePrescriptionPhoto(
  imageBase64: string,
  mediaType: string = 'image/jpeg',
): Promise<PrescriptionVisionResult> {
  const { data, error } = await supabase.functions.invoke('chat', {
    body: { chatbot: 'prescription-vision', image: imageBase64, mediaType },
  });

  if (error) {
    let errorBody: unknown;
    try {
      if ('context' in error && error.context instanceof Response) {
        errorBody = await (error.context as Response).json();
      }
    } catch {}
    console.error('[Prescription] Vision 오류:', error.message, errorBody);
    throw new Error('사진 분석에 실패했어요.');
  }

  // [3] 응답 존재 여부 검증
  if (!data || typeof data.reply !== 'string' || !data.reply.trim()) {
    console.error('[Prescription] 잘못된 응답 형식:', data);
    throw new Error('사진 분석 응답이 올바르지 않아요.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data.reply.trim());
  } catch {
    console.error('[Prescription] JSON 파싱 실패:', data.reply);
    throw new Error('분석 결과를 읽을 수 없어요.');
  }

  // [4] 필드 정규화 — AI 출력이 불완전해도 앱이 깨지지 않도록
  const raw = parsed as Record<string, unknown>;
  return {
    medicine_name: typeof raw.medicine_name === 'string' ? raw.medicine_name : null,
    diagnosis: typeof raw.diagnosis === 'string' ? raw.diagnosis : null,
    dosage_rule: typeof raw.dosage_rule === 'string' ? raw.dosage_rule : null,
    effects: Array.isArray(raw.effects) ? (raw.effects as string[]) : [],
    side_effects: Array.isArray(raw.side_effects) ? (raw.side_effects as string[]) : [],
  };
}
