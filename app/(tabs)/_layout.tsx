import { Tabs } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { Colors } from '../../constants/colors';

const APO_IMG = require('../../assets/images/apo.png');
const RAPO_IMG = require('../../assets/images/rapo.png');
const HOME_IMG = require('../../assets/logo/home_icon.png');

// 활성 탭의 아이콘에 둥근 배경 하이라이트 적용
function TabIconWrapper({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
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
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  iconWrapActive: {
    backgroundColor: Colors.ocean.bubbleSoft,
    borderWidth: 1,
    borderColor: Colors.ocean.tideBorder,
  },
});
