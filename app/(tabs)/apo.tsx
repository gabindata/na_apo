import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ChatBubble } from '../../components/common/ChatBubble';
import { OceanBubbles } from '../../components/ocean/OceanBubbles';
import { floatingTabBarOverlayClearance } from '../../constants/tabBar';
import { sendMessage, type Message as ApiMessage } from '../../lib/claude';
import {
  createApoConversation,
  saveApoMessage,
  fetchApoConversations,
  fetchApoMessages,
  deleteApoConversation,
  type ApoConversation,
  type ApoMessage,
} from '../../lib/apoConversations';

const H_PAD = 18;
const COMPOSER_MIN_HEIGHT = 44;
const INPUT_MAX_LINES = 5;
const CHAT_EDGE_VERTICAL_PAD = 4;

const T = {
  text:      '#FFFFFF',
  textMuted: '#C8DFEF',
  secondary: '#7EC8E3',
  primary:   '#4A90D9',
} as const;

type ChatRole = 'user' | 'assistant';
type ChatMessage = { id: string; role: ChatRole; text: string };

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome-1',
    role: 'assistant',
    text: '안녕하세요, 저는 아포예요.\n건강 관련 궁금한 점이나 걱정되는 증상이 있으면 편하게 말씀해 주세요.',
  },
];

const USER_FRIENDLY_ERROR = '지금 응답이 원활하지 않아요. 잠시 후 다시 시도해주세요.';

