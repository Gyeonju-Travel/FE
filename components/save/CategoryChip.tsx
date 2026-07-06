import React from 'react';
import { TouchableOpacity, Text, Image, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { PlaceCategory } from '@/types/save';

const CATEGORY_ICONS: Record<PlaceCategory, ReturnType<typeof require>> = {
  전체: require('@/assets/icons/pets.png'),
  관광지: require('@/assets/icons/tour-spot.png'),
  카페: require('@/assets/icons/hot-coffee.png'),
  식당: require('@/assets/icons/spoon-and-fork.png'),
};

interface Props {
  label: PlaceCategory;
  active: boolean;
  onPress: () => void;
}

export default function CategoryChip({ label, active, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
      activeOpacity={0.7}
    >
      <Image
        source={CATEGORY_ICONS[label]}
        style={[styles.icon, { tintColor: active ? Colors.white : Colors.textBody2 }]}
        resizeMode="contain"
      />
      <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 0,
    gap: 4,
    marginRight: Spacing.sm,
  },
  chipActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  chipInactive: {
    backgroundColor: Colors.bgWarm,
  },
  icon: {
    width: 14,
    height: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.white,
  },
  labelInactive: {
    color: Colors.textBody2,
  },
});
