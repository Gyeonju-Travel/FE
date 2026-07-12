import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

export type BadgeVariant = 'outline' | 'filled' | 'best';
export type BadgeTone = 'sage' | 'coral' | 'neutral';

const BADGE_HEIGHT = 22;

const TONE_COLORS: Record<BadgeTone, { text: string; border: string }> = {
  sage: { text: '#637665', border: '#94A895' },
  coral: { text: Colors.primary, border: '#E0A182' },
  neutral: { text: '#696260', border: '#B1AAA7' },
};

const FILLED_BG: Record<BadgeTone, string> = {
  coral: Colors.primaryTint,
  sage: Colors.tagBg,
  neutral: Colors.tagBg,
};

export const BADGE_TONE_COLORS = TONE_COLORS;

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  tone?: BadgeTone;
  /** Small colored bullet before the label (used by seat/area tags). */
  dot?: boolean;
  /** Custom leading element (icon Image) before the label. Ignored when `dot` is true. */
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function Badge({ label, variant = 'outline', tone = 'neutral', dot, leading, style }: BadgeProps) {
  const isFilled = variant === 'filled';
  const isBest = variant === 'best';
  const colors = isBest ? TONE_COLORS.coral : TONE_COLORS[tone];
  const bg = isBest ? Colors.white : isFilled ? FILLED_BG[tone] : Colors.bg;
  const showStar = isBest && !dot && !leading;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderColor: colors.border,
          borderWidth: isFilled ? 0 : 1,
        },
        style,
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: colors.text }]} />}
      {!dot && leading}
      {showStar && <Text style={[styles.star, { color: colors.text }]}>★</Text>}
      <Text
        style={[styles.label, { color: colors.text, fontWeight: isBest ? '700' : '500' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: BADGE_HEIGHT,
    borderRadius: 8,
    paddingHorizontal: 10,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  star: {
    fontSize: 12,
    lineHeight: 15,
  },
  label: {
    fontSize: 12,
    lineHeight: 15,
  },
});
