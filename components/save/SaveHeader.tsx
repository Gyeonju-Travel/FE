import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

interface Props {
  isEditMode: boolean;
  selectedCount: number;
  onEditPress: () => void;
  onDeletePress: () => void;
  onBackPress: () => void;
  onSelectAll: () => void;
}

export default function SaveHeader({
  isEditMode,
  selectedCount,
  onEditPress,
  onDeletePress,
  onBackPress,
  onSelectAll,
}: Props) {
  if (!isEditMode) {
    return (
      <View style={styles.header}>
        <Text style={styles.title}>저장</Text>
        <TouchableOpacity onPress={onEditPress}>
          <Text style={styles.actionBtn}>편집</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.editContainer}>
      {/* 상단: ← 저장 / 삭제 */}
      <View style={styles.editTopRow}>
        <TouchableOpacity onPress={onBackPress} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.title}>저장</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDeletePress}>
          <Text style={styles.actionBtn}>삭제</Text>
        </TouchableOpacity>
      </View>

      {/* 전체선택 행 */}
      <View style={styles.selectAllRow}>
        <TouchableOpacity onPress={onSelectAll}>
          <Text style={styles.selectAllText}>전체선택</Text>
        </TouchableOpacity>
        <Text
          style={[
            styles.selectedCount,
            selectedCount > 0 && styles.selectedCountActive,
          ]}
        >
          {selectedCount}개 선택됨
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  editContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,   // 아래 칩과 간격 확보
  },
  editTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,    // 전체선택 행과 간격
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  backArrow: {
    fontSize: 18,
    color: Colors.textBody1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textBody1,
  },
  actionBtn: {
    fontSize: 15,
    color: Colors.textBody2,
    fontWeight: '500',
  },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgWarm,   // 전체선택 행은 따뜻한 베이지 유지
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  selectAllText: {
    fontSize: 14,
    color: Colors.sage,          // 세이지그린으로 변경
    fontWeight: '500',
  },
  selectedCount: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  selectedCountActive: {
    color: Colors.coral,
    fontWeight: '600',
  },
});
