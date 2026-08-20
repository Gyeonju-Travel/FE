import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { SavedPlace } from '@/types/save';
import Badge, { BADGE_TONE_COLORS } from '@/components/ui/Badge';
import { PLACE_TAG_STYLE, DEFAULT_PLACE_TAG_STYLE, CATEGORY_BADGE_STYLE } from '@/constants/badgeConfig';
import PlaceThumbnail from '@/components/ui/PlaceThumbnail';

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
        {isEditMode && (
          <TouchableOpacity
            onPress={onCheckboxPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        )}


      <PlaceThumbnail uri={place.imageUri} style={styles.image} />

      <View style={styles.info}>
        {(() => {
          const cat = CATEGORY_BADGE_STYLE[place.category];
          return (
            <Badge
              label={place.category}
              variant="filled"
              tone={cat?.tone}
              leading={
                cat && <cat.Icon width={15} height={15} color={BADGE_TONE_COLORS[cat.tone].text} />
              }
            />
          );
        })()}

        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>

        <View style={styles.tags}>
          {place.tags.map((tag) => {
            const cfg = PLACE_TAG_STYLE[tag] ?? DEFAULT_PLACE_TAG_STYLE;
            return (
              <Badge
                key={tag}
                label={tag}
                variant="outline"
                tone={cfg.tone}
                dot={cfg.dot}
                leading={
                  cfg.Icon ? (
                    <cfg.Icon width={15} height={15} color={BADGE_TONE_COLORS[cfg.tone].text} />
                  ) : undefined
                }
              />
            );
          })}
        </View>
      </View>

    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',

    // 카드 기본 높이 113px — 태그가 많아서 줄바꿈되면(예: 월정교) 카드가 그만큼 늘어나야 하므로
    // height가 아니라 minHeight로 둔다.
    minHeight: 113,

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
    marginLeft: 6,
    marginRight: 8,
  },
  info: {
    flex: 1,
    gap: 5,
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

});