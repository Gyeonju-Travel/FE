import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ScrollView,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { SavedPlace } from '@/types/save';
import { Schedule } from '@/types/schedule';
import { MapPlace } from '@/types/map';
import { getBookmarks, searchPlaces, ApiError } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { toSavedPlace, toMapPlace } from '@/utils/placeMappers';
import WheelPicker, { PICKER_H } from '@/components/schedule/WheelPicker';
import Badge, { BADGE_TONE_COLORS } from '@/components/ui/Badge';
import Toast from '@/components/ui/Toast';
import EditScheduleView from '@/components/schedule/EditScheduleView';
import PlaceThumbnail from '@/components/ui/PlaceThumbnail';
import { PLACE_TAG_STYLE, DEFAULT_PLACE_TAG_STYLE, CATEGORY_BADGE_STYLE } from '@/constants/badgeConfig';
import KakaoMap, { KakaoMapHandle } from '@/components/map/KakaoMap';
import { haversineMeters, estimateWalkMinutes, formatDistance, formatWalkDuration } from '@/utils/distance';
import { fetchPedestrianRoute, LatLng, PedestrianRouteResult } from '@/utils/pedestrianRoute';
import ScheduleWaypointIcon from '@/assets/icons/schedule-waypoint.svg';
import ScheduleTimeIcon from '@/assets/icons/schedule-time.svg';
import ScheduleEditIcon from '@/assets/icons/schedule-edit.svg';
import ScheduleDepartureIcon from '@/assets/icons/schedule-departure.svg';
import ScheduleDateIcon from '@/assets/icons/schedule-date.svg';
import WalkingIcon from '@/assets/icons/walking.svg';
import MapMyLocationIcon from '@/assets/icons/map-mylocation.svg';
import TabScheduleIcon from '@/assets/icons/tab-schedule.svg';
import BinIcon from '@/assets/icons/bin.svg';
import ScheduleEmptyIllustration from '@/assets/schedule/empty-illustration.svg';

// ─── 상수 ───────────────────────────────────────────────────────────────────
const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];
const DEPARTURE_OPTIONS = ['교촌마을', '황리단길', '계림', '월정교', '경주읍성', '첨성대'];

/** DB에 등록된 출발지 장소들을 이름으로 찾아 위경도/사진을 가져온다. */
async function fetchDeparturePlaces(): Promise<Record<string, MapPlace>> {
  const token = await getAccessToken();
  if (!token) return {};
  const entries = await Promise.all(
    DEPARTURE_OPTIONS.map(async (name) => {
      try {
        const result = await searchPlaces({ keyword: name, size: 5 }, token);
        const match = result.places.find((p) => p.name === name) ?? result.places[0];
        return match ? ([name, toMapPlace(match)] as const) : null;
      } catch (e) {
        return null;
      }
    })
  );
  return Object.fromEntries(entries.filter((e): e is readonly [string, MapPlace] => e !== null));
}

const SHEET_OFFSCREEN_Y = 500;
const MAX_PLACES = 5;
const YEAR_BASE = 2024;
const YEARS = Array.from({ length: 6 }, (_, i) => `${YEAR_BASE + i}년`);
const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);

const getDaysCount = (yi: number, mi: number) =>
  new Date(YEAR_BASE + yi, mi + 1, 0).getDate();
const getDaysArr = (yi: number, mi: number) =>
  Array.from({ length: getDaysCount(yi, mi) }, (_, i) => `${i + 1}일`);
const formatPreview = (yi: number, mi: number, di: number) => {
  const d = new Date(YEAR_BASE + yi, mi, di + 1);
  return `${YEAR_BASE + yi}년 ${mi + 1}월 ${di + 1}일 ${DOW_KR[d.getDay()]}`;
};

