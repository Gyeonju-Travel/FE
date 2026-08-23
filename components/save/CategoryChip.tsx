import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { PlaceCategory } from '@/types/save';
import FilterAllIcon from '@/assets/icons/filter-all.svg';
import FilterTourIcon from '@/assets/icons/filter-tour.svg';
import FilterCafeIcon from '@/assets/icons/filter-cafe.svg';
import FilterFoodIcon from '@/assets/icons/filter-food.svg';

const CATEGORY_ICONS: Record<PlaceCategory, React.FC<{ width?: number; height?: number; color?: string }>> = {
  전체: FilterAllIcon,
  관광지: FilterTourIcon,
  카페: FilterCafeIcon,
  식당: FilterFoodIcon,
};

interface Props {
  label: PlaceCategory;
  active: boolean;
  onPress: () => void;
}

export default function CategoryChip({ label, active, onPress }: Props) {
  const Icon = CATEGORY_ICONS[label];
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
      activeOpacity={0.7}
    >
      <Icon width={14} height={14} color={active ? Colors.white : '#6B6260'} />
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
    justifyContent: 'center',
    width: 68,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 0,
    gap: 4,
    marginRight: Spacing.sm,
  },
  chipActive: {
    backgroundColor: Colors.coral,
    borderColor: Colors.coral,
  },
  chipInactive: {
    backgroundColor: '#F4F0E8',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.white,
  },
  labelInactive: {
    color: '#6B6260',
  },
});
