import { supabase } from './supabase';

/**
 * 캐릭터 구매: 코인 차감 + owned_characters 배열에 추가
 * coins와 owned_characters를 한 번에 업데이트해 일관성 유지
 */
export async function purchaseCharacter(params: {
  userId: string;
  characterId: string;
  price: number;
  currentCoins: number;
  currentOwned: string[];
}): Promise<
  | { success: true; newCoins: number; newOwned: string[] }
  | { success: false; error: string }
> {
  const { userId, characterId, price, currentCoins, currentOwned } = params;

  if (currentCoins < price) {
    return { success: false, error: '코인이 부족해요.' };
  }
  if (currentOwned.includes(characterId)) {
    return { success: false, error: '이미 보유한 캐릭터예요.' };
  }

  const newCoins = currentCoins - price;
  const newOwned = [...currentOwned, characterId];

  const { error } = await supabase
    .from('users')
    .update({ coins: newCoins, owned_characters: newOwned })
    .eq('id', userId);

  if (error) {
    console.error('[characters] 구매 실패:', error.message);
    return { success: false, error: '구매에 실패했어요. 다시 시도해주세요.' };
  }

  return { success: true, newCoins, newOwned };
}

/** 캐릭터 선택 (이미 보유한 캐릭터만 가능) */
export async function selectCharacter(
  userId: string,
  characterId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ selected_character: characterId })
    .eq('id', userId);

  if (error) {
    console.error('[characters] 캐릭터 선택 실패:', error.message);
    return false;
  }
  return true;
}
