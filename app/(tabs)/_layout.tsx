import { Tabs } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Colors } from '../../constants/colors';

const APO_IMG = require('../../assets/images/apo.png');
const RAPO_IMG = require('../../assets/images/rapo.png');
const HOME_IMG = require('../../assets/logo/home_icon.png');

const GLOW_SIZE = 72;

// 활성 탭의 아이콘 뒤에 은은한 하늘색 빛(라디얼 그라디언트) 표시
function TabGlow() {
  return (
    <Svg
      pointerEvents="none"
      width={GLOW_SIZE}
      height={GLOW_SIZE}
      style={styles.glow}
    >
      <Defs>
        <RadialGradient id="tabGlow" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
          <Stop offset="0%" stopColor={Colors.primary} stopOpacity={0.35} />
          <Stop offset="45%" stopColor={Colors.secondary} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={Colors.secondary} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={GLOW_SIZE} height={GLOW_SIZE} fill="url(#tabGlow)" />
    </Svg>
  );
}

function TabIconWrapper({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.iconWrap}>
      {focused && <TabGlow />}
      {children}
    </View>
  );
}

function TabImage({
  source,
  focused,
}: {
  source: ReturnType<typeof require>;
  focused: boolean;
}) {
  return (
    <TabIconWrapper focused={focused}>
      <Image
        source={source}
        resizeMode="contain"
        style={{
          width: 36,
          height: 36,
          opacity: focused ? 1 : 0.9,
        }}
      />
    </TabIconWrapper>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          paddingTop: 0,
        },
        // 라벨이 없을 때 위쪽 여백을 늘려 아이콘을 시각적으로 더 아래로 배치
        tabBarIconStyle: {
          marginTop: 12,
          marginBottom: 0,
        },
        headerShown: false,
      }}
    >
      {/* 왼쪽: 아포 (돌고래) */}
      <Tabs.Screen
        name="apo"
        options={{
          title: '아포',
          tabBarIcon: ({ focused }) => <TabImage source={APO_IMG} focused={focused} />,
        }}
      />
      {/* 가운데: 홈 */}
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ focused }) => <TabImage source={HOME_IMG} focused={focused} />,
        }}
      />
      {/* 오른쪽: 라포 (해마) */}
      <Tabs.Screen
        name="rapo"
        options={{
          title: '라포',
          tabBarIcon: ({ focused }) => <TabImage source={RAPO_IMG} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    top: (44 - GLOW_SIZE) / 2,
    left: (56 - GLOW_SIZE) / 2,
  },
});
