import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { LinearGradient } from 'expo-linear-gradient';
import { ChatBubble } from '../../components/common/ChatBubble';
import { IntensitySlider } from '../../components/rapo/IntensitySlider';
import { OceanBubbles } from '../../components/ocean/OceanBubbles';
import { floatingTabBarOverlayClearance } from '../../constants/tabBar';
import { RAPO_UI_INTENSITY_MARKER, RAPO_UI_SAVE_MARKER } from '../../constants/prompts';
import { sendMessage, extractPainRecord, type Message as ApiMessage } from '../../lib/claude';
import { supabase } from '../../lib/supabase';

const H_PAD = 18;
const COMPOSER_MIN_HEIGHT = 44;
const INPUT_MAX_LINES = 5;
const CHAT_EDGE_VERTICAL_PAD = 4;

const T = {
  text:      '#EAF4FF',
  textMuted: '#A4C2DB',
  secondary: '#7EC8E3',
  primary:   '#4A90D9',
} as const;

type ChatRole = 'user' | 'assistant';
type ChatMessage = { id: string; role: ChatRole; text: string };

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function stripRapoUiMarkers(raw: string): string {
  return raw
    .split(RAPO_UI_INTENSITY_MARKER).join('')
    .split(RAPO_UI_SAVE_MARKER).join('')
    .trim();
}

function parseRapoAssistantReply(raw: string): {
  visible: string; showIntensityUi: boolean; showSaveUi: boolean; forApi: string;
} {
  const hasIntensityMarker = raw.includes(RAPO_UI_INTENSITY_MARKER);
  const hasSaveMarker      = raw.includes(RAPO_UI_SAVE_MARKER);
  const forApi             = stripRapoUiMarkers(raw);
  const showIntensityUi    = hasIntensityMarker || isIntensityQuestion(forApi);
  const showSaveUi         = hasSaveMarker;
  const visible            = forApi.length > 0 ? forApi : '통증 강도를 알려주세요.';
  return { visible, showIntensityUi, showSaveUi, forApi };
}

function isIntensityQuestion(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').toLowerCase();
  const isQuestion = /[?？]/.test(text) || /(인가요|나요|까요|주세요)\s*$/.test(text.trim());
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
    text: '안녕하세요, 저는 라포예요.\n오늘 있었던 일이나 몸 상태를 편하게 적어주세요. 나중에 아포와 연결할 기록 챗봇이에요.',
  },
];

const USER_FRIENDLY_ERROR = '지금 응답이 원활하지 않아요. 잠시 후 다시 시도해주세요.';

