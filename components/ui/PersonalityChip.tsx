import React from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

/** 반려견 성격 조합 라벨 칩. 홈/마이페이지 등 어디서든 같은 모양으로 보이도록 한곳에서 관리한다. */
export default function PersonalityChip({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.chip, style]}>
      <Image source={require('@/assets/mypage/personality-tag-icon.png')} style={s.icon} resizeMode="contain" />
      <Text style={s.text}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    height: 25,
    backgroundColor: Colors.secondaryTint,
    borderWidth: 0.5,
    borderColor: '#C0DDD0',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
  },
  icon: { width: 10, height: 14 },
  text: { fontSize: 12, fontWeight: '600', color: Colors.secondaryDark },
});
