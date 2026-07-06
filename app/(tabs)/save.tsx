import React, { useState, useMemo } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { PlaceCategory, SavedPlace } from '@/types/save';
import { MOCK_SAVED_PLACES } from '@/mock/savedPlaces';

import SaveHeader from '@/components/save/SaveHeader';
import SaveSummaryCard from '@/components/save/SaveSummaryCard';
import CategoryChip from '@/components/save/CategoryChip';
import SavedPlaceCard from '@/components/save/SavedPlaceCard';
import EmptyState from '@/components/save/EmptyState';

const CATEGORIES: PlaceCategory[] = ['전체', '관광지', '카페', '식당'];

export default function SaveScreen() {
  const [places, setPlaces] = useState<SavedPlace[]>(MOCK_SAVED_PLACES);
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory>('전체');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredPlaces = useMemo(() => {
    if (selectedCategory === '전체') return places;
    return places.filter((p) => p.category === selectedCategory);
  }, [places, selectedCategory]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCardPress = (id: string) => {
    if (!isEditMode) return;
    toggleSelect(id);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredPlaces.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPlaces.map((p) => p.id)));
    }
  };

  const handleDelete = () => {
    setPlaces((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setIsEditMode(false);
  };

  const isEmpty = places.length === 0;

  const ListHeader = (
    <>
      {!isEditMode && <SaveSummaryCard count={places.length} />}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat}
            label={cat}
            active={selectedCategory === cat}
            onPress={() => setSelectedCategory(cat)}
          />
        ))}
      </ScrollView>
      {!isEditMode && (
        <TouchableOpacity style={styles.sortRow} activeOpacity={0.7}>
          <Text style={styles.sortText}>최신순 ∨</Text>
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* 헤더 */}
        {isEmpty ? (
          <View style={styles.emptyHeaderBar}>
            <Text style={styles.pageTitle}>저장</Text>
          </View>
        ) : (
          <SaveHeader
            isEditMode={isEditMode}
            selectedCount={selectedIds.size}
            onEditPress={() => { setIsEditMode(true); setSelectedIds(new Set()); }}
            onDeletePress={() => {}}
            onBackPress={() => { setIsEditMode(false); setSelectedIds(new Set()); }}
            onSelectAll={handleSelectAll}
          />
        )}

        {/* 콘텐츠 */}
        {isEmpty ? (
          /* flex: 1로 남은 공간 모두 사용 */
          <View style={styles.emptyContent}>
            <EmptyState onFindPlace={() => {}} />
          </View>
        ) : (
          <FlatList
            data={filteredPlaces}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={ListHeader}
            renderItem={({ item }) => (
              <SavedPlaceCard
                place={item}
                isEditMode={isEditMode}
                isSelected={selectedIds.has(item.id)}
                onPress={() => handleCardPress(item.id)}
                onCheckboxPress={() => toggleSelect(item.id)}
              />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* 하단 고정 버튼 */}
        {!isEmpty && (
          <View style={styles.bottomBar}>
            {isEditMode ? (
              /* 삭제하기 버튼 */
              <TouchableOpacity
                onPress={selectedIds.size > 0 ? handleDelete : undefined}
                activeOpacity={selectedIds.size > 0 ? 0.85 : 1}
                style={selectedIds.size > 0 ? styles.deleteBtnActive : styles.deleteBtn}
              >
                <Image
                  source={require('@/assets/icons/bin.png')}
                  style={[styles.binIcon, { tintColor: selectedIds.size > 0 ? Colors.coral : Colors.textMuted }]}
                  resizeMode="contain"
                />
                <Text style={selectedIds.size > 0 ? styles.deleteBtnTextActive : styles.deleteBtnText}>
                  {selectedIds.size > 0 ? `삭제하기 (${selectedIds.size})` : '삭제하기'}
                </Text>
              </TouchableOpacity>
            ) : (
              /* + 장소 추가하기 버튼 */
              <TouchableOpacity style={styles.addBtn} activeOpacity={0.75}>
                <Text style={styles.addBtnText}>+ 장소 추가하기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  emptyHeaderBar: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  chips: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.md,
  },
  sortRow: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  sortText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  list: {
    paddingBottom: Spacing.sm,
  },
  emptyContent: {
    flex: 1,
  },
  // 하단 고정 버튼 공통
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  // + 장소 추가하기 — 배경: #FFFBF6, 테두리: 연한 그레이
  addBtn: {
    borderWidth: 0.5,
    borderColor: Colors.coral,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.coral,
  },
  // 삭제하기 비활성 — 독립 객체
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F0E8',
    borderRadius: 16,
    height: 52,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#F4F0E8',
  },
  // 삭제하기 활성 — 독립 객체 (배경 #FFFBF6, 얇은 코랄 테두리)
  deleteBtnActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    borderRadius: 16,
    height: 52,
    gap: Spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.coral,
  },
  binIcon: {
    width: 18,
    height: 18,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  deleteBtnTextActive: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.coral,
  },
});