export default function RapoScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages]                           = useState<ChatMessage[]>(WELCOME_MESSAGES);
  const [draft, setDraft]                                 = useState('');
  const [isLoading, setIsLoading]                         = useState(false);
  const [awaitingIntensityInComposer, setAwaitingIntensityInComposer] = useState(false);
  const [pendingIntensity, setPendingIntensity]           = useState(0);
  const [showSaveButton, setShowSaveButton]               = useState(false);
  const [isSaving, setIsSaving]                           = useState(false);
  const [saveResult, setSaveResult]                       = useState<'idle' | 'success' | 'error'>('idle');
  const [hasSaved, setHasSaved]                           = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible]         = useState(false);
  const [keyboardHeight, setKeyboardHeight]               = useState(0);
  const [composerHeight, setComposerHeight]               = useState(0);

  const apiHistory           = useRef<ApiMessage[]>([]);
  const requestIdRef         = useRef(0);
  const intensitySubmittingRef = useRef(false);

  useEffect(() => {
    const checkSession = async () => {
      const { error } = await supabase.auth.getSession();
      if (error) console.warn('[Rapo] 세션 확인 실패:', error.message);
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
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const canSend = draft.trim().length > 0 && !isLoading && !isSaving && !hasSaved;

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => { listRef.current?.scrollToEnd({ animated: true }); });
  }, []);

  useEffect(() => { scrollToEnd(); }, [messages.length, isLoading, scrollToEnd]);
  useEffect(() => {
    const t = setTimeout(() => scrollToEnd(), 50);
    return () => clearTimeout(t);
  }, [isKeyboardVisible, keyboardHeight, composerHeight, scrollToEnd]);

  const onComposerLayout = useCallback((e: LayoutChangeEvent) => {
    setComposerHeight(e.nativeEvent.layout.height);
  }, []);

  const listBottomPadding = CHAT_EDGE_VERTICAL_PAD;

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: createId(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setIsLoading(true);

    const nextApiHistory: ApiMessage[] = [...apiHistory.current, { role: 'user', content: text }];
    const currentRequestId = ++requestIdRef.current;

    try {
      const reply = await sendMessage(nextApiHistory, 'rapo');
      if (currentRequestId !== requestIdRef.current) return;

      const { visible, showIntensityUi, showSaveUi, forApi } = parseRapoAssistantReply(reply);
      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', text: visible }]);
      apiHistory.current = [...nextApiHistory, { role: 'assistant', content: forApi }];

      if (showIntensityUi) { setAwaitingIntensityInComposer(true); setPendingIntensity(0); }
      if (showSaveUi)      { setShowSaveButton(true); setSaveResult('idle'); }
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error('[Rapo] Claude API error:', err);
      apiHistory.current = nextApiHistory;
      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', text: USER_FRIENDLY_ERROR }]);
    } finally {
      if (currentRequestId === requestIdRef.current) setIsLoading(false);
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

    const nextApiHistory: ApiMessage[] = [...apiHistory.current, { role: 'user', content: text }];
    const currentRequestId = ++requestIdRef.current;

    try {
      const reply = await sendMessage(nextApiHistory, 'rapo');
      if (currentRequestId !== requestIdRef.current) return;

      const { visible, forApi, showSaveUi } = parseRapoAssistantReply(reply);
      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', text: visible }]);
      apiHistory.current = [...nextApiHistory, { role: 'assistant', content: forApi }];

      if (reply.includes(RAPO_UI_INTENSITY_MARKER) && isIntensityQuestion(forApi)) {
        setAwaitingIntensityInComposer(true); setPendingIntensity(0);
      }
      if (showSaveUi) { setShowSaveButton(true); setSaveResult('idle'); }
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error('[Rapo] Claude API error (intensity):', err);
      apiHistory.current = nextApiHistory;
      setMessages((prev) => [...prev, { id: createId(), role: 'assistant', text: USER_FRIENDLY_ERROR }]);
    } finally {
      intensitySubmittingRef.current = false;
      if (currentRequestId === requestIdRef.current) setIsLoading(false);
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
    setShowSaveButton(false);
    setIsSaving(false);
    setSaveResult('idle');
    setHasSaved(false);
    intensitySubmittingRef.current = false;
  }, []);

  const onSave = useCallback(async () => {
    if (isSaving || hasSaved || apiHistory.current.length === 0) return;
    setIsSaving(true);
    setShowSaveButton(false);

    try {
      const extracted = await extractPainRecord(apiHistory.current);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('로그인이 필요해요.');

      const { error: insertError } = await supabase.from('pain_records').insert({
        user_id: user.id,
        body_part: extracted.body_part,
        intensity: extracted.intensity,
        pain_type: extracted.pain_type,
        sleep_hours: extracted.sleep_hours,
        emotion: extracted.emotion,
        daily_note: extracted.daily_note,
        recorded_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      let coinGranted = false;
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: todayCount, error: countError } = await supabase
          .from('pain_records')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('recorded_at', todayStart.toISOString());
        const isFirstToday = !countError && (todayCount ?? 0) <= 1;
        if (isFirstToday) {
          const { error: rpcError } = await supabase.rpc('increment_user_coins', {
            p_user_id: user.id, p_amount: 10,
          });
          coinGranted = !rpcError;
          if (rpcError) console.warn('[Rapo] 코인 지급 실패:', rpcError.message);
        }
      } catch (rpcErr) {
        console.warn('[Rapo] 코인 RPC 호출 실패:', rpcErr);
      }

      setHasSaved(true);
      setSaveResult('success');
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          text: coinGranted
            ? '기록이 저장됐어요! 오늘도 잘 기록해줘서 고마워요. 코인 10개를 드렸어요.'
            : '기록이 저장됐어요! 오늘도 잘 기록해줘서 고마워요.',
        },
      ]);
    } catch (err) {
      console.error('[Rapo] 저장 실패:', err);
      setSaveResult('error');
      setShowSaveButton(true);
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: 'assistant', text: '저장 중에 문제가 생겼어요. 다시 시도해줘요.' },
      ]);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, hasSaved]);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isRapo    = item.role === 'assistant';
      const prevItem  = index > 0 ? messages[index - 1] : null;
      const hideAvatar = isRapo && prevItem?.role === 'assistant';
      return (
        <ChatBubble role={isRapo ? 'rapo' : 'user'} hideBotAvatar={hideAvatar}>
          {item.text}
        </ChatBubble>
      );
    },
    [messages],
  );

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
        <Pressable onPress={onReset} hitSlop={8} accessibilityRole="button" accessibilityLabel="새 대화 시작">
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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* 채팅 목록 */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={styles.flex}
          contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews={false}
          ListFooterComponent={
            isLoading ? (
              <ChatBubble role="rapo">
                <ActivityIndicator size="small" color={T.secondary} />
              </ChatBubble>
            ) : isSaving ? (
              <View style={styles.saveRow}>
                <ActivityIndicator size="small" color={T.secondary} />
                <Text style={styles.savingText}>저장하는 중...</Text>
              </View>
            ) : showSaveButton ? (
              <View style={styles.saveRow}>
                <Pressable
                  onPress={onSave}
                  style={({ pressed }) => pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }}
                  accessibilityRole="button"
                  accessibilityLabel="오늘 기록 저장하기"
                >
                  <LinearGradient
                    colors={['#5A9FE9', '#2E6BBF', '#1A4FA8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveBtn}
                  >
                    <Text style={styles.saveBtnText}>오늘 기록 저장하기</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : null
          }
        />

        {/* 입력창 */}
        <View style={styles.composerOuter} onLayout={onComposerLayout}>
          <View style={styles.composerShine} />

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
                style={({ pressed }) => pressed && !isLoading && { opacity: 0.85, transform: [{ scale: 0.97 }] }}
                accessibilityRole="button"
                accessibilityLabel="통증 강도 선택 완료"
              >
                <LinearGradient
                  colors={isLoading ? ['rgba(80,100,130,0.4)', 'rgba(60,80,110,0.4)'] : ['#5A9FE9', '#2E6BBF', '#1A4FA8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.intensityDoneBtn}
                >
                  <Text style={[styles.intensityDoneBtnText, isLoading && styles.btnTextDisabled]}>
                    선택 완료
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          {hasSaved ? (
            <Pressable
              onPress={onReset}
              style={({ pressed }) => pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }}
              accessibilityRole="button"
              accessibilityLabel="새로운 기록 시작하기"
            >
              <LinearGradient
                colors={['#5A9FE9', '#2E6BBF', '#1A4FA8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.newChatBtn, { marginBottom: composerBottomPad }]}
              >
                <Text style={styles.newChatBtnText}>새로운 기록 시작하기</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={[styles.composerInner, { paddingBottom: composerBottomPad }]}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="오늘 있었던 일을 적어보세요…"
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
                style={({ pressed }) => pressed && canSend && { opacity: 0.85, transform: [{ scale: 0.97 }] }}
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
                  <Text style={[styles.sendBtnText, !canSend && styles.btnTextDisabled]}>
                    보내기
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

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
  resetBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.35)',
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: T.secondary,
  },

  // 채팅 목록
  listContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: H_PAD,
    paddingTop: 10,
  },

  // 저장 행
  saveRow: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: H_PAD,
    gap: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveBtn: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.30)',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EAF4FF',
    letterSpacing: -0.2,
  },
  savingText: {
    fontSize: 14,
    fontWeight: '600',
    color: T.textMuted,
    marginLeft: 8,
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
  composerIntensity: {
    marginBottom: 10,
  },
  intensityDoneBtn: {
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.30)',
  },
  intensityDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EAF4FF',
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
  btnTextDisabled: {
    color: 'rgba(164,194,219,0.45)',
  },
  newChatBtn: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.30)',
    marginBottom: 12,
  },
  newChatBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EAF4FF',
    letterSpacing: -0.2,
  },
});
