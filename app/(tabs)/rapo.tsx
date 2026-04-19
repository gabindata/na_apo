import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
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
import { IntensitySlider } from '../../components/rapo/IntensitySlider';
import { Colors } from '../../constants/colors';
import { RAPO_UI_INTENSITY_MARKER } from '../../constants/prompts';
import { sendMessage, type Message as ApiMessage } from '../../lib/claude';
import { supabase } from '../../lib/supabase';

const H_PAD = 20;
const COMPOSER_MIN_HEIGHT = 44;
const INPUT_MAX_LINES = 5;
/** FlatList 대화 영역 상단 패딩과 동일 — 키보드와 입력 영역 사이에도 같은 간격 */
const CHAT_EDGE_VERTICAL_PAD = 4;

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function stripRapoUiMarkers(raw: string): string {
  return raw.split(RAPO_UI_INTENSITY_MARKER).join('').trim();
}

function parseRapoAssistantReply(raw: string): {
  visible: string;
  showIntensityUi: boolean;
  forApi: string;
} {
  const hasMarker = raw.includes(RAPO_UI_INTENSITY_MARKER);
  const forApi = stripRapoUiMarkers(raw);
  const showIntensityUi = hasMarker || isIntensityQuestion(forApi);
  const visible = forApi.length > 0 ? forApi : '통증 강도를 알려주세요.';
  return { visible, showIntensityUi, forApi };
}

/**
 * 텍스트가 강도(0~10) 질문인지 판별.
 * 마커 없는 폴백용이자, 강도 제출 후 '진짜 다시 묻는 건지' 확인용으로도 사용.
 */
function isIntensityQuestion(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').toLowerCase();

  const isQuestion =
    /[?？]/.test(text) ||
    /(인가요|나요|까요|주세요)\s*$/.test(text.trim());

  const has010Scale =
    /0\s*[~\-]\s*10/.test(normalized) ||
    /0\s*(에서|부터)\s*10/.test(text) ||
    /1\s*[~\-]\s*10/.test(normalized) ||
    /10\s*점\s*만점/.test(text) ||
    /만점.*?10/.test(text);

  const hasIntensityContext =
    /통증\s*강도/.test(text) ||
    /강도는?\s*몇/.test(text) ||
    /강도(가|를|을)\s*(알려|말씀|점수|표현|선택)/.test(text) ||
    (has010Scale && /통증|아프|불편/.test(text));

  const looksLikeAckOnly =
    /^(네|좋아요|알겠|고마|감사|그럼|다음|좋습니다|오케이)/.test(text.trim()) && !isQuestion;

  return isQuestion && !looksLikeAckOnly && (has010Scale || hasIntensityContext);
}

const WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome-1',
    role: 'assistant',
    text: '안녕, 나는 라포예요. 🌊\n오늘 있었던 일이나 몸 상태를 편하게 적어줘도 돼요. 나중에 아포와 연결할 기록 챗봇이에요.',
  },
];

const USER_FRIENDLY_ERROR = '지금 응답이 원활하지 않아요. 잠시 후 다시 시도해주세요.';

