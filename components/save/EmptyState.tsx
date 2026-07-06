import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface Props {
  onFindPlace: () => void;
}

export default function EmptyState({ onFindPlace }: Props) {
  return (
    <View style={styles.root}>
      {/* 일러스트 + 텍스트: 화면 중앙에 위치 */}
      <View style={styles.centerSection}>
        <Image
          source={{ uri: 'https://picsum.photos/seed/cheomseongdae/360/280' }}
          style={styles.illustration}
          resizeMode="contain"
        />
        <Text style={styles.title}>아직 저장한 장소가 없어요</Text>
        <Text style={styles.subtitle}>
          {'마음에 드는 장소를 저장하고\n나만의 경주 여행 리스트를 만들어보세요'}
        </Text>
      </View>

      {/* 하단: 팁박스 + 버튼 */}
      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.tipBox} activeOpacity={0.8}>
          <Text style={styles.tipTitle}>🔔 저장하는 방법 &gt;</Text>
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
    width: '90%',
    height: 220,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textBody1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textBody2,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomSection: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  tipBox: {
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: 6,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textBody1,
  },
  tipDesc: {
    fontSize: 13,
    color: Colors.textBody2,
    lineHeight: 20,
  },
  findBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
