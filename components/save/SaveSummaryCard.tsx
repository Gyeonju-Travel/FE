import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface Props {
  count: number;
}

export default function SaveSummaryCard({ count }: Props) {
  return (
    <View style={styles.card}>
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
    paddingVertical: Spacing.lg,
    height: 110,
    justifyContent: 'center',
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
    color: Colors.textBody1,
    lineHeight: 42,
  },
  unit: {
    fontSize: 16,
    color: Colors.textBody2,
    marginBottom: 6,
  },
});