export default function RapoScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(WELCOME_MESSAGES);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingIntensityInComposer, setAwaitingIntensityInComposer] = useState(false);
  const [pendingIntensity, setPendingIntensity] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(0);

  const apiHistory = useRef<ApiMessage[]>([]);
  const requestIdRef = useRef(0);
  const intensitySubmittingRef = useRef(false);

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

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
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

  useEffect(() => {
    const t = setTimeout(() => scrollToEnd(), 50);
    return () => clearTimeout(t);
  }, [isKeyboardVisible, keyboardHeight, composerHeight, scrollToEnd]);

  const onComposerLayout = useCallback((e: LayoutChangeEvent) => {
    setComposerHeight(e.nativeEvent.layout.height);
  }, []);

  // 컴포저(입력·슬라이더) 높이만큼 리스트 하단 패딩 — 키보드가 올라와도 마지막 말풍선을 끝까지 올릴 수 있게
  // composer는 FlatList 아래 쌓이는 구조(오버랩 없음) — paddingBottom은 미적 여백만 필요
  const listBottomPadding = CHAT_EDGE_VERTICAL_PAD;

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: createId(), role: 'user', text };
    const nextUiMessages = [...messages, userMsg];
    setMessages(nextUiMessages);
    setDraft('');
    setIsLoading(true);

    const nextApiHistory: ApiMessage[] = [
      ...apiHistory.current,
      { role: 'user', content: text },
    ];

    const currentRequestId = ++requestIdRef.current;

    try {
      const reply = await sendMessage(nextApiHistory, 'rapo');

      if (currentRequestId !== requestIdRef.current) return;

      const { visible, showIntensityUi, forApi } = parseRapoAssistantReply(reply);

      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', text: visible }]);
      apiHistory.current = [...nextApiHistory, { role: 'assistant', content: forApi }];

      if (showIntensityUi) {
        setAwaitingIntensityInComposer(true);
        setPendingIntensity(0);
      }
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;

      console.error('[Rapo] Claude API error:', err);
      apiHistory.current = nextApiHistory;
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: 'assistant', text: USER_FRIENDLY_ERROR },
      ]);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [draft, isLoading, messages]);

  const onSubmitIntensity = useCallback(async () => {
    if (!awaitingIntensityInComposer || intensitySubmittingRef.current || isLoading) return;

    intensitySubmittingRef.current = true;
    const text = `통증 강도는 ${pendingIntensity}/10이에요.`;

    const userMsg: ChatMessage = { id: createId(), role: 'user', text };
    setAwaitingIntensityInComposer(false);

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const nextApiHistory: ApiMessage[] = [
      ...apiHistory.current,
      { role: 'user', content: text },
    ];

    const currentRequestId = ++requestIdRef.current;

    try {
      const reply = await sendMessage(nextApiHistory, 'rapo');

      if (currentRequestId !== requestIdRef.current) return;

      const { visible, forApi } = parseRapoAssistantReply(reply);

      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', text: visible }]);
      apiHistory.current = [...nextApiHistory, { role: 'assistant', content: forApi }];

      // 강도 제출 후 슬라이더 재표시 조건:
      //   마커가 있으면서 AND 실제 강도 질문처럼 보일 때만 재표시
      //   → Claude가 마커를 잘못 붙인 인정·감사 응답에서 오탐 방지
      if (reply.includes(RAPO_UI_INTENSITY_MARKER) && isIntensityQuestion(forApi)) {
        setAwaitingIntensityInComposer(true);
        setPendingIntensity(0);
      }
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;

      console.error('[Rapo] Claude API error (intensity):', err);
      apiHistory.current = nextApiHistory;
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: 'assistant', text: USER_FRIENDLY_ERROR },
      ]);
    } finally {
      intensitySubmittingRef.current = false;
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [awaitingIntensityInComposer, isLoading, pendingIntensity]);

  const onReset = useCallback(() => {
    requestIdRef.current++;
    apiHistory.current = [];
    setMessages(WELCOME_MESSAGES);
    setDraft('');
    setIsLoading(false);
    setAwaitingIntensityInComposer(false);
    setPendingIntensity(0);
    intensitySubmittingRef.current = false;
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isRapo = item.role === 'assistant';
      const prevItem = index > 0 ? messages[index - 1] : null;
      const hideAvatar = isRapo && prevItem?.role === 'assistant';

      return (
        <ChatBubble
          role={isRapo ? 'rapo' : 'user'}
          hideBotAvatar={hideAvatar}
        >
          {item.text}
        </ChatBubble>
      );
    },
    [messages],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // 키보드 켜진 상태에서의 하단 패딩
  const composerBottomPad = isKeyboardVisible ? 10 : Math.max(insets.bottom, 10);

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
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={styles.flex}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: listBottomPadding,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews={false}
          ListFooterComponent={
            isLoading ? (
              <ChatBubble role="rapo">
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
          {awaitingIntensityInComposer && (
            <View style={styles.composerIntensity}>
              <IntensitySlider
                value={pendingIntensity}
                onValueChange={setPendingIntensity}
                disabled={isLoading}
              />
              <Pressable
                onPress={onSubmitIntensity}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.intensityDoneBtn,
                  isLoading && styles.sendBtnDisabled,
                  pressed && !isLoading && styles.sendBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="통증 강도 선택 완료"
              >
                <Text
                  style={[
                    styles.intensityDoneBtnText,
                    isLoading && styles.sendBtnTextDisabled,
                  ]}
                >
                  선택 완료
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.composerInner}>
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
    paddingTop: 10,
  },
  composerOuter: {
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: H_PAD,
    /** 말풍선 row marginBottom(10)만으로 말풍선 간격과 비슷하게 유지 — paddingTop을 두면 간격이 커짐 */
    paddingTop: 10,
  },
  composerIntensity: {
    marginBottom: 10,
  },
  intensityDoneBtn: {
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Colors.accent,
  },
  intensityDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
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
