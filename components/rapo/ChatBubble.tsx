import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Colors } from '../../constants/colors';

export type ChatBubbleRole = 'rapo' | 'user';

export type ChatBubbleProps = {
  role: ChatBubbleRole;
  children: React.ReactNode;
  /** 하단 메타 (예: 오전 10:24) */
  timeLabel?: string;
  /** 라포 말풍선만: 아바타 숨김 (연속 메시지 등) */
  hideRapoAvatar?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

const RAPO = {
  /** 탭 아이콘과 통일 (해마 라포 캐릭터 톤) */
  face: '🌀',
  name: '라포',
} as const;

export function ChatBubble({
  role,
  children,
  timeLabel,
  hideRapoAvatar = false,
  style,
  testID,
  accessibilityLabel,
}: ChatBubbleProps) {
  const isRapo = role === 'rapo';

  const defaultA11y =
    typeof children === 'string'
      ? `${isRapo ? RAPO.name : '나'}: ${children}`
      : isRapo
        ? `${RAPO.name} 메시지`
        : '내 메시지';

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? defaultA11y}
      style={[styles.row, isRapo ? styles.rowRapo : styles.rowUser, style]}
    >
      {isRapo && !hideRapoAvatar && (
        <View style={styles.rapoAvatar} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={styles.rapoAvatarEmoji}>{RAPO.face}</Text>
        </View>
      )}
      {isRapo && hideRapoAvatar && <View style={styles.rapoAvatarSpacer} />}

      <View
        style={[
          styles.bubbleColumn,
          isRapo ? styles.bubbleColumnRapo : styles.bubbleColumnUser,
        ]}
      >
        {isRapo && (
          <Text
            style={styles.rapoName}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {RAPO.name}
          </Text>
        )}
        <View
          style={[
            styles.bubble,
            isRapo ? styles.bubbleRapo : styles.bubbleUser,
          ]}
        >
          {typeof children === 'string' ? (
            <Text
              style={[styles.messageText, isRapo ? styles.textRapo : styles.textUser]}
            >
              {children}
            </Text>
          ) : (
            <View>{children}</View>
          )}
        </View>
        {timeLabel ? (
          <Text
            style={[styles.time, isRapo ? styles.timeRapo : styles.timeUser]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {timeLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const BUBBLE_R = 20;
/** 말풍선 꼬리 느낌: 한 모서리만 살짝 덜 둥글게 */
const TAIL = 6;

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  rowRapo: {
    justifyContent: 'flex-start',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rapoAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.ocean.bubbleSoft,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 22,
  },
  rapoAvatarEmoji: {
    fontSize: 22,
  },
  rapoAvatarSpacer: {
    width: 48,
  },
  bubbleColumn: {
    maxWidth: '78%',
  },
  bubbleColumnRapo: {
    alignItems: 'flex-start',
  },
  bubbleColumnUser: {
    alignItems: 'flex-end',
  },
  rapoName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
    marginLeft: 4,
    letterSpacing: -0.2,
  },
  bubble: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  bubbleRapo: {
    backgroundColor: Colors.white,
    borderColor: Colors.ocean.cardEdge,
    borderTopLeftRadius: BUBBLE_R,
    borderTopRightRadius: BUBBLE_R,
    borderBottomRightRadius: BUBBLE_R,
    borderBottomLeftRadius: TAIL,
    shadowColor: Colors.accent,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderColor: 'rgba(46, 95, 163, 0.22)',
    borderTopLeftRadius: BUBBLE_R,
    borderTopRightRadius: BUBBLE_R,
    borderBottomLeftRadius: BUBBLE_R,
    borderBottomRightRadius: TAIL,
    shadowColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  textRapo: {
    color: Colors.text,
    fontWeight: '500',
  },
  textUser: {
    color: Colors.white,
    fontWeight: '600',
  },
  time: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '500',
  },
  timeRapo: {
    color: Colors.textLight,
    marginLeft: 4,
    alignSelf: 'flex-start',
  },
  timeUser: {
    color: Colors.textLight,
    marginRight: 4,
    alignSelf: 'flex-end',
  },
});
