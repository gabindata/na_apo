import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CHARACTERS } from '../../constants/characters';
import { purchaseCharacter, selectCharacter } from '../../lib/characters';

const COIN_IMG = require('../../assets/logo/coin.png');

const T = {
  text:      '#0C2A45',
  textMuted: '#4A7898',
  secondary: '#1A6FAD',
  primary:   '#2468B8',
} as const;

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PAD = 16;
const CARD_GAP = 10;
const CARD_W = Math.floor((SCREEN_W - GRID_PAD * 2 - CARD_GAP * 2) / 3);

type Props = {
  visible: boolean;
  onClose: () => void;
  userId: string;
  coins: number;
  selectedCharacter: string;
  ownedCharacters: string[];
  onUpdate: (newCoins: number, newSelected: string, newOwned: string[]) => void;
};

export function CharacterShop({
  visible,
  onClose,
  userId,
  coins: initCoins,
  selectedCharacter: initSelected,
  ownedCharacters: initOwned,
  onUpdate,
}: Props) {
  const insets = useSafeAreaInsets();

  const [coins, setCoins] = useState(initCoins);
  const [selected, setSelected] = useState(initSelected);
  const [owned, setOwned] = useState(initOwned);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // 모달이 열릴 때마다 부모 상태로 동기화
  useEffect(() => {
    if (visible) {
      setCoins(initCoins);
      setSelected(initSelected);
      setOwned(initOwned);
      setFeedback(null);
    }
  }, [visible, initCoins, initSelected, initOwned]);

  const handleClose = () => {
    onUpdate(coins, selected, owned);
    onClose();
  };

  /** DB에 selected_character 저장 (loading 설정은 호출부에서) */
  const applySelect = async (characterId: string) => {
    const ok = await selectCharacter(userId, characterId);
    if (ok) setSelected(characterId);
  };

  const handleSelectBtn = async (characterId: string) => {
    if (loadingId) return;
    setLoadingId(characterId);
    await applySelect(characterId);
    setLoadingId(null);
  };

  const handlePurchase = async (characterId: string, price: number) => {
    if (loadingId) return;
    setLoadingId(characterId);
    setFeedback(null);

    const result = await purchaseCharacter({
      userId,
      characterId,
      price,
      currentCoins: coins,
      currentOwned: owned,
    });

    if (result.success) {
      setCoins(result.newCoins);
      setOwned(result.newOwned);
      // 구매 즉시 착용
      await applySelect(characterId);
      setFeedback('구매 완료! 🎉');
    } else {
      setFeedback(result.error);
    }
    setLoadingId(null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#F2F9FF', '#D0E9F8', '#A8D4EE']}
          locations={[0, 0.5, 1]}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
        >
          {/* ── 헤더 ── */}
          <View style={styles.header}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>

            <Text style={styles.title}>캐릭터 상점</Text>

            <View style={styles.coinBadge}>
              <Image source={COIN_IMG} style={styles.coinIcon} resizeMode="contain" />
              <Text style={styles.coinCount}>{coins}</Text>
            </View>
          </View>

          {/* ── 피드백 메시지 ── */}
          {feedback ? (
            <Text style={styles.feedback}>{feedback}</Text>
          ) : (
            <View style={styles.hintRow}>
              <Text style={styles.hint}>통증을 기록하면 하루 최대 </Text>
              <Image source={COIN_IMG} style={styles.hintCoinIcon} resizeMode="contain" />
              <Text style={styles.hint}> 10개를 받을 수 있어요</Text>
            </View>
          )}

          {/* ── 캐릭터 그리드 ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.grid}
          >
            {CHARACTERS.map((char) => {
              const isOwned = char.price === 0 || owned.includes(char.id);
              const isSelected = selected === char.id;
              const canAfford = coins >= char.price;
              const isLoading = loadingId === char.id;

              return (
                <View key={char.id} style={styles.card}>
                  {/* 캐릭터 이미지 */}
                  <View style={[styles.imageBox, isSelected && styles.imageBoxSelected]}>
                    <Image source={char.image} style={styles.charImg} resizeMode="contain" />

                    {/* 잠금 오버레이 */}
                    {!isOwned && (
                      <View style={styles.lockOverlay}>
                        <Text style={styles.lockEmoji}>🔒</Text>
                      </View>
                    )}

                    {/* 착용 중 배지 */}
                    {isSelected && (
                      <View style={styles.equippedBar}>
                        <Text style={styles.equippedBarText}>착용 중</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.charName}>{char.name}</Text>

                  {/* 버튼 영역 */}
                  {isLoading ? (
                    <View style={styles.btn}>
                      <ActivityIndicator size="small" color={T.primary} />
                    </View>
                  ) : isSelected ? (
                    <View style={[styles.btn, styles.btnEquipped]}>
                      <Text style={styles.btnTextEquipped}>착용 중</Text>
                    </View>
                  ) : isOwned ? (
                    <Pressable
                      style={({ pressed }) => [styles.btn, styles.btnSelect, pressed && styles.btnPressed]}
                      onPress={() => handleSelectBtn(char.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${char.name} 착용`}
                    >
                      <Text style={styles.btnTextSelect}>착용</Text>
                    </Pressable>
                  ) : canAfford ? (
                    <Pressable
                      style={({ pressed }) => [styles.btn, styles.btnBuy, pressed && styles.btnPressed]}
                      onPress={() => handlePurchase(char.id, char.price)}
                      accessibilityRole="button"
                      accessibilityLabel={`${char.name} 구매 ${char.price}코인`}
                    >
                      <Image source={COIN_IMG} style={styles.btnCoinIcon} resizeMode="contain" />
                      <Text style={styles.btnTextBuy}>{char.price}</Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.btn, styles.btnLocked]}>
                      <Image source={COIN_IMG} style={styles.btnCoinIconDim} resizeMode="contain" />
                      <Text style={styles.btnTextLocked}>{char.price}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,20,40,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(100,160,210,0.30)',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
  },
  closeBtnText: {
    fontSize: 15,
    color: T.textMuted,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: T.text,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.28)',
  },
  coinIcon: {
    width: 16,
    height: 16,
  },
  coinCount: {
    fontSize: 14,
    fontWeight: '700',
    color: T.primary,
  },
  feedback: {
    textAlign: 'center',
    fontSize: 13,
    color: T.primary,
    fontWeight: '600',
    paddingVertical: 8,
  },
  hint: {
    fontSize: 12,
    color: T.textMuted,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  hintCoinIcon: {
    width: 14,
    height: 14,
    marginHorizontal: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_PAD,
    paddingTop: 12,
    paddingBottom: 8,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_W,
    alignItems: 'center',
    marginBottom: 8,
  },
  imageBox: {
    width: CARD_W - 4,
    height: CARD_W - 4,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 2,
    borderColor: 'rgba(100,160,210,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  imageBoxSelected: {
    borderColor: T.primary,
    borderWidth: 2.5,
  },
  charImg: {
    width: '80%',
    height: '80%',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockEmoji: {
    fontSize: 26,
  },
  equippedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: T.primary,
    paddingVertical: 3,
    alignItems: 'center',
  },
  equippedBarText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
  },
  charName: {
    fontSize: 13,
    fontWeight: '600',
    color: T.text,
    marginBottom: 5,
  },
  btn: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    gap: 4,
  },
  btnCoinIcon: {
    width: 14,
    height: 14,
  },
  btnCoinIconDim: {
    width: 14,
    height: 14,
    opacity: 0.55,
  },
  btnPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  btnEquipped: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: T.primary,
  },
  btnTextEquipped: {
    fontSize: 12,
    color: T.primary,
    fontWeight: '700',
  },
  btnSelect: {
    backgroundColor: T.primary,
  },
  btnTextSelect: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  btnBuy: {
    backgroundColor: T.secondary,
  },
  btnTextBuy: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  btnLocked: {
    backgroundColor: 'rgba(100,160,210,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(100,160,210,0.25)',
  },
  btnTextLocked: {
    fontSize: 12,
    color: T.textMuted,
    fontWeight: '600',
  },
});
