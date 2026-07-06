import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface Props {
  selectedCount: number;
  onDelete: () => void;
  isEditMode: boolean;
}

export default function BottomActionButton({ selectedCount, onDelete, isEditMode }: Props) {
  if (!isEditMode) return null;

  const isActive = selectedCount > 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={isActive ? onDelete : undefined}
        style={isActive ? styles.deleteBtnActive : styles.deleteBtnInactive}
        activeOpacity={isActive ? 0.85 : 1}
      >
        <Text style={isActive ? styles.deleteIconActive : styles.deleteIcon}>
          🗑
        </Text>
        <Text style={isActive ? styles.deleteBtnTextActive : styles.deleteBtnText}>
          {isActive ? `삭제하기 (${selectedCount})` : '삭제하기'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  // 공통 버튼 레이아웃
  deleteBtnBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    height: 52,
    gap: Spacing.sm,
    borderWidth: 0.3,
  },
  deleteBtnInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    height: 52,
    gap: Spacing.sm,
    borderWidth: 0.3,
    backgroundColor: Colors.bgWarm,
    borderColor: Colors.bgWarm,
  },
  deleteBtnActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    height: 52,
    gap: Spacing.sm,
    borderWidth: 0.3,
    backgroundColor: Colors.coralLight,
    borderColor: Colors.coral,
  },
  deleteIcon: {
    fontSize: 16,
    color: Colors.muted,
  },
  deleteIconActive: {
    fontSize: 16,
    color: Colors.coral,
  },
  deleteBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.muted,
  },
  deleteBtnTextActive: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.coral,
  },
});