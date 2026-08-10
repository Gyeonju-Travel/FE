import React, { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { getAccessToken } from '@/utils/authStorage';
import { emitTabReset } from '@/utils/tabReset';
import TabHomeIcon from '@/assets/icons/tab-home.svg';
import TabHomeActiveIcon from '@/assets/icons/tab-home-active.svg';
import TabMapIcon from '@/assets/icons/tab-map.svg';
import TabMapActiveIcon from '@/assets/icons/tab-map-active.svg';
import TabSaveIcon from '@/assets/icons/tab-save.svg';
import TabSaveActiveIcon from '@/assets/icons/tab-save-active.svg';
import TabScheduleIcon from '@/assets/icons/tab-schedule.svg';
import TabScheduleActiveIcon from '@/assets/icons/tab-schedule-active.svg';
import TabMypageIcon from '@/assets/icons/tab-mypage.svg';
import TabMypageActiveIcon from '@/assets/icons/tab-mypage-active.svg';

const ICONS = {
  home: { outline: TabHomeIcon, active: TabHomeActiveIcon },
  map: { outline: TabMapIcon, active: TabMapActiveIcon },
  save: { outline: TabSaveIcon, active: TabSaveActiveIcon },
  schedule: { outline: TabScheduleIcon, active: TabScheduleActiveIcon },
  mypage: { outline: TabMypageIcon, active: TabMypageActiveIcon },
};

interface TabIconProps {
  icons: { outline: React.FC<{ width?: number; height?: number; color?: string }>; active: React.FC<{ width?: number; height?: number; color?: string }> };
  label: string;
  focused: boolean;
}

/** 이미 활성화된 탭을 다시 누르면 그 탭의 첫 화면으로 되돌아가도록 신호를 보낸다. */
function resetOnRepeatPress(tabKey: string) {
  return ({ navigation }: { navigation: { isFocused: () => boolean } }) => ({
    tabPress: () => {
      if (navigation.isFocused()) {
        emitTabReset(tabKey);
      }
    },
  });
}

function TabIcon({ icons, label, focused }: TabIconProps) {
  const Icon = focused ? icons.active : icons.outline;
  return (
    <View style={styles.tabItem}>
      <Icon width={20} height={20} color={focused ? Colors.navActive : Colors.navInactive} />
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getAccessToken().then((token) => {
      if (!token) router.replace('/login');
    });
  }, []);

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
            <TabIcon icons={ICONS.home} label="홈" focused={focused} />
          ),
        }}
        listeners={resetOnRepeatPress('home')}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icons={ICONS.map} label="지도" focused={focused} />
          ),
        }}
        listeners={resetOnRepeatPress('map')}
      />
      <Tabs.Screen
        name="save"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icons={ICONS.save} label="저장" focused={focused} />
          ),
        }}
        listeners={resetOnRepeatPress('save')}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icons={ICONS.schedule} label="일정" focused={focused} />
          ),
        }}
        listeners={resetOnRepeatPress('schedule')}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icons={ICONS.mypage} label="마이" focused={focused} />
          ),
        }}
        listeners={resetOnRepeatPress('mypage')}
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
