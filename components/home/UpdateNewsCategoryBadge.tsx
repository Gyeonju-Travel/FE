import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import { UpdateNewsCategory } from '@/constants/updateNews';

const CATEGORY_STYLES: Record<UpdateNewsCategory, { bg: string; text: string }> = {
  점검: { bg: '#FBF0DE', text: '#E8906A' },
  업데이트: { bg: Colors.secondaryTint, text: Colors.secondaryDark },
  안내: { bg: Colors.infoTint, text: Colors.infoDark },
};

export default function UpdateNewsCategoryBadge({ category }: { category: UpdateNewsCategory }) {
  const tone = CATEGORY_STYLES[category];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.text }]}>{category}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 59,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: { fontSize: 12, fontWeight: '600' },
});
