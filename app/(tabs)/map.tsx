import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Animated,
  Easing,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { CATEGORY_BADGE_STYLE } from '@/constants/badgeConfig';
import { MapPlace } from '@/types/map';
import { searchPlaces, getPlaceDetail, getBookmarks, saveBookmark, deleteBookmarks, PlaceCategoryCode, ApiError } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { onTabReset } from '@/utils/tabReset';
import { toMapPlace, toMapPlaceDetail } from '@/utils/placeMappers';
import { getRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } from '@/utils/recentSearches';
import KakaoMap, { KakaoMapHandle } from '@/components/map/KakaoMap';
import MapPlaceSheet, { SHEET_HEIGHT } from '@/components/map/MapPlaceSheet';
import Toast from '@/components/ui/Toast';
import Badge, { BADGE_TONE_COLORS } from '@/components/ui/Badge';
import PlaceThumbnail from '@/components/ui/PlaceThumbnail';
import PlaceBlankIllustration from '@/assets/place/place-blank.svg';
import FilterAllIcon from '@/assets/icons/filter-all.svg';
import FilterTourIcon from '@/assets/icons/filter-tour.svg';
import FilterCafeIcon from '@/assets/icons/filter-cafe.svg';
import FilterFoodIcon from '@/assets/icons/filter-food.svg';
import FilterSavedIcon from '@/assets/icons/tab-save-active.svg';
import MapMyLocationIcon from '@/assets/icons/map-mylocation.svg';
import RecentSearchIcon from '@/assets/icons/schedule-time.svg';
import ToastPlaceSavedIcon from '@/assets/icons/toast/place-saved.svg';

const LOCATION_BTN_BOTTOM = 24;
const MAX_VISIBLE_RECENT_SEARCHES = 6;
const SHEET_GAP = 12;
const LOCATION_BTN_RAISE = SHEET_HEIGHT + SHEET_GAP - LOCATION_BTN_BOTTOM;

const SAVED_FILTER = '내 저장' as const;
type Category = '전체' | '관광지' | '카페' | '식당' | typeof SAVED_FILTER;
type SearchCategory = Exclude<Category, '전체'>;

const CATEGORIES: { label: Category; Icon: React.FC<{ width?: number; height?: number; color?: string }> }[] = [
  { label: '전체', Icon: FilterAllIcon },
  { label: '관광지', Icon: FilterTourIcon },
  { label: '카페', Icon: FilterCafeIcon },
  { label: '식당', Icon: FilterFoodIcon },
  { label: SAVED_FILTER, Icon: FilterSavedIcon },
];

// 검색화면 카테고리 버튼은 '내 저장'을 맨 앞에 두는 순서로 보여준다.
const SEARCH_CATEGORIES: { label: SearchCategory; Icon: React.FC<{ width?: number; height?: number; color?: string }> }[] = [
  { label: SAVED_FILTER, Icon: FilterSavedIcon },
  { label: '관광지', Icon: FilterTourIcon },
  { label: '카페', Icon: FilterCafeIcon },
  { label: '식당', Icon: FilterFoodIcon },
];

const CATEGORY_CODE: Record<Exclude<Category, '전체' | typeof SAVED_FILTER>, PlaceCategoryCode> = {
  관광지: 'ATTRACTION',
  카페: 'CAFE',
  식당: 'RESTAURANT',
};

const NEUTRAL_ICON_DARK = '#7C6F63';

const SEARCH_CATEGORY_STYLE: Record<SearchCategory, { iconColor: string }> = {
  [SAVED_FILTER]: { iconColor: Colors.primary },
  관광지: { iconColor: NEUTRAL_ICON_DARK },
  카페: { iconColor: NEUTRAL_ICON_DARK },
  식당: { iconColor: NEUTRAL_ICON_DARK },
};

