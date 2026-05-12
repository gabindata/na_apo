import { supabase } from './supabase';

export type UserProfile = {
  id: string;
  nickname: string;
  coins: number;
  selectedCharacter: string;
  ownedCharacters: string[];
  birthYear: number | null;
  gender: 'male' | 'female' | 'none' | null;
};

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, nickname, coins, selected_character, owned_characters, birth_year, gender')
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
    selectedCharacter: data.selected_character ?? 'mulbeom',
    ownedCharacters: (data.owned_characters as string[] | null) ?? ['mulbeom'],
    birthYear: (data.birth_year as number | null) ?? null,
    gender: (data.gender as 'male' | 'female' | 'none' | null) ?? null,
  };
}
