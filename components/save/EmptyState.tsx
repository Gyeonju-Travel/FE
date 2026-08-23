import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import EmptyIllustration from '@/assets/save/empty-illustration.svg';

interface Props {
  onFindPlace: () => void;
}

export default function EmptyState({ onFindPlace }: Props) {
  return (
    <View style={styles.root}>
      {/* 일러스트 + 텍스트: 화면 중앙에 위치 */}
      <View style={styles.centerSection}>
        <EmptyIllustration width={241} height={127} style={styles.illustration} />
        <Text style={styles.title}>아직 저장한 장소가 없어요</Text>
        <Text style={styles.subtitle}>
          {'마음에 드는 장소를 저장하고\n나만의 경주 여행 리스트를 만들어보세요'}
        </Text>
      </View>

      {/* 하단: 팁박스 + 버튼 */}
      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.tipBox} activeOpacity={0.8}>
          <View style={styles.tipTitleRow}>
            <Image source={require('@/assets/save/empty-bell.png')} style={styles.tipBellIcon} resizeMode="contain" />
            <Text style={styles.tipTitle}>저장하는 방법</Text>
          </View>
          <Text style={styles.tipDesc}>
            지도에서 ♡ 모양을 눌러 저장하면 장소를 추가할 수 있어요!
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.findBtn}
          onPress={onFindPlace}
          activeOpacity={0.85}
        >
          <Text style={styles.findBtnText}>지도에서 장소 찾기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: Spacing.xl,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  illustration: {
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6B6260',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#A89E9C',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: -Spacing.sm,
  },
  bottomSection: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  tipBox: {
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: 6,
  },
  tipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipBellIcon: {
    width: 22,
    height: 23,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7F9E85',
  },
  tipDesc: {
    fontSize: 13,
    color: '#6B6260',
    lineHeight: 20,
    marginTop: -4,
  },
  findBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A3330',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  findBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