export default function ApoScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([...WELCOME_MESSAGES]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [composerHeight, setComposerHeight] = useState(0);
  const [guideExpanded, setGuideExpanded] = useState(true);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [conversations, setConversations] = useState<ApoConversation[]>([]);
  const [detailConv, setDetailConv] = useState<{ conv: ApoConversation; messages: ApoMessage[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const currentConvIdRef = useRef<string | null>(null);

  const messagesRef  = useRef<ChatMessage[]>([...WELCOME_MESSAGES]);
  const apiHistory   = useRef<ApiMessage[]>([]);
  const requestIdRef = useRef(0);

  const canSend = draft.trim().length > 0 && !isLoading;

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => { listRef.current?.scrollToEnd({ animated: true }); });
  }, []);

  useEffect(() => { scrollToEnd(); }, [messages.length, isLoading, scrollToEnd]);
  useEffect(() => {
    const t = setTimeout(() => scrollToEnd(), 50);
    return () => clearTimeout(t);
  }, [composerHeight, scrollToEnd]);

  const onComposerLayout = useCallback((e: LayoutChangeEvent) => {
    setComposerHeight(e.nativeEvent.layout.height);
  }, []);

  const listBottomPadding = CHAT_EDGE_VERTICAL_PAD;

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

    const userMsg: ChatMessage = { id: createId(), role: 'user', text };
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

    // 첫 메시지면 대화 생성
    if (!currentConvIdRef.current) {
      try {
        const convId = await createApoConversation(text);
        currentConvIdRef.current = convId;
        // 웰컴 메시지 저장
        const welcome = WELCOME_MESSAGES[0];
        if (welcome) await saveApoMessage(convId, 'assistant', welcome.text);
      } catch (e) {
        console.warn('[Apo] 대화 생성 실패:', e);
      }
    }

    // 유저 메시지 저장
    if (currentConvIdRef.current) {
      saveApoMessage(currentConvIdRef.current, 'user', text).catch((e) =>
        console.warn('[Apo] 메시지 저장 실패:', e),
      );
    }

    try {
      const reply = await sendMessage(nextApiHistory, 'apo');
      if (currentRequestId !== requestIdRef.current) return;

      const assistantMsg: ChatMessage = { id: createId(), role: 'assistant', text: reply };
      appendUiMessage(assistantMsg);
      apiHistory.current = [...nextApiHistory, { role: 'assistant', content: reply }];

      // 어시스턴트 응답 저장
      if (currentConvIdRef.current) {
        saveApoMessage(currentConvIdRef.current, 'assistant', reply).catch((e) =>
          console.warn('[Apo] 응답 저장 실패:', e),
        );
      }
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error('[Apo] Claude API error:', err);
      appendUiMessage({ id: createId(), role: 'assistant', text: USER_FRIENDLY_ERROR });
      apiHistory.current = nextApiHistory;
    } finally {
      if (currentRequestId === requestIdRef.current) setIsLoading(false);
    }
  }, [appendUiMessage, draft, isLoading]);

  const onReset = useCallback(() => {
    requestIdRef.current += 1;
    apiHistory.current = [];
    currentConvIdRef.current = null;
    messagesRef.current = [...WELCOME_MESSAGES];
    setMessages([...WELCOME_MESSAGES]);
    setDraft('');
    setIsLoading(false);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isApo    = item.role === 'assistant';
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

  const openHistory = useCallback(async () => {
    setHistoryVisible(true);
    setHistoryLoading(true);
    try {
      const list = await fetchApoConversations();
      setConversations(list);
    } catch (e) {
      console.warn('[Apo] 기록 조회 실패:', e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openDetail = useCallback(async (conv: ApoConversation) => {
    try {
      const msgs = await fetchApoMessages(conv.id);
      setDetailConv({ conv, messages: msgs });
    } catch (e) {
      console.warn('[Apo] 메시지 조회 실패:', e);
    }
  }, []);

  const onDeleteConversation = useCallback((convId: string) => {
    Alert.alert('대화 삭제', '이 대화 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteApoConversation(convId);
            setConversations((prev) => prev.filter((c) => c.id !== convId));
            if (detailConv?.conv.id === convId) setDetailConv(null);
          } catch (e) {
            console.warn('[Apo] 삭제 실패:', e);
          }
        },
      },
    ]);
  }, [detailConv]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);
  const composerBottomPad = isKeyboardVisible
    ? 10
    : floatingTabBarOverlayClearance(insets.bottom);

  return (
    <LinearGradient
      colors={['#3A7AB0', '#1A4068', '#0F2840', '#0A1A2E']}
      locations={[0, 0.35, 0.70, 1]}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <OceanBubbles variant="home" />

      {/* 상단 바 */}
      <View style={styles.topBar}>
        <Image
          source={require('../../assets/logo/icon.png')}
          style={styles.topLogo}
          resizeMode="contain"
          accessibilityLabel="나아포"
        />
        <View style={styles.topBarRight}>
          <Pressable
            onPress={openHistory}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="대화 기록"
          >
            <LinearGradient
              colors={['rgba(74,144,217,0.30)', 'rgba(46,95,163,0.28)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.resetBtn}
            >
              <Ionicons name="time-outline" size={14} color={T.secondary} />
              <Text style={styles.resetBtnText}>기록</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={onReset}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="새 대화 시작"
          >
            <LinearGradient
              colors={['rgba(74,144,217,0.30)', 'rgba(46,95,163,0.28)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.resetBtn}
            >
              <Text style={styles.resetBtnText}>새 대화</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* 가이드 블록 */}
        <Pressable
          onPress={() => setGuideExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={guideExpanded ? '가이드라인 접기' : '가이드라인 펼치기'}
        >
          <View style={styles.guideBlock}>
            <View style={styles.guideShine} />
            <View style={styles.guideHeader}>
              <Text style={styles.guideHeaderText}>아포에게 물어보세요</Text>
              <Text style={styles.guideToggle}>{guideExpanded ? '접기 ▲' : '펼치기 ▼'}</Text>
            </View>
            {guideExpanded && (
              <View style={styles.guideContent}>
                <Text style={styles.guideItem}>건강 고민이나 증상에 대해 편하게 물어보세요.</Text>
                <Text style={styles.guideItem}>의학적 진단·처방은 제공하지 않아요.</Text>
                <Text style={styles.guideItem}>응급 증상이라면 즉시 병원 방문을 권해요.</Text>
              </View>
            )}
          </View>
        </Pressable>

        {/* 채팅 목록 */}
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
                <ActivityIndicator size="small" color={T.secondary} />
              </ChatBubble>
            ) : null
          }
        />

        {/* 입력창 */}
        <View style={styles.composerOuter} onLayout={onComposerLayout}>
          <View style={styles.composerShine} />
          <View style={[styles.composerInner, { paddingBottom: composerBottomPad }]}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="건강 고민을 편하게 적어보세요…"
              placeholderTextColor="rgba(164,194,219,0.55)"
              multiline
              maxLength={4000}
              textAlignVertical="top"
              accessibilityLabel="메시지 입력"
              blurOnSubmit={false}
              selectionColor={T.secondary}
            />
            <Pressable
              onPress={onSend}
              disabled={!canSend}
              style={({ pressed }) => [pressed && canSend && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
              accessibilityRole="button"
              accessibilityLabel="보내기"
              accessibilityState={{ disabled: !canSend }}
            >
              <LinearGradient
                colors={canSend ? ['#5A9FE9', '#2E6BBF', '#1A4FA8'] : ['rgba(80,100,130,0.4)', 'rgba(60,80,110,0.4)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtn}
              >
                <Text style={[styles.sendBtnText, !canSend && styles.sendBtnTextDisabled]}>
                  보내기
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── 대화 기록 목록 모달 ── */}
      <Modal
        visible={historyVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <LinearGradient
          colors={['#1A4068', '#0F2840', '#0A1A2E']}
          style={[styles.modalRoot, { paddingTop: insets.top }]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>대화 기록</Text>
            <Pressable
              onPress={() => { setHistoryVisible(false); setDetailConv(null); }}
              hitSlop={10}
              accessibilityLabel="닫기"
            >
              <Ionicons name="close" size={22} color={T.textMuted} />
            </Pressable>
          </View>

          {detailConv ? (
            // 상세 뷰
            <>
              <View style={styles.detailTopBar}>
                <Pressable onPress={() => setDetailConv(null)} hitSlop={10}>
                  <Text style={styles.detailBack}>← 목록</Text>
                </Pressable>
                <Pressable onPress={() => onDeleteConversation(detailConv.conv.id)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={18} color="rgba(220,100,100,0.85)" />
                </Pressable>
              </View>
              <Text style={styles.detailDate}>
                {new Date(detailConv.conv.created_at).toLocaleString('ko-KR', {
                  month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </Text>
              <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.detailScroll}
                showsVerticalScrollIndicator={false}
              >
                {detailConv.messages.map((msg) => (
                  <ChatBubble key={msg.id} role={msg.role === 'assistant' ? 'apo' : 'user'}>
                    {msg.text}
                  </ChatBubble>
                ))}
              </ScrollView>
            </>
          ) : (
            // 목록 뷰
            historyLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={T.secondary} />
              </View>
            ) : conversations.length === 0 ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>저장된 대화가 없어요.</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.historyList}
                showsVerticalScrollIndicator={false}
              >
                {conversations.map((conv) => (
                  <Pressable
                    key={conv.id}
                    onPress={() => openDetail(conv)}
                    style={({ pressed }) => [styles.convCard, pressed && { opacity: 0.75 }]}
                  >
                    <View style={styles.convCardInner}>
                      <View style={styles.convCardTextWrap}>
                        <Text style={styles.convPreview} numberOfLines={2}>
                          {conv.preview}
                        </Text>
                        <Text style={styles.convDate}>
                          {new Date(conv.created_at).toLocaleString('ko-KR', {
                            month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => onDeleteConversation(conv.id)}
                        hitSlop={10}
                        accessibilityLabel="대화 삭제"
                      >
                        <Ionicons name="trash-outline" size={17} color="rgba(200,90,90,0.75)" />
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )
          )}
        </LinearGradient>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  // 상단 바
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 6,
  },
  topLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 8,
  },
  resetBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: T.secondary,
  },

  // 모달
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(168,216,234,0.18)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: T.text,
    letterSpacing: -0.3,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: T.textMuted,
    fontWeight: '500',
  },
  historyList: {
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 10,
  },
  convCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.22)',
    backgroundColor: 'rgba(120,175,220,0.13)',
    overflow: 'hidden',
  },
  convCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  convCardTextWrap: {
    flex: 1,
    gap: 5,
  },
  convPreview: {
    fontSize: 14,
    fontWeight: '600',
    color: T.text,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  convDate: {
    fontSize: 11,
    fontWeight: '500',
    color: T.textMuted,
  },

  // 상세 뷰
  detailTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingVertical: 10,
  },
  detailBack: {
    fontSize: 14,
    fontWeight: '700',
    color: T.secondary,
  },
  detailDate: {
    fontSize: 11,
    fontWeight: '500',
    color: T.textMuted,
    paddingHorizontal: H_PAD,
    marginBottom: 8,
  },
  detailScroll: {
    paddingHorizontal: H_PAD,
    paddingBottom: 40,
    paddingTop: 4,
  },

  // 가이드 블록
  guideBlock: {
    marginHorizontal: H_PAD,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.28)',
    backgroundColor: 'rgba(120,175,220,0.13)',
    overflow: 'hidden',
  },
  guideShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  guideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  guideHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: T.text,
  },
  guideToggle: {
    fontSize: 11,
    fontWeight: '600',
    color: T.textMuted,
  },
  guideContent: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(168,216,234,0.20)',
    paddingTop: 8,
  },
  guideItem: {
    fontSize: 13,
    fontWeight: '500',
    color: T.textMuted,
    lineHeight: 20,
  },

  // 채팅 목록
  listContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: H_PAD,
    paddingTop: 10,
  },

  // 입력창
  composerOuter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(168,216,234,0.18)',
    backgroundColor: 'rgba(8,18,38,0.55)',
    paddingTop: 10,
    paddingHorizontal: H_PAD,
    overflow: 'hidden',
  },
  composerShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  composerInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingBottom: 12,
  },
  input: {
    flex: 1,
    minHeight: COMPOSER_MIN_HEIGHT,
    maxHeight: 22 * INPUT_MAX_LINES + 24,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.28)',
    backgroundColor: 'rgba(120,175,220,0.14)',
    fontSize: 15,
    lineHeight: 22,
    color: T.text,
  },
  sendBtn: {
    minHeight: COMPOSER_MIN_HEIGHT,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.30)',
  },
  sendBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EAF4FF',
  },
  sendBtnTextDisabled: {
    color: 'rgba(164,194,219,0.45)',
  },
});