/** 검색화면(추천 목적지/최근 검색/카테고리 목록)에서 공통으로 쓰는 장소 카드. */
function PlaceRow({ place, best, onPress }: { place: MapPlace; best?: boolean; onPress: () => void }) {
  const badgeStyle = CATEGORY_BADGE_STYLE[place.category];
  const CategoryIcon = badgeStyle?.Icon;
  return (
    <TouchableOpacity style={ss.placeCard} activeOpacity={0.85} onPress={onPress}>
      <PlaceThumbnail uri={place.imageUri} style={ss.placeThumb} />
      <View style={ss.placeInfo}>
        <View style={ss.placeBadgeRow}>
          {best && <Badge label="BEST" variant="best" />}
          {badgeStyle && (
            <Badge
              label={place.category}
              variant="outline"
              tone={badgeStyle.tone}
              leading={CategoryIcon ? <CategoryIcon width={13} height={13} color={BADGE_TONE_COLORS[badgeStyle.tone].text} /> : undefined}
            />
          )}
        </View>
        <Text style={ss.placeName} numberOfLines={1}>
          {place.name}
        </Text>
      </View>
      <Text style={ss.placeChevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { placeId, focusLat, focusLng, focusLabel } = useLocalSearchParams<{
    placeId?: string;
    focusLat?: string;
    focusLng?: string;
    focusLabel?: string;
  }>();
  const mapRef = useRef<KakaoMapHandle>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>('전체');
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<MapPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [likedPlaceIds, setLikedPlaceIds] = useState<string[]>([]);
  const locationBtnY = useRef(new Animated.Value(0)).current;

  // 지도 검색 화면 (전체 화면 오버레이) 관련 상태
  const [searchFocused, setSearchFocused] = useState(false);
  // 검색 오버레이가 떠있는 동안엔 KakaoMap 자체가 안 그려져서(mapRef.current === null),
  // 검색 결과를 누른 시점엔 바로 moveTo를 호출해도 씹힌다. 오버레이를 닫아서 지도가 다시
  // 마운트된 뒤에 옮기도록 좌표를 대기시켜둔다.
  const [pendingMapMove, setPendingMapMove] = useState<{ lat: number; lng: number } | null>(null);
  const [searchCategory, setSearchCategory] = useState<SearchCategory | null>(null);
  const [categoryResults, setCategoryResults] = useState<MapPlace[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [recommendedPlaces, setRecommendedPlaces] = useState<MapPlace[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const fetchMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setToastMsg('위치 접근 권한이 필요해요.');
      return null;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMyLocation(loc);
      return loc;
    } catch (e) {
      setToastMsg('현재 위치를 가져오지 못했어요.');
      return null;
    }
  };

  useEffect(() => {
    fetchMyLocation();
  }, []);

  const handleLocationPress = async () => {
    const loc = await fetchMyLocation();
    if (!loc) return;
    mapRef.current?.moveTo(loc.lat, loc.lng);
    mapRef.current?.updateMyLocation(loc.lat, loc.lng);
  };

  const fetchPlaces = async (category: Category) => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const result = await searchPlaces(
        {
          categories: category === '전체' || category === SAVED_FILTER ? undefined : [CATEGORY_CODE[category]],
          size: 200,
        },
        token
      );
      setPlaces(result.places.map(toMapPlace));
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '장소 정보를 불러오지 못했어요.';
      setToastMsg(message);
    }
  };

  useEffect(() => {
    fetchPlaces(selectedCategory);
  }, [selectedCategory]);

  const fetchLikedPlaceIds = async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const bookmarks = await getBookmarks(undefined, token);
      setLikedPlaceIds(bookmarks.map((b) => String(b.id)));
    } catch (e) {
      // 저장 목록을 못 불러와도 지도 자체는 그대로 보여준다.
    }
  };

  // 홈 화면과 동일한 추천 목적지(관광지 6곳)를 검색화면에서도 그대로 보여준다.
  const fetchRecommendedPlaces = async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const result = await searchPlaces({ categories: ['ATTRACTION'], size: 6 }, token);
      setRecommendedPlaces(result.places.map(toMapPlace));
    } catch (e) {
      // 추천 목적지 로드 실패는 조용히 무시 — 검색화면 자체는 그대로 쓸 수 있음
    }
  };

  useEffect(() => {
    fetchRecommendedPlaces();
    getRecentSearches().then(setRecentSearches);
  }, []);

  const openPlaceDetail = async (place: MapPlace) => {
    setSelectedPlace(place);
    const token = await getAccessToken();
    if (!token) return;
    try {
      const detail = await getPlaceDetail(Number(place.id), token);
      setSelectedPlace((prev) => (prev?.id === place.id ? toMapPlaceDetail(detail) : prev));
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '장소 상세 정보를 불러오지 못했어요.';
      setToastMsg(message);
    }
  };

  const handleMarkerPress = (id: string) => {
    const place = places.find((p) => p.id === id) ?? searchResults.find((p) => p.id === id);
    if (place) openPlaceDetail(place);
  };

  // 저장 탭에서 특정 장소를 눌러 넘어온 경우, 그 장소로 이동하고 상세 바텀시트를 연다.
  useEffect(() => {
    if (!placeId) return;
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const detail = await getPlaceDetail(Number(placeId), token);
        const place = toMapPlaceDetail(detail);
        setSelectedPlace(place);
        mapRef.current?.moveTo(place.latitude, place.longitude);
      } catch (e) {
        const message = e instanceof ApiError ? e.message : '장소 정보를 불러오지 못했어요.';
        setToastMsg(message);
      }
    })();
  }, [placeId]);

  // 특정 장소가 아니라 좌표(예: 황리단길처럼 단일 장소가 아닌 지역)로 넘어온 경우,
  // 상세 바텀시트 없이 지도만 그 위치로 이동한다.
  useEffect(() => {
    if (!focusLat || !focusLng) return;
    const lat = Number(focusLat);
    const lng = Number(focusLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    mapRef.current?.moveTo(lat, lng);
    if (focusLabel) setToastMsg(`${focusLabel} 근처로 이동했어요.`);
  }, [focusLat, focusLng, focusLabel]);

  // KakaoMap은 WebView라 ref가 붙어도 내부 카카오맵(window.kakaoMap)이 아직 안 만들어졌으면
  // moveTo가 조용히 무시된다. 검색 오버레이를 닫을 때마다 WebView가 통째로 리로드되므로,
  // 진짜로 지도 초기화가 끝났다는 신호(onMapReady)를 받은 뒤에야 대기 중인 이동을 실행한다.
  const handleMapReady = () => {
    if (pendingMapMove) {
      mapRef.current?.moveTo(pendingMapMove.lat, pendingMapMove.lng);
      setPendingMapMove(null);
    }
  };

  const performSearch = async (kw: string) => {
    const token = await getAccessToken();
    if (!token) return;
    setSearching(true);
    try {
      const categories =
        searchCategory && searchCategory !== SAVED_FILTER ? [CATEGORY_CODE[searchCategory]] : undefined;
      const result = await searchPlaces({ keyword: kw, categories, size: 30 }, token);
      setSearchResults(result.places.map(toMapPlace));
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '검색에 실패했어요.';
      setToastMsg(message);
    } finally {
      setSearching(false);
    }
  };

  // 타이핑할 때마다 자동으로 검색 (300ms 디바운스). '내 저장' 카테고리를 보고 있을 땐
  // 이미 불러온 저장 목록(categoryResults)을 이름으로 걸러서 보여준다 (별도 API 없음).
  useEffect(() => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    if (searchCategory === SAVED_FILTER) {
      setSearching(false);
      setSearchResults(categoryResults.filter((p) => p.name.includes(trimmed)));
      return;
    }
    const timer = setTimeout(() => {
      performSearch(trimmed);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, searchCategory, categoryResults]);

  const handleSearchSubmit = () => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    performSearch(trimmed);
    addRecentSearch(trimmed).then(setRecentSearches);
  };

  const handleClearSearch = () => {
    setKeyword('');
    setSearchResults([]);
  };

  const handleSearchResultPress = (place: MapPlace) => {
    addRecentSearch(place.name).then(setRecentSearches);
    setSearchFocused(false);
    setSearchCategory(null);
    setKeyword('');
    setSearchResults([]);
    Keyboard.dismiss();
    setPendingMapMove({ lat: place.latitude, lng: place.longitude });
    openPlaceDetail(place);
  };

  const fetchCategoryResults = async (category: SearchCategory) => {
    setCategoryLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setCategoryResults([]);
        return;
      }
      if (category === SAVED_FILTER) {
        const bookmarks = await getBookmarks(undefined, token);
        setCategoryResults(bookmarks.map(toMapPlace));
      } else {
        const result = await searchPlaces({ categories: [CATEGORY_CODE[category]], size: 50 }, token);
        setCategoryResults(result.places.map(toMapPlace));
      }
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '장소 목록을 불러오지 못했어요.';
      setToastMsg(message);
      setCategoryResults([]);
    } finally {
      setCategoryLoading(false);
    }
  };

  // 저장 화면(save.tsx)에서 삭제하고 돌아와도 하트 표시(likedPlaceIds)와 "내 저장" 탭 목록이
  // 화면을 나가기 전 상태 그대로 남아있어 반영이 안 된다. 화면에 포커스될 때마다 다시 불러온다.
  useFocusEffect(
    useCallback(() => {
      fetchLikedPlaceIds();
      if (searchCategory === SAVED_FILTER) {
        fetchCategoryResults(SAVED_FILTER);
      }
    }, [searchCategory])
  );

  const handleSelectSearchCategory = (category: SearchCategory) => {
    setSearchCategory(category);
    setKeyword('');
    setSearchResults([]);
    fetchCategoryResults(category);
  };

  const handleRecentSearchPress = (term: string) => {
    setSearchCategory(null);
    setKeyword(term);
  };

  const handleRemoveRecentSearch = async (term: string) => {
    const next = await removeRecentSearch(term);
    setRecentSearches(next);
  };

  const handleClearAllRecent = async () => {
    await clearRecentSearches();
    setRecentSearches([]);
  };

  const exitSearchMode = () => {
    setSearchFocused(false);
    setSearchCategory(null);
    setKeyword('');
    setSearchResults([]);
    Keyboard.dismiss();
  };

  const handleGoReportPlace = () => {
    exitSearchMode();
    router.push({ pathname: '/(tabs)/mypage', params: { openReportPlace: '1' } });
  };

  const handleToggleLike = async (place: MapPlace, liked: boolean) => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      if (liked) {
        await saveBookmark(Number(place.id), token);
        setLikedPlaceIds((prev) => (prev.includes(place.id) ? prev : [...prev, place.id]));
        setToastMsg('장소가 저장됐어요!');
      } else {
        await deleteBookmarks([Number(place.id)], token);
        setLikedPlaceIds((prev) => prev.filter((id) => id !== place.id));
        setToastMsg('저장을 취소했어요.');
      }
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '요청에 실패했어요. 잠시 후 다시 시도해주세요.';
      setToastMsg(message);
    }
  };

  const handleMapPress = () => {
    setSelectedPlace(null);
  };

  // 지도 탭 아이콘을 다시 누르면 첫 화면(장소 상세/검색 닫힌 상태)으로 되돌아간다.
  useEffect(
    () =>
      onTabReset('map', () => {
        setSelectedPlace(null);
        exitSearchMode();
      }),
    []
  );

  // 내 위치 버튼을 바텀시트가 뜨고 닫히는 것과 같은 타이밍으로 함께 움직임
  useEffect(() => {
    Animated.timing(locationBtnY, {
      toValue: selectedPlace ? -LOCATION_BTN_RAISE : 0,
      duration: selectedPlace ? 260 : 220,
      easing: selectedPlace ? Easing.out(Easing.cubic) : Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [selectedPlace]);

  const visiblePlaces =
    selectedCategory === SAVED_FILTER
      ? places.filter((p) => likedPlaceIds.includes(p.id))
      : places;

  const showKeywordResults = keyword.trim().length > 0;

  // ─── 지도 검색 화면 (전체 화면 오버레이) ─────────────────────────────────────
  if (searchFocused) {
    return (
      <View style={[ss.container, { paddingTop: insets.top + 12 }]}>
        <View style={ss.searchBarRow}>
          <View style={[styles.searchBar, ss.searchBarFlex]}>
            <Image source={require('@/assets/icons/search.png')} style={styles.searchIcon} resizeMode="contain" />
            <TextInput
              style={styles.searchInput}
              placeholder="어디로 떠날까요?"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="search"
              autoFocus
              value={keyword}
              onChangeText={setKeyword}
              onSubmitEditing={handleSearchSubmit}
            />
            {keyword.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.searchClear}>×</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={exitSearchMode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={ss.cancelText}>취소</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={ss.scrollContent}
        >
          {showKeywordResults ? (
            searching ? (
              <Text style={ss.emptyText}>검색 중...</Text>
            ) : searchResults.length === 0 ? (
              <View style={ss.emptyState}>
                <PlaceBlankIllustration width={140} height={116} />
                <Text style={ss.emptyText}>검색 결과가 없어요.</Text>
              </View>
            ) : (
              searchResults.map((place) => (
                <PlaceRow key={place.id} place={place} onPress={() => handleSearchResultPress(place)} />
              ))
            )
          ) : searchCategory ? (
            <>
              <TouchableOpacity
                style={ss.backRow}
                activeOpacity={0.7}
                onPress={() => setSearchCategory(null)}
              >
                <Text style={ss.backArrow}>←</Text>
                <Text style={ss.sectionTitle}>{searchCategory}</Text>
              </TouchableOpacity>
              {categoryLoading ? (
                <Text style={ss.emptyText}>불러오는 중...</Text>
              ) : categoryResults.length === 0 ? (
                <Text style={ss.emptyText}>
                  {searchCategory === SAVED_FILTER ? '저장한 장소가 없어요.' : '표시할 장소가 없어요.'}
                </Text>
              ) : (
                categoryResults.map((place) => (
                  <PlaceRow key={place.id} place={place} onPress={() => handleSearchResultPress(place)} />
                ))
              )}
            </>
          ) : (
            <>
              <View style={ss.categoryGrid}>
                {SEARCH_CATEGORIES.map(({ label, Icon }) => {
                  const style = SEARCH_CATEGORY_STYLE[label];
                  return (
                    <TouchableOpacity
                      key={label}
                      style={ss.categoryBtn}
                      activeOpacity={0.8}
                      onPress={() => handleSelectSearchCategory(label)}
                    >
                      <View style={ss.categoryIconBox}>
                        <Icon width={28} height={28} color={style.iconColor} />
                      </View>
                      <Text style={ss.categoryBtnLabel}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={ss.sectionHeaderRow}>
                <Text style={ss.sectionTitle}>최근 검색</Text>
                {recentSearches.length > 0 && (
                  <TouchableOpacity onPress={handleClearAllRecent} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={ss.clearAllText}>전체 삭제</Text>
                  </TouchableOpacity>
                )}
              </View>
              {recentSearches.length === 0 ? (
                <Text style={ss.emptyText}>최근 검색 내역이 없어요.</Text>
              ) : (
                <View style={ss.recentGrid}>
                  {recentSearches.slice(0, MAX_VISIBLE_RECENT_SEARCHES).map((term) => (
                    <View key={term} style={ss.recentChip}>
                      <TouchableOpacity
                        style={ss.recentChipMain}
                        activeOpacity={0.7}
                        onPress={() => handleRecentSearchPress(term)}
                      >
                        <RecentSearchIcon width={14} height={14} color={Colors.textMuted} />
                        <Text style={ss.recentChipText} numberOfLines={1}>
                          {term}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveRecentSearch(term)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={ss.recentChipRemove}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={ss.divider} />

              <Text style={ss.sectionTitle}>추천 목적지</Text>
              <View style={{ marginTop: 14 }}>
                {recommendedPlaces.map((place, i) => (
                  <PlaceRow key={place.id} place={place} best={i === 0} onPress={() => handleSearchResultPress(place)} />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {showKeywordResults && !searching && searchResults.length === 0 && (
          <TouchableOpacity style={ss.reportFooter} activeOpacity={0.7} onPress={handleGoReportPlace}>
            <Text style={ss.reportFooterText}>찾으시는 장소가 없나요?</Text>
            <Text style={ss.reportFooterTextBold}>
              장소 제보하러 가기<Text style={ss.reportFooterArrow}> ›</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 카카오맵 */}
      <KakaoMap
        ref={mapRef}
        markers={visiblePlaces}
        likedPlaceIds={likedPlaceIds}
        currentLocation={myLocation}
        onMarkerPress={handleMarkerPress}
        onMapPress={handleMapPress}
        onMapReady={handleMapReady}
      />

      {/* 상단 오버레이 */}
      <View style={[styles.overlay, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.searchBar} activeOpacity={0.85} onPress={() => setSearchFocused(true)}>
          <Image source={require('@/assets/icons/search.png')} style={styles.searchIcon} resizeMode="contain" />
          <Text style={[styles.searchInput, styles.searchInputPlaceholder]} numberOfLines={1}>
            어디로 떠날까요?
          </Text>
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map(({ label, Icon }) => {
            const active = selectedCategory === label;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => setSelectedCategory(label)}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                activeOpacity={0.8}
              >
                <Icon width={14} height={14} color={active ? Colors.white : Colors.navActive} />
                <Text style={[styles.chipLabel, active ? styles.chipLabelActive : styles.chipLabelInactive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 바텀시트 */}
      <MapPlaceSheet
        place={selectedPlace}
        liked={selectedPlace ? likedPlaceIds.includes(selectedPlace.id) : false}
        onClose={handleMapPress}
        onToggleLike={handleToggleLike}
      />

      <Toast
        message={toastMsg}
        onHide={() => setToastMsg(null)}
        bottom={20}
        icon={toastMsg === '장소가 저장됐어요!' ? <ToastPlaceSavedIcon width={22} height={19} /> : undefined}
      />

      {/* 줌 버튼 — 바텀시트가 닫혀있을 때만 표시 */}
      {!selectedPlace && (
        <View style={styles.zoomContainer}>
          <TouchableOpacity
            style={styles.zoomBtn}
            activeOpacity={0.7}
            onPress={() => mapRef.current?.zoomIn()}
          >
            <Text style={styles.zoomBtnText}>+</Text>
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            style={styles.zoomBtn}
            activeOpacity={0.7}
            onPress={() => mapRef.current?.zoomOut()}
          >
            <Text style={styles.zoomBtnText}>−</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 내 위치 버튼 — 바텀시트가 뜨면 같이 위로 올라감 */}
      <Animated.View
        style={[
          styles.mapBtn,
          styles.locationBtn,
          { bottom: LOCATION_BTN_BOTTOM, transform: [{ translateY: locationBtnY }] },
        ]}
      >
        <TouchableOpacity
          style={styles.locationBtnTouchable}
          activeOpacity={0.8}
          onPress={handleLocationPress}
        >
          <MapMyLocationIcon width={22} height={22} color="#A89E9C" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    height: 46,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  searchIcon: {
    width: 18,
    height: 18,
    tintColor: '#A89E9C',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textBody1,
    padding: 0,
  },
  searchInputPlaceholder: {
    color: Colors.textMuted,
  },
  searchClear: {
    fontSize: 18,
    color: Colors.textMuted,
    paddingHorizontal: 2,
  },
  chips: {
    gap: 8,
    paddingRight: Spacing.xl,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    gap: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  chipActive: {
    backgroundColor: Colors.coral,
  },
  chipInactive: {
    backgroundColor: Colors.background,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  chipLabelActive: {
    color: Colors.white,
  },
  chipLabelInactive: {
    color: Colors.textBody2,
  },
  // 줌 버튼 — 직사각형 컨테이너
  zoomContainer: {
    position: 'absolute',
    left: Spacing.xl,
    bottom: 24,
    width: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 251, 246, 0.82)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoomBtn: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: 'rgba(58, 51, 48, 0.12)',
    marginHorizontal: 8,
  },
  zoomBtnText: {
    fontSize: 22,
    lineHeight: 26,
    color: Colors.textBody1,
    fontWeight: '300',
  },
  // 공통 맵 버튼 (내 위치)
  mapBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  // 내 위치 버튼
  locationBtn: {
    position: 'absolute',
    right: Spacing.xl,
  },
  locationBtnTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── 지도 검색 화면 스타일 (ss) ─────────────────────────────────────────────────
const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 14,
  },
  searchBarFlex: { flex: 1 },
  cancelText: { fontSize: 14, fontWeight: '500', color: Colors.textBody2 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: 40 },
  categoryGrid: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 20,
    marginTop: 4,
    marginBottom: 28,
  },
  categoryBtn: { alignItems: 'center', gap: 8 },
  categoryIconBox: {
    width: 68,
    height: 68,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBtnLabel: { fontSize: 13, fontWeight: '400', color: Colors.textBody2 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '500', color: Colors.textBody1 },
  clearAllText: { fontSize: 13, color: Colors.textMuted },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reportFooter: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 16,
  },
  reportFooterText: { fontSize: 13, color: Colors.textBody2 },
  reportFooterTextBold: { fontSize: 13, fontWeight: '700', color: Colors.textBody2 },
  reportFooterArrow: { fontWeight: '700', color: Colors.textBody2 },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 24,
  },
  recentChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  recentChipMain: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  recentChipText: { fontSize: 13, color: Colors.textBody1, flexShrink: 1 },
  recentChipRemove: { fontSize: 16, color: Colors.textMuted, paddingLeft: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginBottom: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  backArrow: { fontSize: 18, color: Colors.textBody1 },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    marginBottom: 12,
  },
  placeThumb: { width: 56, height: 56, borderRadius: Radius.sm },
  placeInfo: { flex: 1, gap: 6 },
  placeBadgeRow: { flexDirection: 'row', gap: 6 },
  placeName: { fontSize: 14, fontWeight: '600', color: Colors.textBody1 },
  placeChevron: { fontSize: 20, color: Colors.textMuted },
});
