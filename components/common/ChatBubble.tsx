import React from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type ChatBubbleRole = 'rapo' | 'apo' | 'user';

export type ChatBubbleProps = {
  role: ChatBubbleRole;
  children: React.ReactNode;
  timeLabel?: string;
  hideBotAvatar?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

const RAPO = {
  image: require('../../assets/images/rapo_tab.png'),
  name: '라포',
} as const;

const APO = {
  image: require('../../assets/images/apo_tab.png'),
  name: '아포',
} as const;

const T = {
  text:      '#FFFFFF',
  textMuted: '#C8DFEF',
  secondary: '#7EC8E3',
};

export function ChatBubble({
  role,
  children,
  timeLabel,
  hideBotAvatar = false,
  style,
  testID,
  accessibilityLabel,
}: ChatBubbleProps) {
  const isBot  = role === 'rapo' || role === 'apo';
  const botMeta = role === 'apo' ? APO : RAPO;

  const defaultA11y =
    typeof children === 'string'
      ? `${isBot ? botMeta.name : '나'}: ${children}`
      : isBot ? `${botMeta.name} 메시지` : '내 메시지';

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? defaultA11y}
      style={[styles.row, isBot ? styles.rowBot : styles.rowUser, style]}
    >
      {/* 봇 아바타 */}
      {isBot && !hideBotAvatar && (
        <Image
          source={botMeta.image}
          style={styles.botAvatar}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      )}
      {isBot && hideBotAvatar && <View style={styles.botAvatarSpacer} />}

      <View style={[styles.bubbleColumn, isBot ? styles.bubbleColumnBot : styles.bubbleColumnUser]}>
        {/* 봇 이름 */}
        {isBot && (
          <Text
            style={styles.botName}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {botMeta.name}
          </Text>
        )}

        {/* 말풍선 */}
        {isBot ? (
          // 봇: 글래스 버블
          <View style={styles.bubbleBot}>
            <View style={styles.bubbleBotShine} />
            {typeof children === 'string' ? (
              <Text style={styles.textBot} lineBreakStrategyIOS="hangul-word" textBreakStrategy="balanced">{children}</Text>
            ) : (
              <View>{children}</View>
            )}
          </View>
        ) : (
          // 유저: 그라디언트 버블
          <LinearGradient
            colors={['#5A9FE9', '#2E6BBF', '#1E4FA0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bubbleUser}
          >
            {typeof children === 'string' ? (
              <Text style={styles.textUser} lineBreakStrategyIOS="hangul-word" textBreakStrategy="balanced">{children}</Text>
            ) : (
              <View>{children}</View>
            )}
          </LinearGradient>
        )}

        {timeLabel ? (
          <Text style={[styles.time, isBot ? styles.timeBot : styles.timeUser]}>
            {timeLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const BUBBLE_R = 20;
const TAIL     = 6;

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  rowBot: {
    justifyContent: 'flex-start',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    width: 36,
    height: 36,
    marginRight: 8,
    marginBottom: 20,
    borderRadius: 10,
  },
  botAvatarSpacer: {
    width: 44,
  },
  bubbleColumn: {
    maxWidth: '78%',
  },
  bubbleColumnBot: {
    alignItems: 'flex-start',
  },
  bubbleColumnUser: {
    alignItems: 'flex-end',
  },
  botName: {
    fontSize: 11,
    fontWeight: '700',
    color: T.secondary,
    marginBottom: 4,
    marginLeft: 4,
    letterSpacing: 0.2,
  },
  // 봇 버블 — 글래스
  bubbleBot: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BUBBLE_R,
    borderTopLeftRadius: TAIL,
    borderWidth: 1,
    borderColor: 'rgba(168,216,234,0.28)',
    backgroundColor: 'rgba(120,175,220,0.18)',
    overflow: 'hidden',
  },
  bubbleBotShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  // 유저 버블 — 그라디언트
  bubbleUser: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BUBBLE_R,
    borderTopRightRadius: TAIL,
    borderWidth: 1,
    borderColor: 'rgba(126,200,227,0.30)',
  },
  textBot: {
    fontSize: 15,
    lineHeight: 23,
    color: T.text,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  textUser: {
    fontSize: 15,
    lineHeight: 23,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  time: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '500',
  },
  timeBot: {
    color: T.textMuted,
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  timeUser: {
    color: T.textMuted,
    marginRight: 4,
    alignSelf: 'flex-end',
  },
});
