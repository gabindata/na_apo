import { Tabs } from 'expo-router';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../constants/colors';
import {
  FLOATING_TAB_BAR_BOTTOM_MARGIN,
  FLOATING_TAB_BAR_HEIGHT,
  FLOATING_TAB_BAR_SIDE_INSET,
} from '../../constants/tabBar';

const APO_IMG   = require('../../assets/images/apo_tab.png');
const RAPO_IMG  = require('../../assets/images/rapo_tab.png');
const HOME_V2   = require('../../assets/logo/naapo_logo_ver2_button.png');

// ── 탭 이미지 ───────────────────────────────────────────
function TabImage({
  source,
  focused,
  size = 30,
}: {
  source: ReturnType<typeof require>;
  focused: boolean;
  size?: number;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.activeWrap]}>
      <Image
        source={source}
        resizeMode="contain"
        style={{ width: size, height: size, opacity: focused ? 0.95 : 0.32 }}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#A8D8F0',
        tabBarInactiveTintColor: 'rgba(164,194,219,0.32)',
        tabBarShowLabel: false,
        tabBarBackground: () => (
          <View style={styles.tabCard}>
            <View style={styles.tabCardFill} />
            <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.tabCardStroke} />
          </View>
        ),
        tabBarStyle: {
          position: 'absolute',
          left: FLOATING_TAB_BAR_SIDE_INSET,
          right: FLOATING_TAB_BAR_SIDE_INSET,
          bottom: Math.max(insets.bottom, 10) + FLOATING_TAB_BAR_BOTTOM_MARGIN,
          height: FLOATING_TAB_BAR_HEIGHT,
          paddingHorizontal: 10,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          borderRadius: 26,
          overflow: 'hidden',
          elevation: 0,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.08,
              shadowRadius: 14,
            },
            android: {
              elevation: 4,
            },
          }),
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarIconStyle: {
          marginTop: 8,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="apo"
        options={{
          title: '아포',
          tabBarIcon: ({ focused }) => <TabImage source={APO_IMG} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ focused }) => <TabImage source={HOME_V2} focused={focused} size={36} />,
        }}
      />
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
  tabCard: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    overflow: 'hidden',
  },
  tabCardFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,36,64,0.45)',
  },
  tabCardStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.ocean.tideBorder,
  },
  iconWrap: {
    width: 52,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  activeWrap: {
    backgroundColor: Colors.ocean.heroWash,
    ...Platform.select({
      ios: {
        shadowColor: '#A8D8F0',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
});
