import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { ChatBubble } from '../../components/common/ChatBubble';
import { Colors } from '../../constants/colors';
import { sendMessage, type Message as ApiMessage } from '../../lib/claude';

const H_PAD = 20;
const COMPOSER_MIN_HEIGHT = 44;
const INPUT_MAX_LINES = 5;
const CHAT_EDGE_VERTICAL_PAD = 12;
const HEADER_HEIGHT = 88;

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// UI 전용 웰컴 메시지 — API 히스토리에는 포함하지 않음
const WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome-1',
    role: 'assistant',
    text: '안녕하세요, 저는 아포예요. 🐬\n건강 관련 궁금한 점이나 걱정되는 증상이 있으면 편하게 말씀해 주세요.',
  },
];

const QUICK_PROMPTS = [
  '요즘 자주 두통이 와요',
  '잠을 잘 못 자고 있어요',
  '소화가 잘 안 돼요',
] as const;

const USER_FRIENDLY_ERROR =
  '지금 응답이 원활하지 않아요. 잠시 후 다시 시도해주세요.';

export default function ApoScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([...WELCOME_MESSAGES]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [composerHeight, setComposerHeight] = useState(0);

  // 최신 UI 메시지 참조
  const messagesRef = useRef<ChatMessage[]>([...WELCOME_MESSAGES]);

  // Claude에 보내는 실제 대화 히스토리
  const apiHistory = useRef<ApiMessage[]>([]);

  // 진행 중 요청 무효화용
  const requestIdRef = useRef(0);

  const canSend = draft.trim().length > 0 && !isLoading;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length, isLoading, scrollToEnd]);

  useEffect(() => {
    const timer = setTimeout(() => scrollToEnd(), 50);
    return () => clearTimeout(timer);
  }, [composerHeight, scrollToEnd]);

  const onComposerLayout = useCallback((e: LayoutChangeEvent) => {
    setComposerHeight(e.nativeEvent.layout.height);
  }, []);

  const listBottomPadding = useMemo(
    () => composerHeight + CHAT_EDGE_VERTICAL_PAD,
    [composerHeight],
  );

  const appendUiMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, message];
      messagesRef.current = next;
      return next;
    });
  }, []);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: createId(),
      role: 'user',
      text,
    };

    const nextUiMessages = [...messagesRef.current, userMsg];
    messagesRef.current = nextUiMessages;
    setMessages(nextUiMessages);
    setDraft('');
    setIsLoading(true);

    const nextApiHistory: ApiMessage[] = [
      ...apiHistory.current,
      { role: 'user', content: text },
    ];

    const currentRequestId = ++requestIdRef.current;

    try {
      const reply = await sendMessage(nextApiHistory, 'apo');

      if (currentRequestId !== requestIdRef.current) return;

      const assistantMsg: ChatMessage = {
        id: createId(),
        role: 'assistant',
        text: reply,
      };

      appendUiMessage(assistantMsg);
      apiHistory.current = [...nextApiHistory, { role: 'assistant', content: reply }];
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;

      console.error('[Apo] Claude API error:', err);

      appendUiMessage({
        id: createId(),
        role: 'assistant',
        text: USER_FRIENDLY_ERROR,
      });

      // 실패해도 유저 메시지는 유지
      apiHistory.current = nextApiHistory;
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [appendUiMessage, draft, isLoading]);

  const onReset = useCallback(() => {
    requestIdRef.current += 1;
    apiHistory.current = [];
    messagesRef.current = [...WELCOME_MESSAGES];
    setMessages([...WELCOME_MESSAGES]);
    setDraft('');
    setIsLoading(false);
  }, []);

  const onQuickPrompt = useCallback((label: string) => {
    setDraft((prev) => (prev.trim().length > 0 ? `${prev.trim()}\n${label}` : label));
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isApo = item.role === 'assistant';
      const prevItem = index > 0 ? messages[index - 1] : null;
      const hideAvatar = isApo && prevItem?.role === 'assistant';

      return (
        <ChatBubble role={isApo ? 'apo' : 'user'} hideBotAvatar={hideAvatar}>
          {item.text}
        </ChatBubble>
      );
    },
    [messages],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const composerBottomPad = Math.max(insets.bottom, 10);

  return (
    <View style={styles.screenRoot}>
      <Header
        title="아포"
        rightIcon={<Text style={styles.headerAction}>새 대화</Text>}
        onPressRight={onReset}
        style={styles.headerStretch}
        testID="apo-header"
        accessibilityLabel="아포 건강 상담 챗봇"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? HEADER_HEIGHT : 0}
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
          removeClippedSubviews={false}
          ListFooterComponent={
            isLoading ? (
              <ChatBubble role="apo">
                <ActivityIndicator size="small" color={Colors.accent} />
              </ChatBubble>
            ) : null
          }
        />

        <View
          style={[
            styles.composerOuter,
            {
              paddingBottom: composerBottomPad,
              borderTopColor: Colors.ocean.tideBorder,
            },
          ]}
          onLayout={onComposerLayout}
        >
          <View style={styles.composerInner}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="건강 고민을 편하게 적어보세요…"
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
    paddingTop: 10,
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
