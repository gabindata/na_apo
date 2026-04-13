import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { ChatBubble } from '../../components/rapo/ChatBubble';
import { IntensitySlider } from '../../components/rapo/IntensitySlider';
import { PainTypeTag, type PainTypeOption } from '../../components/rapo/PainTypeTag';
import { Colors } from '../../constants/colors';
import { sendMessage, type Message as ApiMessage } from '../../lib/claude';
import { supabase } from '../../lib/supabase';

const H_PAD = 20;
const COMPOSER_MIN_HEIGHT = 44;
const INPUT_MAX_LINES = 5;

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome-1',
    role: 'assistant',
    text: '안녕, 나는 라포예요. 🌊\n오늘 있었던 일이나 몸 상태를 편하게 적어줘도 돼요. 나중에 아포와 연결할 기록 챗봇이에요.',
  },
];

const QUICK_PROMPTS = [
  '오늘 통증 짧게 적어볼게',
  '기분 정리하고 싶어',
  '어제 일기 이어서',
] as const;

// 유저에게 보여줄 안전한 에러 메시지 (내부 에러는 console.error로만)
const USER_FRIENDLY_ERROR = '지금 응답이 원활하지 않아요. 잠시 후 다시 시도해주세요.';

export default function RapoScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // ── UI 상태: 웰컴 메시지 포함, 화면에 표시되는 버블 전체
  const [messages, setMessages] = useState<ChatMessage[]>(WELCOME_MESSAGES);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [intensity, setIntensity] = useState(0);
  const [painTypes, setPainTypes] = useState<PainTypeOption[]>([]);

  // ── API 히스토리: 웰컴 메시지 제외, Claude에 전송되는 실제 대화만
  //    useRef → 리렌더 없이 최신값 유지, 클로저 stale 문제 없음
  const apiHistory = useRef<ApiMessage[]>([]);

  // ── 레이스 컨디션 방지: 각 요청마다 고유 ID를 부여하고,
  //    응답 도착 시점에 ID가 일치할 때만 state 반영
  const requestIdRef = useRef(0);

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      console.log('SESSION CHECK');
      console.log('session:', data.session);
      console.log('user id:', data.session?.user?.id);
      console.log('access token exists:', !!data.session?.access_token);
      console.log('auth error:', error);
    };

    checkSession();
  }, []);

  const canSend = draft.trim().length > 0 && !isLoading;

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length, isLoading, scrollToEnd]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || isLoading) return;

    // ── Fix 1: 단일 진실 공급원(single source of truth)
    //    nextMessages를 먼저 만들어, UI 업데이트와 API 히스토리 빌드 양쪽에 동일하게 사용
    const userMsg: ChatMessage = { id: createId(), role: 'user', text };
    const nextUiMessages = [...messages, userMsg];
    setMessages(nextUiMessages);
    setDraft('');
    setIsLoading(true);

    // ── Fix 4: API 히스토리는 UI 메시지(nextUiMessages)와 분리
    //    웰컴 메시지가 포함되지 않도록 apiHistory ref에서 별도 관리
    const nextApiHistory: ApiMessage[] = [
      ...apiHistory.current,
      { role: 'user', content: text },
    ];

    // ── Fix 2: 레이스 컨디션 방지
    //    요청 직전에 ID를 올리고, 응답 시 현재 ID와 비교
    const currentRequestId = ++requestIdRef.current;

    try {
      const reply = await sendMessage(nextApiHistory, 'rapo');

      // 이 응답이 가장 최근 요청의 것인지 확인 (리셋/재전송 등으로 무효화된 경우 무시)
      if (currentRequestId !== requestIdRef.current) return;

      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', text: reply }]);

      // 성공 시 API 히스토리에 어시스턴트 응답도 추가
      apiHistory.current = [...nextApiHistory, { role: 'assistant', content: reply }];
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;

      // ── Fix 3: 에러 분리
      //    콘솔에는 디버깅용 전체 에러, UI에는 사용자 친화적 메시지만
      console.error('[Rapo] Claude API error:', err);
      // 실패해도 유저 턴은 히스토리에 남김 — 다음 전송 시 문맥이 끊기지 않도록
      apiHistory.current = nextApiHistory;
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: 'assistant', text: USER_FRIENDLY_ERROR },
      ]);
    } finally {
      // isLoading은 현재 요청이 유효할 때만 해제
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [draft, isLoading, messages]);

  const onReset = useCallback(() => {
    // requestId를 올려서 진행 중인 요청의 응답이 도착해도 무시되도록 무효화
    requestIdRef.current++;
    apiHistory.current = [];
    setMessages(WELCOME_MESSAGES);
    setDraft('');
    setIsLoading(false);
  }, []);

  const onQuickPrompt = useCallback((label: string) => {
    setDraft((prev) => (prev.trim().length > 0 ? `${prev.trim()}\n${label}` : label));
  }, []);

  const listBottomPadding = useMemo(
    () => Math.max(insets.bottom, 12) + 8,
    [insets.bottom],
  );

  const onSendPainData = useCallback(() => {
    const parts: string[] = [];
    if (intensity > 0) parts.push(`통증 강도: ${intensity}/10`);
    if (painTypes.length > 0) parts.push(`통증 유형: ${painTypes.join(', ')}`);
    if (parts.length === 0) return;

    setDraft((prev) => {
      const trimmed = prev.trim();
      const painText = parts.join('\n');
      return trimmed.length > 0 ? `${trimmed}\n${painText}` : painText;
    });
    setShowTools(false);
  }, [intensity, painTypes]);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isRapo = item.role === 'assistant';
      const prevItem = index > 0 ? messages[index - 1] : null;
      const hideAvatar = isRapo && prevItem?.role === 'assistant';

      return (
        <ChatBubble
          role={isRapo ? 'rapo' : 'user'}
          hideRapoAvatar={hideAvatar}
        >
          {item.text}
        </ChatBubble>
      );
    },
    [messages],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <View style={styles.screenRoot}>
      <Header
        title="라포"
        rightIcon={<Text style={styles.headerAction}>새 대화</Text>}
        onPressRight={onReset}
        style={styles.headerStretch}
        testID="rapo-header"
        accessibilityLabel="라포 기록 챗봇"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={styles.chipsBlock}>
          <Text style={styles.chipsLabel}>이렇게 시작해볼 수 있어요</Text>
          <View style={styles.chipsRow}>
            {QUICK_PROMPTS.map((label) => (
              <Pressable
                key={label}
                onPress={() => onQuickPrompt(label)}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                accessibilityRole="button"
                accessibilityLabel={`빠른 입력: ${label}`}
              >
                <Text style={styles.chipText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={styles.flex}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listBottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListFooterComponent={
            isLoading ? (
              <ChatBubble role="rapo">
                <ActivityIndicator size="small" color={Colors.accent} />
              </ChatBubble>
            ) : null
          }
        />

        {showTools && (
          <View style={styles.toolsPanel}>
            <IntensitySlider
              value={intensity}
              onValueChange={setIntensity}
              style={styles.toolItem}
            />
            <PainTypeTag
              value={painTypes}
              onChange={setPainTypes}
              style={styles.toolItem}
            />
            <Pressable
              onPress={onSendPainData}
              disabled={intensity === 0 && painTypes.length === 0}
              style={({ pressed }) => [
                styles.painSendBtn,
                intensity === 0 && painTypes.length === 0 && styles.sendBtnDisabled,
                pressed && styles.sendBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="통증 정보 입력창에 넣기"
            >
              <Text
                style={[
                  styles.painSendBtnText,
                  intensity === 0 && painTypes.length === 0 && styles.sendBtnTextDisabled,
                ]}
              >
                입력창에 넣기
              </Text>
            </Pressable>
          </View>
        )}

        <View
          style={[
            styles.composerOuter,
            {
              paddingBottom: Math.max(insets.bottom, 10),
              borderTopColor: Colors.ocean.tideBorder,
            },
          ]}
        >
          <View style={styles.composerInner}>
            <Pressable
              onPress={() => setShowTools((v) => !v)}
              style={({ pressed }) => [
                styles.toolToggle,
                showTools && styles.toolToggleActive,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={showTools ? '통증 도구 닫기' : '통증 도구 열기'}
            >
              <Text style={[styles.toolToggleText, showTools && styles.toolToggleTextActive]}>
                {showTools ? '✕' : '+'}
              </Text>
            </Pressable>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="오늘 있었던 일을 적어보세요…"
              placeholderTextColor={Colors.textLight}
              multiline
              maxLength={4000}
              textAlignVertical="top"
              accessibilityLabel="메시지 입력"
              blurOnSubmit={false}
            />
            <Pressable
              onPress={onSend}
              disabled={!canSend}
              style={({ pressed }) => [
                styles.sendBtn,
                !canSend && styles.sendBtnDisabled,
                pressed && canSend && styles.sendBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="보내기"
              accessibilityState={{ disabled: !canSend }}
            >
              <Text style={[styles.sendBtnText, !canSend && styles.sendBtnTextDisabled]}>
                보내기
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerStretch: {
    alignSelf: 'stretch',
  },
  headerAction: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  flex: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: H_PAD,
    paddingTop: 12,
  },
  chipsBlock: {
    paddingHorizontal: H_PAD,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.ocean.tideBorder,
    backgroundColor: Colors.background,
  },
  chipsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ocean.cardEdge,
  },
  chipPressed: {
    backgroundColor: Colors.ocean.heroWash,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
  },
  toolsPanel: {
    backgroundColor: Colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.ocean.tideBorder,
    paddingHorizontal: H_PAD,
    paddingVertical: 16,
  },
  toolItem: {
    marginBottom: 16,
  },
  painSendBtn: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Colors.accent,
  },
  painSendBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  toolToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ocean.cardEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolToggleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toolToggleText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.accent,
    lineHeight: 22,
  },
  toolToggleTextActive: {
    color: Colors.white,
  },
  composerOuter: {
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: H_PAD,
    paddingTop: 10,
  },
  composerInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: COMPOSER_MIN_HEIGHT,
    maxHeight: 22 * INPUT_MAX_LINES + 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.ocean.cardEdge,
    backgroundColor: Colors.white,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  },
  sendBtn: {
    minHeight: COMPOSER_MIN_HEIGHT,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  sendBtnDisabled: {
    backgroundColor: Colors.border,
  },
  sendBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  sendBtnTextDisabled: {
    color: Colors.textLight,
  },
});
