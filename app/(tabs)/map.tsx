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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { MapPlace } from '@/types/map';
import { MOCK_MAP_PLACES } from '@/mock/mapPlaces';
import KakaoMap, { KakaoMapHandle } from '@/components/map/KakaoMap';
import MapPlaceSheet, { SHEET_HEIGHT } from '@/components/map/MapPlaceSheet';

const LOCATION_BTN_BOTTOM = 24;
const SHEET_GAP = 12;
const LOCATION_BTN_RAISE = SHEET_HEIGHT + SHEET_GAP - LOCATION_BTN_BOTTOM;

type Category = '전체' | '관광지' | '카페' | '식당';

const CATEGORIES: { label: Category; icon: ReturnType<typeof require> }[] = [
  { label: '전체', icon: require('@/assets/icons/pets.png') },
  { label: '관광지', icon: require('@/assets/icons/tour-spot.png') },
  { label: '카페', icon: require('@/assets/icons/hot-coffee.png') },
  { label: '식당', icon: require('@/assets/icons/spoon-and-fork.png') },
];

// 경주 중심 좌표
const GYEONGJU_LAT = 35.8562;
const GYEONGJU_LNG = 129.2247;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<KakaoMapHandle>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>('전체');
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const locationBtnY = useRef(new Animated.Value(0)).current;

  const handleMarkerPress = (id: string) => {
    const place = MOCK_MAP_PLACES.find((p) => p.id === id) ?? null;
    setSelectedPlace(place);
  };

  const handleMapPress = () => setSelectedPlace(null);

  // 내 위치 버튼을 바텀시트가 뜨고 닫히는 것과 같은 타이밍으로 함께 움직임
  useEffect(() => {
    Animated.timing(locationBtnY, {
      toValue: selectedPlace ? -LOCATION_BTN_RAISE : 0,
      duration: selectedPlace ? 260 : 220,
      easing: selectedPlace ? Easing.out(Easing.cubic) : Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [selectedPlace]);

  return (
    <View style={styles.container}>
      {/* 카카오맵 */}
      <KakaoMap
        ref={mapRef}
        markers={MOCK_MAP_PLACES}
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
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map(({ label, icon }) => {
            const active = selectedCategory === label;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => setSelectedCategory(label)}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                activeOpacity={0.8}
              >
                <Image
                  source={icon}
                  style={[styles.chipIcon, { tintColor: active ? Colors.white : Colors.navActive }]}
                  resizeMode="contain"
                />
                <Text style={[styles.chipLabel, active ? styles.chipLabelActive : styles.chipLabelInactive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 바텀시트 */}
      <MapPlaceSheet place={selectedPlace} onClose={handleMapPress} />

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
          onPress={() => mapRef.current?.moveTo(GYEONGJU_LAT, GYEONGJU_LNG)}
        >
          <Image
            source={require('@/assets/icons/target.png')}
            style={styles.locationIcon}
            resizeMode="contain"
          />
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
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chipActive: {
    backgroundColor: Colors.coral,
  },
  chipInactive: {
    backgroundColor: Colors.background,
  },
  chipIcon: {
    width: 14,
    height: 14,
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
  locationIcon: {
    width: 22,
    height: 22,
    tintColor: '#A89E9C',
  },
});
