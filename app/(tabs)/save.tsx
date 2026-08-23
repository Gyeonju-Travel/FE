import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { PlaceCategory, SavedPlace } from '@/types/save';
import { getBookmarks, deleteBookmarks, ApiError } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { toSavedPlace } from '@/utils/placeMappers';
import { onTabReset } from '@/utils/tabReset';

import SaveHeader from '@/components/save/SaveHeader';
import SaveSummaryCard from '@/components/save/SaveSummaryCard';
import CategoryChip from '@/components/save/CategoryChip';
import SavedPlaceCard from '@/components/save/SavedPlaceCard';
import EmptyState from '@/components/save/EmptyState';
import Toast from '@/components/ui/Toast';
import BinIcon from '@/assets/icons/bin.svg';

const CATEGORIES: PlaceCategory[] = ['전체', '관광지', '카페', '식당'];

export default function SaveScreen() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory>('전체');
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchBookmarks = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const result = await getBookmarks(undefined, token);
      setPlaces(result.map(toSavedPlace));
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '저장한 장소를 불러오지 못했어요.';
      setToastMsg(message);
    }
  }, []);

  // 저장 탭 아이콘을 다시 누르면 편집 모드를 빠져나와 첫 화면으로 되돌아간다.
  useEffect(
    () =>
      onTabReset('save', () => {
        setIsEditMode(false);
        setSelectedIds(new Set());
      }),
    []
  );

  useFocusEffect(
    useCallback(() => {
      fetchBookmarks();
    }, [fetchBookmarks])
  );

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
    if (isEditMode) {
      toggleSelect(id);
      return;
    }
    router.push({ pathname: '/(tabs)/map', params: { placeId: id } });
  };

  const handleFindPlace = () => {
    router.push('/(tabs)/map');
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredPlaces.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPlaces.map((p) => p.id)));
    }
  };

  const handleDelete = async () => {
    const token = await getAccessToken();
    if (!token) return;
    const ids = Array.from(selectedIds);
    try {
      await deleteBookmarks(ids.map(Number), token);
      setPlaces((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      setIsEditMode(false);
      setToastMsg(`${ids.length}개 삭제했어요.`);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '삭제에 실패했어요. 잠시 후 다시 시도해주세요.';
      setToastMsg(message);
    }
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
            onDeletePress={selectedIds.size > 0 ? handleDelete : () => {}}
            onBackPress={() => { setIsEditMode(false); setSelectedIds(new Set()); }}
            onSelectAll={handleSelectAll}
          />
        )}

        {/* 콘텐츠 */}
        {isEmpty ? (
          /* flex: 1로 남은 공간 모두 사용 */
          <View style={styles.emptyContent}>
            <EmptyState onFindPlace={handleFindPlace} />
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
                <BinIcon width={18} height={18} color={selectedIds.size > 0 ? Colors.coral : Colors.textMuted} />
                <Text style={selectedIds.size > 0 ? styles.deleteBtnTextActive : styles.deleteBtnText}>
                  {selectedIds.size > 0 ? `삭제하기 (${selectedIds.size})` : '삭제하기'}
                </Text>
              </TouchableOpacity>
            ) : (
              /* + 장소 추가하기 버튼 */
              <TouchableOpacity style={styles.addBtn} activeOpacity={0.75} onPress={handleFindPlace}>
                <Text style={styles.addBtnText}>+ 장소 추가하기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <Toast message={toastMsg} onHide={() => setToastMsg(null)} />
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