// ─── PlaceCard ───────────────────────────────────────────────────────────────
function PlaceCard({
  place,
  selected,
  disabled,
  onToggle,
}: {
  place: SavedPlace;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[cs.placeCard, selected && cs.placeCardSelected, disabled && cs.placeCardDisabled]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <View style={[cs.checkbox, selected && cs.checkboxFilled, disabled && cs.checkboxDisabled]}>
        {selected && <Text style={cs.checkmark}>✓</Text>}
      </View>
      <PlaceThumbnail uri={place.imageUri} style={cs.placeImg} />
      <View style={cs.placeInfo}>
        <Text style={cs.placeName} numberOfLines={1}>
          {place.name}
        </Text>
        <View style={cs.placeTags}>
          {place.tags.map((tag) => {
            const cfg = PLACE_TAG_STYLE[tag] ?? DEFAULT_PLACE_TAG_STYLE;
            return (
              <Badge
                key={tag}
                label={tag}
                variant="outline"
                tone={cfg.tone}
                dot={cfg.dot}
                leading={
                  cfg.Icon ? (
                    <cfg.Icon width={15} height={15} color={BADGE_TONE_COLORS[cfg.tone].text} />
                  ) : undefined
                }
              />
            );
          })}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── ScheduleCard (캘린더 하단 일정 카드) ────────────────────────────────────────
function ScheduleCard({
  schedule,
  departurePlaces,
  expanded,
  onToggle,
  onEdit,
  onViewRoute,
  isEditMode,
  isSelected,
  onToggleSelect,
}: {
  schedule: Schedule;
  departurePlaces: Record<string, MapPlace>;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onViewRoute: () => void;
  isEditMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const lastPlace = schedule.places[schedule.places.length - 1];
  const title = lastPlace
    ? `${schedule.departureLabel} → ${lastPlace.name} 코스`
    : schedule.departureLabel;

  // 출발지 → 각 장소를 잇는 구간의 직선거리 기반 도보 시간 합계(순수 이동 시간, 체류 시간 제외).
  const departurePlace = departurePlaces[schedule.departureLabel];
  const routePoints = [
    ...(departurePlace ? [{ lat: departurePlace.latitude, lng: departurePlace.longitude }] : []),
    ...schedule.places.map((p) => ({ lat: p.latitude, lng: p.longitude })),
  ];
  const totalWalkMinutes = routePoints
    .slice(0, -1)
    .reduce(
      (sum, from, i) =>
        sum + estimateWalkMinutes(haversineMeters(from.lat, from.lng, routePoints[i + 1].lat, routePoints[i + 1].lng)),
      0
    );
  const durationText = formatWalkDuration(totalWalkMinutes);

  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const animProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animProgress, {
      toValue: expanded ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  const renderDetailContent = () => (
    <View style={ss.scheduleDetail}>
      <View style={[ss.timelineRow, ss.timelineRowGap]}>
        <View style={ss.timelineDepartureDot}>
          <Text style={ss.timelineDepartureDotText} numberOfLines={1}>
            출발
          </Text>
        </View>
        <View style={ss.timelineLine} />
        <PlaceThumbnail
          uri={departurePlaces[schedule.departureLabel]?.imageUri ?? null}
          style={ss.timelineThumb}
        />
        <Text style={ss.timelineText} numberOfLines={1}>
          {schedule.departureLabel}
        </Text>
      </View>

      {schedule.places.map((place, i) => {
        const isLast = i === schedule.places.length - 1;
        return (
          <View key={place.id} style={[ss.timelineRow, !isLast && ss.timelineRowGap]}>
            <View style={ss.timelineDot}>
              <Text style={ss.timelineDotText}>{i + 1}</Text>
            </View>
            {!isLast && <View style={ss.timelineLine} />}
            <PlaceThumbnail uri={place.imageUri} style={ss.timelineThumb} />
            <Text style={ss.timelineText} numberOfLines={1}>
              {place.name}
            </Text>
          </View>
        );
      })}

      <TouchableOpacity style={ss.routeBtn} activeOpacity={0.85} onPress={onViewRoute}>
        <Text style={ss.routeBtnText}>경로보기</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[ss.scheduleCard, isEditMode && isSelected && ss.scheduleCardSelected]}>
      <TouchableOpacity
        style={ss.scheduleCardRow}
        activeOpacity={0.85}
        onPress={isEditMode ? onToggleSelect : onToggle}
      >
        {isEditMode && (
          <View style={[ss.scheduleCheckbox, isSelected && ss.scheduleCheckboxSelected]}>
            {isSelected && <Text style={ss.scheduleCheckmark}>✓</Text>}
          </View>
        )}
        <PlaceThumbnail uri={schedule.places[0]?.imageUri} style={ss.scheduleCardImg} />
        <View style={ss.scheduleCardInfo}>
          <Text style={ss.scheduleCardTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={ss.scheduleCardMetaRow}>
            <ScheduleWaypointIcon width={13} height={13} color={Colors.textBody2} style={ss.scheduleCardMetaIcon} />
            <Text style={ss.scheduleCardMetaText}>{schedule.places.length}곳 경유</Text>
            <ScheduleTimeIcon
              width={13}
              height={13}
              color={Colors.textBody2}
              style={[ss.scheduleCardMetaIcon, { marginLeft: 10 }]}
            />
            <Text style={ss.scheduleCardMetaText}>약 {durationText}</Text>
          </View>
        </View>
        {!isEditMode && (
          <TouchableOpacity
            style={ss.cardEditIconBtn}
            activeOpacity={0.7}
            onPress={onEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ScheduleEditIcon width={15} height={15} color={Colors.coral} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {!isEditMode && (
        <>
          <View
            style={ss.measureClone}
            pointerEvents="none"
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              setMeasuredHeight((prev) => (prev === h ? prev : h));
            }}
          >
            {renderDetailContent()}
          </View>
          <Animated.View
            style={{
              overflow: 'hidden',
              height: animProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, measuredHeight ?? 0],
              }),
              opacity: animProgress,
            }}
          >
            {renderDetailContent()}
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ─── CreateScheduleView ───────────────────────────────────────────────────────
function CreateScheduleView({
  onBack,
  onSave,
  initialSchedule,
}: {
  onBack: () => void;
  onSave: (schedule: Schedule) => void;
  initialSchedule?: Schedule;
}) {
  const now = new Date();
  const isEditing = !!initialSchedule;
  const currentYearIdx = Math.min(Math.max(now.getFullYear() - YEAR_BASE, 0), YEARS.length - 1);
  const initialDepartureIdx = initialSchedule
    ? DEPARTURE_OPTIONS.indexOf(initialSchedule.departureLabel)
    : -1;
  const [departureIdx, setDepartureIdx] = useState<number | null>(
    initialDepartureIdx >= 0 ? initialDepartureIdx : null
  );
  const [yearIdx, setYearIdx] = useState(
    initialSchedule ? initialSchedule.year - YEAR_BASE : currentYearIdx
  );
  const [monthIdx, setMonthIdx] = useState(initialSchedule ? initialSchedule.month : now.getMonth());
  const [dayIdx, setDayIdx] = useState(initialSchedule ? initialSchedule.day - 1 : now.getDate() - 1);
  const [dateConfirmed, setDateConfirmed] = useState(!!initialSchedule);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSchedule?.places.map((p) => p.id))
  );
  const [pickerType, setPickerType] = useState<'location' | 'date' | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [departurePlaces, setDeparturePlaces] = useState<Record<string, MapPlace>>({});
  // 저장 장소가 없을 때 안내 블록을 스크롤 영역의 남은 공간 정중앙에 배치하기 위한 실측값들.
  const [scrollAreaHeight, setScrollAreaHeight] = useState(0);
  const [aboveEmptyHeight, setAboveEmptyHeight] = useState(0);
  const [placeEmptyHeight, setPlaceEmptyHeight] = useState(0);
  const placeEmptyReady = scrollAreaHeight > 0 && aboveEmptyHeight > 0 && placeEmptyHeight > 0;
  const placeEmptySpacer = placeEmptyReady
    ? Math.max(0, (scrollAreaHeight - aboveEmptyHeight - placeEmptyHeight) / 2)
    : 0;

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) {
        setLoadingPlaces(false);
        return;
      }
      try {
        const result = await getBookmarks(undefined, token);
        setSavedPlaces(result.map(toSavedPlace));
      } catch (e) {
        const message = e instanceof ApiError ? e.message : '저장한 장소를 불러오지 못했어요.';
        setToastMsg(message);
      } finally {
        setLoadingPlaces(false);
      }
    })();
  }, []);

  useEffect(() => {
    fetchDeparturePlaces().then(setDeparturePlaces);
  }, []);

  // 바텀시트 애니메이션 (지도 화면의 장소 시트와 동일한 방식)
  const sheetY = useRef(new Animated.Value(SHEET_OFFSCREEN_Y)).current;
  const [sheetVisible, setSheetVisible] = useState(false);
  const lastPickerType = useRef<'location' | 'date'>('location');
  // 스와이프로 닫는 애니메이션이 이미 시작됐을 때 useEffect의 닫기 애니메이션과 중복 실행되는 것을 방지
  const swipeClosing = useRef(false);

  useEffect(() => {
    if (pickerType) {
      lastPickerType.current = pickerType;
      swipeClosing.current = false;
      setSheetVisible(true);
      sheetY.setValue(SHEET_OFFSCREEN_Y);
      Animated.timing(sheetY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (!swipeClosing.current) {
      Animated.timing(sheetY, {
        toValue: SHEET_OFFSCREEN_Y,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setSheetVisible(false));
    }
  }, [pickerType]);

  const closeSheet = () => setPickerType(null);

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => dy > 4,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) sheetY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 80 || vy > 0.5) {
          swipeClosing.current = true;
          Animated.timing(sheetY, {
            toValue: SHEET_OFFSCREEN_Y,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setSheetVisible(false);
            setPickerType(null);
          });
        } else {
          Animated.timing(sheetY, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // 임시 상태 (picker 열린 동안)
  const [tDep, setTDep] = useState(0);
  const [tYear, setTYear] = useState(currentYearIdx);
  const [tMonth, setTMonth] = useState(now.getMonth());
  const [tDay, setTDay] = useState(now.getDate() - 1);

  const openLocation = () => { setTDep(departureIdx ?? 0); setPickerType('location'); };
  const openDate = () => { setTYear(yearIdx); setTMonth(monthIdx); setTDay(dayIdx); setPickerType('date'); };

  const confirmLocation = () => { setDepartureIdx(tDep); setPickerType(null); };
  const confirmDate = () => {
    setYearIdx(tYear);
    setMonthIdx(tMonth);
    setDayIdx(Math.min(tDay, getDaysCount(tYear, tMonth) - 1));
    setDateConfirmed(true);
    setPickerType(null);
  };

  const maxSelectable = Math.min(MAX_PLACES, savedPlaces.length);

  const togglePlace = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.has(id)) {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }
      if (prev.size >= MAX_PLACES) {
        setToastMsg(`장소는 최대 ${MAX_PLACES}개까지만 선택할 수 있어요.`);
        return prev;
      }
      return new Set(prev).add(id);
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === maxSelectable) {
      setSelectedIds(new Set());
      return;
    }
    if (savedPlaces.length > MAX_PLACES) {
      setToastMsg(`장소는 최대 ${MAX_PLACES}개까지만 선택할 수 있어요.`);
    }
    setSelectedIds(new Set(savedPlaces.slice(0, maxSelectable).map((p) => p.id)));
  };

  const [showEdit, setShowEdit] = useState(false);

  const handleCreateSchedule = () => {
    if (departureIdx === null) {
      setToastMsg('출발지를 선택해주세요.');
      return;
    }
    if (!dateConfirmed) {
      setToastMsg('날짜를 선택해주세요.');
      return;
    }
    if (selectedIds.size === 0) {
      setToastMsg('장소를 선택해주세요.');
      return;
    }
    setShowEdit(true);
  };

  const dateText = dateConfirmed ? formatPreview(yearIdx, monthIdx, dayIdx) : null;

  if (showEdit && departureIdx !== null) {
    return (
      <EditScheduleView
        departureLabel={DEPARTURE_OPTIONS[departureIdx]}
        departureCoord={
          departurePlaces[DEPARTURE_OPTIONS[departureIdx]]
            ? {
                lat: departurePlaces[DEPARTURE_OPTIONS[departureIdx]].latitude,
                lng: departurePlaces[DEPARTURE_OPTIONS[departureIdx]].longitude,
              }
            : undefined
        }
        departureImageUri={departurePlaces[DEPARTURE_OPTIONS[departureIdx]]?.imageUri ?? null}
        places={savedPlaces.filter((p) => selectedIds.has(p.id))}
        isEditing={isEditing}
        onBack={() => setShowEdit(false)}
        onSaved={(finalPlaces) => {
          onSave({
            id: initialSchedule?.id ?? `${Date.now()}`,
            year: yearIdx + YEAR_BASE,
            month: monthIdx,
            day: dayIdx + 1,
            departureLabel: DEPARTURE_OPTIONS[departureIdx],
            places: finalPlaces,
          });
          onBack();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={cs.safeArea}>
      {/* 헤더 */}
      <View style={cs.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={cs.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={cs.headerTitle}>나의 일정</Text>
      </View>

      <ScrollView
        style={cs.scroll}
        contentContainerStyle={cs.scrollContent}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setScrollAreaHeight(e.nativeEvent.layout.height)}
      >
        <View onLayout={(e) => setAboveEmptyHeight(e.nativeEvent.layout.height)}>
          {/* 출발지 설정 */}
          <Text style={cs.sectionLabel}>출발지 설정</Text>
          <TouchableOpacity style={cs.selectorRow} onPress={openLocation} activeOpacity={0.8}>
            <ScheduleDepartureIcon width={16} height={16} color={Colors.textBody2} />
            {departureIdx !== null ? (
              <Text style={cs.selectorText}>{DEPARTURE_OPTIONS[departureIdx]}</Text>
            ) : (
              <Text style={cs.selectorPlaceholder}>출발지를 선택해주세요.</Text>
            )}
            <Text style={cs.chevron}>›</Text>
          </TouchableOpacity>

          {/* 날짜 선택 */}
          <Text style={[cs.sectionLabel, { marginTop: Spacing.xl }]}>날짜 선택</Text>
          <TouchableOpacity style={cs.selectorRow} onPress={openDate} activeOpacity={0.8}>
            <ScheduleDateIcon width={16} height={16} color={Colors.textBody2} />
            {dateText ? (
              <Text style={cs.selectorText}>{dateText}</Text>
            ) : (
              <Text style={cs.selectorPlaceholder}>날짜를 선택해주세요.</Text>
            )}
            <Text style={cs.chevron}>›</Text>
          </TouchableOpacity>

          {/* 저장 장소 선택 */}
          <View style={cs.placeHeader}>
            <Text style={cs.sectionLabel}>저장 장소 선택</Text>
            <TouchableOpacity onPress={toggleAll}>
              <Text style={cs.selectAll}>전체 선택</Text>
            </TouchableOpacity>
          </View>
        </View>
        {loadingPlaces ? (
          <Text style={cs.selectorPlaceholder}>저장한 장소를 불러오는 중...</Text>
        ) : savedPlaces.length === 0 ? (
          <View style={{ marginTop: placeEmptySpacer, opacity: placeEmptyReady ? 1 : 0 }}>
            <View style={cs.placeEmptyWrap} onLayout={(e) => setPlaceEmptyHeight(e.nativeEvent.layout.height)}>
              <ScheduleEmptyIllustration width={280} height={141} style={{ marginBottom: Spacing.md }} />
              <Text style={ss.emptyTitle}>저장한 장소가 없어요</Text>
              <Text style={ss.emptySubtitle}>지도에서 마음에 드는 장소를 저장해보세요</Text>
            </View>
          </View>
        ) : null}
        {savedPlaces.map((place) => {
          const selected = selectedIds.has(place.id);
          return (
            <PlaceCard
              key={place.id}
              place={place}
              selected={selected}
              disabled={!selected && selectedIds.size >= MAX_PLACES}
              onToggle={() => togglePlace(place.id)}
            />
          );
        })}
      </ScrollView>

      {/* 일정 만들기 버튼 */}
      <View style={cs.bottomBar}>
        <TouchableOpacity style={cs.createBtn} activeOpacity={0.85} onPress={handleCreateSchedule}>
          <Text style={cs.createBtnText}>{isEditing ? '일정 수정하기 →' : '일정 만들기 →'}</Text>
        </TouchableOpacity>
      </View>

      <Toast message={toastMsg} onHide={() => setToastMsg(null)} />

      {/* 출발지/날짜 Picker 바텀시트 */}
      {sheetVisible && (
        <>
          <TouchableOpacity style={cs.backdrop} activeOpacity={1} onPress={closeSheet} />
          <Animated.View style={[cs.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={cs.sheetHandleArea} {...sheetPanResponder.panHandlers}>
              <View style={cs.sheetHandle} />
            </View>
            {lastPickerType.current === 'location' ? (
              <>
                <Text style={cs.sheetTitle}>출발지 설정</Text>
                <WheelPicker data={DEPARTURE_OPTIONS} selectedIdx={tDep} onSelect={setTDep} />
                <TouchableOpacity style={cs.confirmBtn} onPress={confirmLocation}>
                  <Text style={cs.confirmText}>확인</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={cs.datePreview}>{formatPreview(tYear, tMonth, tDay)}</Text>
                <View style={cs.dateRow}>
                  <WheelPicker
                    key="yr"
                    data={YEARS}
                    selectedIdx={tYear}
                    flex={1}
                    onSelect={(i) => {
                      setTYear(i);
                      const max = getDaysCount(i, tMonth) - 1;
                      if (tDay > max) setTDay(max);
                    }}
                  />
                  <WheelPicker
                    key="mo"
                    data={MONTHS}
                    selectedIdx={tMonth}
                    flex={1}
                    onSelect={(i) => {
                      setTMonth(i);
                      const max = getDaysCount(tYear, i) - 1;
                      if (tDay > max) setTDay(max);
                    }}
                  />
                  <WheelPicker
                    key={`dy-${tYear}-${tMonth}`}
                    data={getDaysArr(tYear, tMonth)}
                    selectedIdx={Math.min(tDay, getDaysCount(tYear, tMonth) - 1)}
                    flex={1}
                    onSelect={setTDay}
                  />
                </View>
                <TouchableOpacity style={cs.confirmBtn} onPress={confirmDate}>
                  <Text style={cs.confirmText}>확인</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── RouteView (경로보기) ──────────────────────────────────────────────────────
const SCREEN_H = Dimensions.get('window').height;
// 바텀시트 snap point: 화면의 20% / 40% / 85%.
const RV_SNAP_POINTS = ['20%', '40%', '85%'];
const RV_DEFAULT_SNAP_INDEX = 1;
const RV_DEFAULT_LAT = 35.8562;
const RV_DEFAULT_LNG = 129.2247;
const RV_DOT_SIZE = 28;
const RV_LINE_GAP_TOP = 4;
const RV_LINE_GAP_BOTTOM = 6;

const DASH_UNIT = 6; // dashSegment(3) + gap(3), 촘촘한 점선

function DashLine({ height }: { height: number }) {
  const count = Math.max(1, Math.round(height / DASH_UNIT));
  return (
    <View style={[rv.dashLineContainer, { height }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={rv.dashSegment} />
      ))}
    </View>
  );
}

// 이동정보 박스까지 포함한 전체 블록(행+도보 배지) 높이를 측정해서, 다음 번호 바로 위까지
// 점선이 이어지도록 함 (겹치지 않도록 dot 아래/다음 dot 위에 여백을 둠)
function RouteStopBlock({
  railStyle,
  dot,
  isLast,
  walkMeters,
  walkMinutes,
  onPress,
  children,
}: {
  railStyle: StyleProp<ViewStyle>;
  dot: React.ReactNode;
  isLast: boolean;
  walkMeters?: number;
  walkMinutes?: number;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const [blockHeight, setBlockHeight] = useState(0);
  const lineHeight = Math.max(0, blockHeight - RV_DOT_SIZE - RV_LINE_GAP_TOP - RV_LINE_GAP_BOTTOM);
  return (
    <View style={rv.stopBlock} onLayout={(e) => setBlockHeight(e.nativeEvent.layout.height)}>
      <TouchableOpacity style={rv.stopRow} activeOpacity={0.7} onPress={onPress} disabled={!onPress}>
        <View style={railStyle}>{dot}</View>
        {children}
      </TouchableOpacity>
      {!isLast && (
        <View style={rv.dashOverlay}>
          <DashLine height={lineHeight} />
        </View>
      )}
      {walkMeters != null && <WalkBadge meters={walkMeters} minutes={walkMinutes} />}
    </View>
  );
}

function WalkBadge({ meters, minutes }: { meters: number; minutes?: number }) {
  return (
    <View style={rv.walkRow}>
      <WalkingIcon width={13} height={13} color={Colors.textMuted} style={rv.walkIcon} />
      <Text style={rv.walkText}>
        도보 {minutes ?? estimateWalkMinutes(meters)}분 · {formatDistance(meters)}
      </Text>
    </View>
  );
}

function RouteView({
  schedule,
  departurePlaces,
  onBack,
}: {
  schedule: Schedule;
  departurePlaces: Record<string, MapPlace>;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<KakaoMapHandle>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => RV_SNAP_POINTS, []);
  // @gorhom/bottom-sheet가 시트의 현재 위치(화면 상단 기준 y좌표)를 이 shared value에 계속 반영해준다.
  // 지도 위 확대/축소·내 위치 버튼을 시트 바로 위에 붙이기 위해 여기서 읽어 쓴다.
  const animatedPosition = useSharedValue(SCREEN_H);
  // 탭 네비게이터 안이라 실제 컨테이너 높이가 SCREEN_H보다 작다 (탭 바 높이만큼 차이 남).
  // 버튼이 시트에서 너무 멀어지지 않도록 실제 레이아웃 높이를 측정해서 사용한다.
  const containerHeight = useSharedValue(SCREEN_H);
  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    bottom: containerHeight.value - animatedPosition.value + 16,
  }));

  const departurePlace = departurePlaces[schedule.departureLabel];
  const departureCoord = departurePlace
    ? { lat: departurePlace.latitude, lng: departurePlace.longitude }
    : { lat: schedule.places[0]?.latitude, lng: schedule.places[0]?.longitude };
  const routePlaces = [
    { id: 'departure', lat: departureCoord.lat, lng: departureCoord.lng },
    ...schedule.places.map((p) => ({ id: p.id, lat: p.latitude, lng: p.longitude })),
  ];
  const stops: LatLng[] = routePlaces.map((p) => ({ lat: p.lat, lng: p.lng }));

  // Tmap 보행자 경로안내 API로 각 구간(정류장 사이)의 실제 도보 경로/거리/시간을 가져온다.
  // 키가 없거나 요청이 실패한 구간은 null로 남아 haversine 직선거리로 대체된다.
  const [segments, setSegments] = useState<(PedestrianRouteResult | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      stops.slice(0, -1).map((from, i) => fetchPedestrianRoute(from, stops[i + 1]))
    ).then((results) => {
      if (!cancelled) setSegments(results);
    });
    return () => {
      cancelled = true;
    };
  }, [schedule.id]);

  const firstPlace = schedule.places[0];
  const departureToFirstMeters = segments[0]?.distanceMeters ?? (firstPlace
    ? haversineMeters(departureCoord.lat, departureCoord.lng, firstPlace.latitude, firstPlace.longitude)
    : 0);
  const departureToFirstMinutes = segments[0]?.durationMinutes;

  // 구간별로 실제 경로를 이어붙인다. 두 지점이 너무 가까워 Tmap이 거절하는 등
  // 특정 구간만 못 받아온 경우, 그 구간만 직선으로 대체하고 나머지는 실제 경로를 그대로 쓴다.
  const routePath: LatLng[] = stops
    .slice(0, -1)
    .flatMap((from, i) => segments[i]?.path ?? [from, stops[i + 1]]);

  return (
    <View style={rv.safeArea}>
      <KakaoMap ref={mapRef} routePlaces={routePlaces} routePath={routePath} />

      <View
        style={rv.overlaySafeArea}
        pointerEvents="box-none"
        onLayout={(e) => {
          containerHeight.value = e.nativeEvent.layout.height;
        }}
      >
        <TouchableOpacity
          style={[rv.backBtn, { top: insets.top + 12 }]}
          activeOpacity={0.8}
          onPress={onBack}
        >
          <Text style={rv.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={rv.zoomContainer}>
          <TouchableOpacity style={rv.zoomBtn} activeOpacity={0.7} onPress={() => mapRef.current?.zoomIn()}>
            <Text style={rv.zoomBtnText}>+</Text>
          </TouchableOpacity>
          <View style={rv.zoomDivider} />
          <TouchableOpacity style={rv.zoomBtn} activeOpacity={0.7} onPress={() => mapRef.current?.zoomOut()}>
            <Text style={rv.zoomBtnText}>−</Text>
          </TouchableOpacity>
        </View>

        <Reanimated.View style={[rv.locationBtn, controlsAnimatedStyle]}>
          <TouchableOpacity
            style={rv.locationBtnTouchable}
            activeOpacity={0.8}
            onPress={() => mapRef.current?.moveTo(RV_DEFAULT_LAT, RV_DEFAULT_LNG)}
          >
            <MapMyLocationIcon width={22} height={22} color="#A89E9C" />
          </TouchableOpacity>
        </Reanimated.View>
      </View>

      <BottomSheet
        ref={sheetRef}
        index={RV_DEFAULT_SNAP_INDEX}
        snapPoints={snapPoints}
        animatedPosition={animatedPosition}
        enableDynamicSizing={false}
        enableContentPanningGesture={false}
        backgroundStyle={rv.sheetBackground}
        handleIndicatorStyle={rv.handle}
        handleStyle={rv.handleArea}
      >
        <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={rv.sheetContent}>
          <RouteStopBlock
            railStyle={rv.departureRail}
            isLast={schedule.places.length === 0}
            walkMeters={schedule.places.length > 0 ? departureToFirstMeters : undefined}
            walkMinutes={schedule.places.length > 0 ? departureToFirstMinutes : undefined}
            onPress={() => mapRef.current?.moveTo(departureCoord.lat, departureCoord.lng)}
            dot={
              <View style={rv.stopDepartureDot}>
                <Text style={rv.stopDepartureDotText} numberOfLines={1}>
                  출발
                </Text>
              </View>
            }
          >
            <PlaceThumbnail uri={departurePlace?.imageUri ?? null} style={rv.stopThumb} />
            <Text style={rv.stopName} numberOfLines={1}>
              {schedule.departureLabel}
            </Text>
          </RouteStopBlock>

          {schedule.places.map((place, i) => {
            const isLast = i === schedule.places.length - 1;
            const next = schedule.places[i + 1];
            const segment = segments[i + 1];
            const meters = segment?.distanceMeters ?? (next
              ? haversineMeters(place.latitude, place.longitude, next.latitude, next.longitude)
              : 0);
            const catStyle = CATEGORY_BADGE_STYLE[place.category];

            return (
              <RouteStopBlock
                key={place.id}
                railStyle={rv.stopRail}
                isLast={isLast}
                walkMeters={!isLast ? meters : undefined}
                walkMinutes={!isLast ? segment?.durationMinutes : undefined}
                onPress={() => {
                  mapRef.current?.moveTo(place.latitude, place.longitude);
                  sheetRef.current?.collapse();
                }}
                dot={
                  <View style={rv.stopDot}>
                    <Text style={rv.stopDotText}>{i + 1}</Text>
                  </View>
                }
              >
                <PlaceThumbnail uri={place.imageUri} style={rv.stopThumb} />
                <View style={rv.stopInfo}>
                  <View style={rv.stopNameRow}>
                    <Text style={rv.stopName} numberOfLines={1}>
                      {place.name}
                    </Text>
                    {catStyle && (
                      <Badge
                        label={place.category}
                        variant="filled"
                        tone={catStyle.tone}
                        leading={
                          <catStyle.Icon width={13} height={13} color={BADGE_TONE_COLORS[catStyle.tone].text} />
                        }
                      />
                    )}
                  </View>
                  <View style={rv.tagsRow}>
                    {place.tags.map((tag) => {
                      const cfg = PLACE_TAG_STYLE[tag] ?? DEFAULT_PLACE_TAG_STYLE;
                      return (
                        <Badge key={tag} label={tag} variant="outline" tone={cfg.tone} dot={cfg.dot} />
                      );
                    })}
                  </View>
                </View>
              </RouteStopBlock>
            );
          })}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

// ─── ScheduleScreen ───────────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function ScheduleScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
    day: today.getDate(),
  });
  const [showCreate, setShowCreate] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [viewingRouteSchedule, setViewingRouteSchedule] = useState<Schedule | null>(null);
  const [departurePlaces, setDeparturePlaces] = useState<Record<string, MapPlace>>({});

  useEffect(() => {
    fetchDeparturePlaces().then(setDeparturePlaces);
  }, []);

  const exitScheduleEditMode = () => {
    setIsEditMode(false);
    setSelectedScheduleIds(new Set());
  };

  const toggleScheduleSelect = (id: string) => {
    setSelectedScheduleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (viewingRouteSchedule) {
    return (
      <RouteView
        schedule={viewingRouteSchedule}
        departurePlaces={departurePlaces}
        onBack={() => setViewingRouteSchedule(null)}
      />
    );
  }

  if (showCreate || editingSchedule) {
    return (
      <CreateScheduleView
        initialSchedule={editingSchedule ?? undefined}
        onBack={() => {
          setShowCreate(false);
          setEditingSchedule(null);
        }}
        onSave={(schedule) =>
          setSchedules((prev) =>
            prev.some((s) => s.id === schedule.id)
              ? prev.map((s) => (s.id === schedule.id ? schedule : s))
              : [...prev, schedule]
          )
        }
      />
    );
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const isSelected = (day: number) =>
    day === selectedDate.day && month === selectedDate.month && year === selectedDate.year;

  const hasSchedule = (y: number, m: number, day: number) =>
    schedules.some((s) => s.year === y && s.month === m && s.day === day);

  const daySchedules = schedules.filter(
    (s) => s.year === selectedDate.year && s.month === selectedDate.month && s.day === selectedDate.day
  );

  const handleSelectAllSchedules = () => {
    if (selectedScheduleIds.size === daySchedules.length) {
      setSelectedScheduleIds(new Set());
    } else {
      setSelectedScheduleIds(new Set(daySchedules.map((s) => s.id)));
    }
  };

  const handleDeleteSchedules = () => {
    setSchedules((prev) => prev.filter((s) => !selectedScheduleIds.has(s.id)));
    exitScheduleEditMode();
  };

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <SafeAreaView style={ss.safeArea}>
      <View style={ss.container}>
        <Text style={ss.pageTitle}>나의 일정</Text>

        <View style={ss.calendarCard}>
          <View style={ss.monthNav}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={ss.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={ss.monthLabel}>{year}년 {month + 1}월</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={ss.navArrow}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={ss.weekRow}>
            {DAYS_OF_WEEK.map((d, i) => (
              <Text key={d} style={[ss.weekDay, i === 0 && ss.sundayLabel]}>{d}</Text>
            ))}
          </View>
          {rows.map((row, ri) => (
            <View key={ri} style={ss.weekRow}>
              {Array.from({ length: 7 }).map((_, ci) => {
                const day = row[ci] ?? null;
                const selectedCell = day !== null && isSelected(day);
                const dotVisible = day !== null && hasSchedule(year, month, day);
                return (
                  <TouchableOpacity
                    key={ci}
                    style={ss.dayCell}
                    activeOpacity={day ? 0.7 : 1}
                    disabled={!day}
                    onPress={() => {
                      if (!day) return;
                      setSelectedDate({ year, month, day });
                      setExpandedId(null);
                      exitScheduleEditMode();
                    }}
                  >
                    <View style={[ss.dayInner, selectedCell && ss.todayCircle]}>
                      <Text style={[ss.dayText, ci === 0 && ss.sundayText, selectedCell && ss.todayText]}>
                        {day ?? ''}
                      </Text>
                    </View>
                    <View style={[ss.scheduleDot, dotVisible && ss.scheduleDotVisible]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {daySchedules.length > 0 ? (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={ss.dayHeaderRow}>
              <TabScheduleIcon width={16} height={16} color={Colors.textBody1} />
              <Text style={ss.dayHeaderText}>
                {selectedDate.month + 1}월 {selectedDate.day}일 (
                {DOW_KR[new Date(selectedDate.year, selectedDate.month, selectedDate.day).getDay()]})
              </Text>
              <Text style={ss.dayHeaderCount}> · {daySchedules.length}개 일정</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => (isEditMode ? exitScheduleEditMode() : setIsEditMode(true))}>
                <Text style={ss.dayHeaderEditBtn}>{isEditMode ? '취소' : '편집'}</Text>
              </TouchableOpacity>
            </View>

            {isEditMode && (
              <View style={ss.selectAllRow}>
                <TouchableOpacity onPress={handleSelectAllSchedules}>
                  <Text style={ss.selectAllText}>전체선택</Text>
                </TouchableOpacity>
                <Text
                  style={[
                    ss.selectedCountText,
                    selectedScheduleIds.size > 0 && ss.selectedCountTextActive,
                  ]}
                >
                  {selectedScheduleIds.size}개 선택됨
                </Text>
              </View>
            )}

            {daySchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                departurePlaces={departurePlaces}
                expanded={expandedId === schedule.id}
                onToggle={() => setExpandedId((id) => (id === schedule.id ? null : schedule.id))}
                onEdit={() => setEditingSchedule(schedule)}
                onViewRoute={() => setViewingRouteSchedule(schedule)}
                isEditMode={isEditMode}
                isSelected={selectedScheduleIds.has(schedule.id)}
                onToggleSelect={() => toggleScheduleSelect(schedule.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={ss.emptyCard}>
            <ScheduleEmptyIllustration width={280} height={141} style={{ marginBottom: Spacing.md }} />
            <Text style={ss.emptyTitle}>저장된 일정이 없어요</Text>
            <Text style={ss.emptySubtitle}>하단 + 버튼을 누른 후 새 일정을 만들어 보세요</Text>
          </View>
        )}
      </View>

      {isEditMode && daySchedules.length > 0 ? (
        <View style={ss.deleteBar}>
          <TouchableOpacity
            onPress={selectedScheduleIds.size > 0 ? handleDeleteSchedules : undefined}
            activeOpacity={selectedScheduleIds.size > 0 ? 0.85 : 1}
            style={selectedScheduleIds.size > 0 ? ss.deleteBtnActive : ss.deleteBtn}
          >
            <BinIcon width={18} height={18} color={selectedScheduleIds.size > 0 ? Colors.coral : Colors.textMuted} />
            <Text style={selectedScheduleIds.size > 0 ? ss.deleteBtnTextActive : ss.deleteBtnText}>
              {selectedScheduleIds.size > 0 ? `삭제하기 (${selectedScheduleIds.size})` : '삭제하기'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={ss.fab} activeOpacity={0.85} onPress={() => setShowCreate(true)}>
          <Image source={require('@/assets/icons/add.png')} style={ss.fabIcon} resizeMode="contain" />
        </TouchableOpacity>
      )}

      <Toast message={toastMsg} onHide={() => setToastMsg(null)} />
    </SafeAreaView>
  );
}

// ─── 일정 만들기 스타일 (cs) ──────────────────────────────────────────────────
const cs = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: 12,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1, lineHeight: 28 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: 120 },
  placeEmptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: Colors.textBody1, marginBottom: 8 },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
    gap: 10,
  },
  selectorText: { flex: 1, fontSize: 14, color: Colors.textBody1 },
  selectorPlaceholder: { flex: 1, fontSize: 14, color: Colors.textMuted },
  chevron: { fontSize: 18, color: Colors.textMuted, lineHeight: 22 },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: 10,
  },
  selectAll: { fontSize: 13, color: Colors.coral, fontWeight: '500' },
  // 장소 카드
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 88,
    backgroundColor: Colors.background,
    borderWidth: 0.5,
    borderColor: '#EDE8E3',
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    shadowColor: '#3A3330',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  placeCardSelected: { backgroundColor: Colors.primaryTint, borderColor: Colors.primaryBorder },
  placeCardDisabled: { opacity: 0.45 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    flexShrink: 0,
  },
  checkboxFilled: { backgroundColor: Colors.coral, borderColor: Colors.coral },
  checkboxDisabled: { backgroundColor: Colors.bgWarm, borderColor: Colors.border },
  checkmark: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  placeImg: { width: 64, height: 64, borderRadius: Radius.sm },
  placeInfo: { flex: 1, gap: 6 },
  placeName: { fontSize: 14, fontWeight: '600', color: Colors.textBody1 },
  placeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tagIcon: { width: 15, height: 15 },
  // 하단 버튼
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  createBtn: {
    backgroundColor: Colors.coral,
    borderRadius: Radius.lg,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.coral,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  createBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  // 바텀시트
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 32,
  },
  sheetHandleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D9D4CF',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textBody1,
    textAlign: 'center',
    marginBottom: 16,
  },
  datePreview: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textBody1,
    textAlign: 'center',
    marginBottom: 8,
  },
  dateRow: { flexDirection: 'row' },
  confirmBtn: {
    marginTop: 16,
    backgroundColor: Colors.coral,
    borderRadius: Radius.lg,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
});

// ─── 기존 캘린더 스타일 (ss) ──────────────────────────────────────────────────
const ss = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl },
  pageTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg },
  calendarCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
    shadowColor: '#3A3330',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  navArrow: { fontSize: 22, color: Colors.textBody2, lineHeight: 26 },
  monthLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  weekRow: { flexDirection: 'row', marginBottom: 2 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '500', color: Colors.textBody2, paddingVertical: 6 },
  sundayLabel: { color: Colors.coral },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayInner: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full },
  todayCircle: { backgroundColor: Colors.coral },
  dayText: { fontSize: 14, color: Colors.textPrimary },
  sundayText: { color: Colors.coral },
  todayText: { color: Colors.white, fontWeight: '600' },
  scheduleDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: 'transparent' },
  scheduleDotVisible: { backgroundColor: Colors.coral },
  emptyCard: { paddingTop: Spacing.xxl, paddingVertical: 40, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: Colors.textMuted },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingLeft: 6,
    paddingRight: 6,
    gap: 6,
  },
  dayHeaderText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  dayHeaderCount: { fontSize: 13, color: Colors.textMuted },
  dayHeaderEditBtn: { fontSize: 14, fontWeight: '500', color: Colors.textBody2 },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgWarm,
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  selectAllText: { fontSize: 14, color: Colors.sage, fontWeight: '500' },
  selectedCountText: { fontSize: 13, color: Colors.textMuted },
  selectedCountTextActive: { color: Colors.coral, fontWeight: '600' },
  scheduleCard: {
    backgroundColor: Colors.background,
    borderWidth: 0.5,
    borderColor: '#EDE8E3',
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
    shadowColor: '#3A3330',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  scheduleCardSelected: { backgroundColor: Colors.primaryTint, borderColor: Colors.primaryBorder },
  scheduleCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  scheduleCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    flexShrink: 0,
  },
  scheduleCheckboxSelected: { backgroundColor: Colors.checkboxActive, borderColor: Colors.checkboxActive },
  scheduleCheckmark: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  scheduleCardImg: { width: 64, height: 64, borderRadius: Radius.sm },
  scheduleCardInfo: { flex: 1, gap: 6 },
  scheduleCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  scheduleCardMetaRow: { flexDirection: 'row', alignItems: 'center' },
  scheduleCardMetaIcon: { width: 13, height: 13, marginRight: 4 },
  scheduleCardMetaText: { fontSize: 12, color: Colors.textBody2 },
  cardEditIconBtn: { padding: 4 },
  scheduleDetail: {
    borderTopWidth: 0.5,
    borderTopColor: '#EDE8E3',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  measureClone: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  timelineRowGap: { marginBottom: 20 },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  timelineDepartureDot: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDepartureDotText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  // 원 아래에서 다음 원 위까지 이어지도록 절대 위치로 배치 (thumb 48 - dot 28 만큼 위아래 여백 + 행 간격 20)
  timelineLine: {
    position: 'absolute',
    left: 13,
    top: 38,
    width: 2,
    height: 40,
    backgroundColor: Colors.primaryBorder,
  },
  timelineThumb: { width: 48, height: 48, borderRadius: Radius.sm },
  timelineText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textBody1 },
  editBtnIcon: { width: 15, height: 15 },
  routeBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBtnText: { fontSize: 14, fontWeight: '600', color: Colors.white },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: '#7F9E85',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7F9E85',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabIcon: { width: 24, height: 24, tintColor: Colors.white },
  deleteBar: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
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
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
  deleteBtnTextActive: { fontSize: 15, fontWeight: '600', color: Colors.coral },
});

// ─── 경로보기 스타일 (rv) ──────────────────────────────────────────────────────
const rv = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  overlaySafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: Spacing.xl,
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A3330',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  backArrow: { fontSize: 20, color: Colors.textBody1 },
  zoomContainer: {
    position: 'absolute',
    left: Spacing.xl,
    bottom: 24,
    width: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 251, 246, 0.92)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoomBtn: { height: 46, alignItems: 'center', justifyContent: 'center' },
  zoomDivider: { height: 1, backgroundColor: 'rgba(58, 51, 48, 0.12)', marginHorizontal: 8 },
  zoomBtnText: { fontSize: 22, lineHeight: 26, color: Colors.textBody1, fontWeight: '300' },
  locationBtn: {
    position: 'absolute',
    right: Spacing.xl,
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
  locationBtnTouchable: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  sheetBackground: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#3A3330',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 10,
  },
  handleArea: { paddingTop: 16, paddingBottom: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D9D4CF' },
  sheetContent: { paddingHorizontal: Spacing.xl, paddingBottom: 24 },
  stopBlock: { position: 'relative' },
  dashOverlay: { position: 'absolute', top: RV_DOT_SIZE + RV_LINE_GAP_TOP, left: 13 },
  stopRow: { flexDirection: 'row', gap: 12 },
  stopRail: { width: 28, alignItems: 'center' },
  departureRail: { minWidth: 28, alignItems: 'center' },
  stopDot: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopDotText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  stopDepartureDot: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopDepartureDotText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  dashLineContainer: {
    width: 2,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 3,
  },
  dashSegment: { width: 2, height: 3, borderRadius: 1, backgroundColor: Colors.primaryBorder },
  stopThumb: { width: 56, height: 56, borderRadius: Radius.sm },
  stopInfo: { flex: 1, gap: 6, paddingBottom: 20 },
  stopNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stopName: { fontSize: 15, fontWeight: '700', color: Colors.textBody1, flexShrink: 1 },
  catIcon: { width: 13, height: 13 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  walkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginLeft: 40,
    marginBottom: 14,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgWarm,
  },
  walkIcon: { width: 13, height: 13, alignSelf: 'center' },
  walkText: { fontSize: 12, lineHeight: 16, color: Colors.textMuted, textAlignVertical: 'center' },
});
