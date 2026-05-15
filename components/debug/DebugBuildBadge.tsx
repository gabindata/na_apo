import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';

/**
 * ⬇️ 매 OTA 배포 직전 이 값만 바꿔서 푸시하면, 폰에서 새 번들이 실제로
 *    적용됐는지 즉시 눈으로 확인할 수 있습니다.
 *    예: 'v3 · 2026-05-16 · BlurView fix'
 *
 * 폰에서 보이는 마커가 이 값과 같다 → OTA 적용 성공.
 * 다르다 → 아직 OTA가 안 내려옴 (embedded 번들 그대로).
 */
export const BUILD_MARKER = 'v1 · 2026-05-15 · BlurView+Keyboard';

/**
 * 화면 상단 중앙에 떠 있는 작은 디버그 배지.
 *  - 초록 점 + 마커 텍스트: OTA 번들로 실행 중 (성공)
 *  - 빨간 점 + 마커 텍스트: APK 내장 번들 그대로 실행 (OTA 미적용)
 *  - 탭하면 상세 정보 + '지금 업데이트 받기' 버튼
 *
 * 데모/디버그 용도. 출시 시 _layout.tsx 에서 한 줄 주석 처리하면 됨.
 */
export function DebugBuildBadge() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const isEmbedded     = Updates.isEmbeddedLaunch;
  const updateId       = Updates.updateId ?? null;
  const channel        = Updates.channel ?? null;
  const runtimeVersion = Updates.runtimeVersion ?? null;
  const createdAt      = Updates.createdAt ?? null;

  const onTap = useCallback(() => {
    const shortId = updateId ? updateId.slice(0, 8) + '…' : '(none)';
    const lines = [
      `Marker: ${BUILD_MARKER}`,
      `Platform: ${Platform.OS} ${Platform.Version}`,
      `isEmbeddedLaunch: ${String(isEmbedded)}`,
      `channel: ${channel ?? '(none)'}`,
      `runtimeVersion: ${runtimeVersion ?? '(none)'}`,
      `updateId: ${shortId}`,
      `createdAt: ${createdAt ? createdAt.toLocaleString() : '(none)'}`,
    ];

    Alert.alert(
      'Build Info',
      lines.join('\n'),
      [
        { text: '닫기', style: 'cancel' },
        {
          text: busy ? '받는 중…' : '지금 업데이트 받기',
          onPress: async () => {
            if (busy) return;
            setBusy(true);
            try {
              const res = await Updates.fetchUpdateAsync();
              if (res.isNew) {
                await Updates.reloadAsync();
              } else {
                Alert.alert('최신 상태', '받을 새 업데이트가 없어요.');
              }
            } catch (err) {
              Alert.alert(
                '업데이트 실패',
                err instanceof Error ? err.message : String(err),
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [busy, channel, createdAt, isEmbedded, runtimeVersion, updateId]);

  const color = isEmbedded ? '#F4A8A8' : '#8AD9B0';

  return (
    <View
      style={[styles.wrap, { top: insets.top + 4 }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onTap}
        hitSlop={6}
        accessibilityLabel="빌드 정보"
        style={({ pressed }) => [
          styles.badge,
          { borderColor: color },
          pressed && { opacity: 0.75 },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.text, { color }]} numberOfLines={1}>
          {BUILD_MARKER}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(6,16,30,0.78)',
    maxWidth: 280,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0,
  },
});
