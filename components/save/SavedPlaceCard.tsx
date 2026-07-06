import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { SavedPlace } from '@/types/save';

const CATEGORY_ICONS: Record<string, string> = {
  관광지: '🏛',
  카페: '☕',
  식당: '🍴',
};

const TAG_BG: Record<string, string> = {
  '전 구역': Colors.secondaryTint,
  '야외만': Colors.secondaryTint,
  '이동장 필수': Colors.primaryTint,
  '목줄 필수': Colors.primaryTint,
};

const TAG_DOT: Record<string, string> = {
  '전 구역': Colors.sage,
  '야외만': Colors.sage,
  '이동장 필수': Colors.coral,
  '목줄 필수': Colors.coral,
};

interface Props {
  place: SavedPlace;
  isEditMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onCheckboxPress: () => void;
}

export default function SavedPlaceCard({
  place,
  isEditMode,
  isSelected,
  onPress,
  onCheckboxPress,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, isSelected && styles.cardSelected]}
    >
        <TouchableOpacity
          onPress={onCheckboxPress}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
      

      <Image source={{ uri: place.imageUri }} style={styles.image} resizeMode="cover" />

      <View style={styles.info}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryIcon}>{CATEGORY_ICONS[place.category]}</Text>
          <Text style={styles.categoryText}>{place.category}</Text>
        </View>

        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>

        <View style={styles.tags}>
          {place.tags.map((tag) => (
            <View
              key={tag}
              style={[styles.tagBox, { backgroundColor: TAG_BG[tag] ?? Colors.secondaryTint }]}
            >
              <View style={[styles.tagDot, { backgroundColor: TAG_DOT[tag] ?? Colors.sage }]} />
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',

    // 카드 높이 113px
    height: 113,

    // 화면 배경색과 동일하게
    backgroundColor: Colors.background,

    borderWidth: 0.5,
    borderColor: '#EDE8E3',
    borderRadius: Radius.md,

    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,

    paddingHorizontal: Spacing.md,
    paddingVertical: 14,

    gap: Spacing.md,

    shadowColor: '#3A3330',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  cardSelected: {
    backgroundColor: Colors.primaryTint,
    borderColor: Colors.primaryBorder,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    flexShrink: 0,
  },

  checkboxSelected: {
    backgroundColor: Colors.checkboxActive,
    borderColor: Colors.checkboxActive,
  },

  checkmark: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },

  image: {
    width: 72,
    height: 72,
    borderRadius: Radius.sm,
  },

  info: {
    flex: 1,
    gap: 5,
  },

  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryTint,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 3,
  },

  categoryIcon: {
    fontSize: 10,
  },

  categoryText: {
    fontSize: 10,
    color: Colors.coral,
    fontWeight: '500',
  },

  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textBody1,
  },

  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  tagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  tagText: {
    fontSize: 11,
    color: Colors.textBody2,
  },

});