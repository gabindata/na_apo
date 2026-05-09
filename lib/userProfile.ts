import { supabase } from './supabase';

export type UserProfile = {
  id: string;
  nickname: string;
  coins: number;
  selectedCharacter: string;
};

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, nickname, coins, selected_character')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[userProfile] fetch error:', error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    nickname: data.nickname,
    coins: data.coins ?? 0,
    selectedCharacter: data.selected_character ?? 'default',
  };
}
