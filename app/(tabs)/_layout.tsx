import React from 'react';
import { Tabs } from 'expo-router';
import { Image, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

const ICONS = {
  home: require('@/assets/icons/tab-home.png'),
  map: require('@/assets/icons/tab-map.png'),
  save: require('@/assets/icons/tab-save.png'),
  schedule: require('@/assets/icons/tab-schedule.png'),
  mypage: require('@/assets/icons/tab-mypage.png'),
};

interface TabIconProps {
  source: ReturnType<typeof require>;
  label: string;
  focused: boolean;
}

function TabIcon({ source, label, focused }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      <Image
        source={source}
        style={[
          styles.icon,
          { tintColor: focused ? Colors.navActive : Colors.navInactive },
        ]}
        resizeMode="contain"
      />
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderWidth: 0.5,
          borderColor: Colors.border,
          height: 66 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 14,
          shadowColor: '#3A3330',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -3 },
          elevation: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon source={ICONS.home} label="홈" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon source={ICONS.map} label="지도" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="save"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon source={ICONS.save} label="저장" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon source={ICONS.schedule} label="일정" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon source={ICONS.mypage} label="마이" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: 56,
  },
  icon: {
    width: 20,
    height: 20,
  },
  label: {
    fontSize: 11,
    color: Colors.navInactive,
    fontWeight: '400',
  },
  labelActive: {
    color: Colors.navActive,
    fontWeight: '600',
  },
});
