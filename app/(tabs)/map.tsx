import React, { useEffect, useRef, useState } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { MapPlace } from '@/types/map';
import { searchPlaces, getPlaceDetail, getBookmarks, saveBookmark, deleteBookmarks, PlaceCategoryCode, ApiError } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { toMapPlace, toMapPlaceDetail } from '@/utils/placeMappers';
import KakaoMap, { KakaoMapHandle } from '@/components/map/KakaoMap';
import MapPlaceSheet, { SHEET_HEIGHT } from '@/components/map/MapPlaceSheet';
import Toast from '@/components/ui/Toast';
import FilterAllIcon from '@/assets/icons/filter-all.svg';
import FilterTourIcon from '@/assets/icons/filter-tour.svg';
import FilterCafeIcon from '@/assets/icons/filter-cafe.svg';
import FilterFoodIcon from '@/assets/icons/filter-food.svg';
import FilterSavedIcon from '@/assets/icons/tab-save-active.svg';
import MapMyLocationIcon from '@/assets/icons/map-mylocation.svg';

const LOCATION_BTN_BOTTOM = 24;
const SHEET_GAP = 12;
const LOCATION_BTN_RAISE = SHEET_HEIGHT + SHEET_GAP - LOCATION_BTN_BOTTOM;

const SAVED_FILTER = '내 저장' as const;
type Category = '전체' | '관광지' | '카페' | '식당' | typeof SAVED_FILTER;

const CATEGORIES: { label: Category; Icon: React.FC<{ width?: number; height?: number; color?: string }> }[] = [
  { label: '전체', Icon: FilterAllIcon },
  { label: '관광지', Icon: FilterTourIcon },
  { label: '카페', Icon: FilterCafeIcon },
  { label: '식당', Icon: FilterFoodIcon },
  { label: SAVED_FILTER, Icon: FilterSavedIcon },
];

const CATEGORY_CODE: Record<Exclude<Category, '전체' | typeof SAVED_FILTER>, PlaceCategoryCode> = {
  관광지: 'ATTRACTION',
  카페: 'CAFE',
  식당: 'RESTAURANT',
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
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

  useEffect(() => {
    fetchLikedPlaceIds();
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

  const performSearch = async (kw: string) => {
    const token = await getAccessToken();
    if (!token) return;
    setSearching(true);
    try {
      const result = await searchPlaces({ keyword: kw, size: 30 }, token);
      setSearchResults(result.places.map(toMapPlace));
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '검색에 실패했어요.';
      setToastMsg(message);
    } finally {
      setSearching(false);
    }
  };

  // 타이핑할 때마다 자동으로 검색 (300ms 디바운스)
  useEffect(() => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(() => {
      performSearch(trimmed);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const handleSearchSubmit = () => {
    const trimmed = keyword.trim();
    if (trimmed) performSearch(trimmed);
  };

  const handleClearSearch = () => {
    setKeyword('');
    setSearchResults([]);
    Keyboard.dismiss();
  };

  const handleSearchResultPress = (place: MapPlace) => {
    setKeyword('');
    setSearchResults([]);
    Keyboard.dismiss();
    mapRef.current?.moveTo(place.latitude, place.longitude);
    openPlaceDetail(place);
  };

  const handleToggleLike = async (place: MapPlace, liked: boolean) => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      if (liked) {
        await saveBookmark(Number(place.id), token);
        setLikedPlaceIds((prev) => (prev.includes(place.id) ? prev : [...prev, place.id]));
        setToastMsg('저장 목록에 추가했어요.');
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
    setSearchResults([]);
    Keyboard.dismiss();
  };

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
      />

      {/* 상단 오버레이 */}
      <View style={[styles.overlay, { paddingTop: insets.top + 12 }]}>
        <View style={styles.searchBar}>
          <Image
            source={require('@/assets/icons/search.png')}
            style={styles.searchIcon}
            resizeMode="contain"
          />
          <TextInput
            style={styles.searchInput}
            placeholder="어디로 떠날까요?"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
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

        {searchResults.length > 0 ? (
          <View style={styles.searchResultsCard}>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.searchResultsScroll}>
              {searchResults.map((place) => (
                <TouchableOpacity
                  key={place.id}
                  style={styles.searchResultItem}
                  activeOpacity={0.7}
                  onPress={() => handleSearchResultPress(place)}
                >
                  <Text style={styles.searchResultName} numberOfLines={1}>
                    {place.name}
                  </Text>
                  <Text style={styles.searchResultAddress} numberOfLines={1}>
                    {place.address}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : searching ? (
          <View style={styles.searchResultsCard}>
            <Text style={styles.searchEmptyText}>검색 중...</Text>
          </View>
        ) : keyword.length > 0 ? null : (
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
        )}
      </View>

      {/* 바텀시트 */}
      <MapPlaceSheet
        place={selectedPlace}
        liked={selectedPlace ? likedPlaceIds.includes(selectedPlace.id) : false}
        onClose={handleMapPress}
        onToggleLike={handleToggleLike}
      />

      <Toast message={toastMsg} onHide={() => setToastMsg(null)} bottom={20} />

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
    borderRadius: Radius.full,
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
  searchClear: {
    fontSize: 18,
    color: Colors.textMuted,
    paddingHorizontal: 2,
  },
  searchResultsCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  searchResultsScroll: {
    maxHeight: 280,
  },
  searchResultItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 3,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textBody1,
  },
  searchResultAddress: {
    fontSize: 12,
    color: Colors.textBody2,
  },
  searchEmptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    paddingVertical: Spacing.lg,
    textAlign: 'center',
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
