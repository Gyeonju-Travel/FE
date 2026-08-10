import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import SummaryVillage from '@/assets/save/summary-village.svg';

interface Props {
  count: number;
}

// 카드 너비보다 살짝 크게 그려서 카드 하단에 걸치듯 배치한다. 위쪽 절반은 텍스트를 위해
// 비워두고, 삽화 아래쪽은 카드 밖으로 넘어가 잘리는 걸 감수하고 더 아래로 내린다.
const CARD_WIDTH = Dimensions.get('window').width - Spacing.xl * 2;
const ILLUSTRATION_SCALE = 1.15;
const ILLUSTRATION_WIDTH = CARD_WIDTH * ILLUSTRATION_SCALE;
const ILLUSTRATION_HEIGHT = ILLUSTRATION_WIDTH * (1013 / 4592);
const ILLUSTRATION_LEFT = -(ILLUSTRATION_WIDTH - CARD_WIDTH) / 2;

export default function SaveSummaryCard({ count }: Props) {
  return (
    <View style={styles.card}>
      <SummaryVillage
        width={ILLUSTRATION_WIDTH}
        height={ILLUSTRATION_HEIGHT}
        style={[styles.illustration, { left: ILLUSTRATION_LEFT, bottom: -16 }]}
      />
      <Text style={styles.label}>저장한 장소</Text>
      <View style={styles.countRow}>
        <Text style={styles.count}>{count}</Text>
        <Text style={styles.unit}>곳</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgWarm,   // 배경과 구분되도록 따뜻한 베이지 유지
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    height: 160,
    overflow: 'hidden',
  },
  illustration: {
    position: 'absolute',
  },
  label: {
    fontSize: 13,
    color: Colors.textBody2,
    marginBottom: 4,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  count: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.secondary,
    lineHeight: 42,
  },
  unit: {
    fontSize: 16,
    color: Colors.textBody2,
    marginBottom: 6,
  },
});
