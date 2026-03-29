import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Colors } from '../../constants/colors';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
        },
        headerShown: false,
      }}
    >
      {/* 왼쪽: 아포 (돌고래) */}
      <Tabs.Screen
        name="apo"
        options={{
          title: '아포',
          tabBarIcon: () => <TabIcon emoji="🐬" />,
        }}
      />
      {/* 가운데: 홈 */}
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: () => <TabIcon emoji="🏠" />,
        }}
      />
      {/* 오른쪽: 라포 (해마) */}
      <Tabs.Screen
        name="rapo"
        options={{
          title: '라포',
          tabBarIcon: () => <TabIcon emoji="🌀" />,
        }}
      />
    </Tabs>
  );
}
