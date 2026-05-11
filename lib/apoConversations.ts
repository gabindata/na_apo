import { supabase } from './supabase';

export type ApoConversation = {
  id: string;
  user_id: string;
  preview: string;
  created_at: string;
};

export type ApoMessage = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  text: string;
  created_at: string;
};

async function requireUserId(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const sessionUserId = sessionData.session?.user?.id;
  if (sessionUserId) return sessionUserId;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('로그인이 필요해요.');
  return userData.user.id;
}

/** 새 대화 생성 → conversation id 반환 */
export async function createApoConversation(preview: string): Promise<string> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('apo_conversations')
    .insert({ user_id: userId, preview: preview.slice(0, 80) })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** 메시지 한 건 저장 */
export async function saveApoMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  text: string,
): Promise<void> {
  const { error } = await supabase
    .from('apo_messages')
    .insert({ conversation_id: conversationId, role, text });
  if (error) throw error;
}

/** 대화 목록 조회 (최신순) */
export async function fetchApoConversations(): Promise<ApoConversation[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('apo_conversations')
    .select('id, user_id, preview, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApoConversation[];
}

/** 특정 대화의 메시지 조회 (시간순) */
export async function fetchApoMessages(conversationId: string): Promise<ApoMessage[]> {
  const { data, error } = await supabase
    .from('apo_messages')
    .select('id, conversation_id, role, text, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ApoMessage[];
}

/** 대화 삭제 (연결된 메시지도 CASCADE로 삭제됨) */
export async function deleteApoConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('apo_conversations')
    .delete()
    .eq('id', conversationId);
  if (error) throw error;
}
