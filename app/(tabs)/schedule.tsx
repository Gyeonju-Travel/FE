import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { SavedPlace } from '@/types/save';
import { Schedule } from '@/types/schedule';
import { MapPlace } from '@/types/map';
import {
  getBookmarks,
  ApiError,
  previewSchedule,
  previewScheduleUpdate,
  createSchedule,
  updateSchedule,
  getSchedulesByDate,
  deleteSchedules,
  SchedulePreviewResponse,
  getHome,
  startSchedule,
  visitPlace,
  addScheduleFootprints,
  getStampAlbum,
  getPlaceDetail,
} from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { onTabReset } from '@/utils/tabReset';
import { GEOFENCE_ATTRACTIONS, stampIndexFromBackendName } from '@/constants/stamps';
import { ScrapData } from '@/types/stampAlbum';
import StampAlbumScreen from '@/components/mypage/StampAlbumView';
import { toSavedPlace } from '@/utils/placeMappers';
import {
  DEPARTURE_OPTIONS,
  labelToDepartureArea,
  departureAreaToLabel,
  toIsoDate,
  toSchedule,
  fetchDeparturePlaces,
} from '@/utils/scheduleMappers';
import WheelPicker, { PICKER_H } from '@/components/schedule/WheelPicker';
import Badge, { BADGE_TONE_COLORS } from '@/components/ui/Badge';
import Toast from '@/components/ui/Toast';
import AlertCard from '@/components/ui/AlertCard';
import ModalWarningIcon from '@/assets/icons/modal-warning.svg';
import SwipeBackScreen from '@/components/ui/SwipeBackScreen';
import EditScheduleView from '@/components/schedule/EditScheduleView';
import PlaceThumbnail from '@/components/ui/PlaceThumbnail';
import { PLACE_TAG_STYLE, DEFAULT_PLACE_TAG_STYLE, CATEGORY_BADGE_STYLE } from '@/constants/badgeConfig';
import KakaoMap, { KakaoMapHandle } from '@/components/map/KakaoMap';
import { haversineMeters, estimateWalkMinutes, formatDistance, formatWalkDuration } from '@/utils/distance';
import { fetchPedestrianRoute, LatLng, PedestrianRouteResult } from '@/utils/pedestrianRoute';
import {
  getArrivedPlaceIds,
  setActiveSchedule,
  getActiveScheduleId,
  cancelActiveSchedule,
  getTodaysScrapSchedule,
  getAutoEndedScheduleId,
  TodaysScrapSchedule,
  StartTrackingResult,
  SCRAP_REMINDER_HOUR,
  simulateArrivalAtNextPlace,
  simulateArrivalAtCoordinate,
} from '@/utils/locationTracking';
import TodayScrapView from '@/components/home/TodayScrapView';
import ScheduleWaypointIcon from '@/assets/icons/schedule-waypoint.svg';
import ScheduleTimeIcon from '@/assets/icons/schedule-time.svg';
import ScheduleEditIcon from '@/assets/icons/schedule-edit.svg';
import ScheduleStartIcon from '@/assets/icons/schedule-start.svg';
import ScheduleDepartureIcon from '@/assets/icons/schedule-departure.svg';
import ScheduleDateIcon from '@/assets/icons/schedule-date.svg';
import WalkingIcon from '@/assets/icons/walking.svg';
import MapMyLocationIcon from '@/assets/icons/map-mylocation.svg';
import TabScheduleIcon from '@/assets/icons/tab-schedule.svg';
import BinIcon from '@/assets/icons/bin.svg';
import ScheduleEmptyIllustration from '@/assets/schedule/empty-illustration.svg';
import ToastDepartureIcon from '@/assets/icons/toast/departure.svg';
import ToastPlaceLimitIcon from '@/assets/icons/toast/place-limit.svg';
import ToastScheduleSavedIcon from '@/assets/icons/toast/schedule-saved.svg';
import ToastScheduleAddedIcon from '@/assets/icons/toast/schedule-added.svg';

// ─── 상수 ───────────────────────────────────────────────────────────────────
const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];

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
  onStart,
  onViewRoute,
  onViewRecord,
  onTestComplete,
  onSimulateArrival,
  onCancel,
  isTraveling,
  isEnded,
  isPast,
  isEditMode,
  isSelected,
  onToggleSelect,
}: {
  schedule: Schedule;
  departurePlaces: Record<string, MapPlace>;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onStart: () => void;
  onViewRoute: () => void;
  onViewRecord: () => void;
  onTestComplete: () => void;
  onSimulateArrival: () => void;
  onCancel: () => void;
  isTraveling: boolean;
  isEnded: boolean;
  isPast: boolean;
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
        <PlaceThumbnail uri={departurePlace?.imageUri ?? null} style={ss.scheduleCardImg} />
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
            <Text style={ss.scheduleCardMetaText}>
              약 {durationText}
            </Text>
          </View>
        </View>
        {!isEditMode && !expanded && isEnded && (
          <TouchableOpacity
            style={ss.cardStartBtn}
            activeOpacity={0.85}
            onPress={onViewRecord}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[ss.cardStartIconWrap, ss.cardTravelingIconWrap]}>
              <ScheduleStartIcon width={13} height={13} />
            </View>
            <Text style={ss.cardTravelingBtnText}>기록보기</Text>
          </TouchableOpacity>
        )}
        {!isEditMode && !expanded && !isEnded && isTraveling && (
          <TouchableOpacity
            style={ss.cardStartBtn}
            activeOpacity={0.7}
            onPress={onCancel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[ss.cardStartIconWrap, ss.cardTravelingIconWrap]}>
              <ScheduleStartIcon width={13} height={13} />
            </View>
            <Text style={ss.cardTravelingBtnText}>여행중</Text>
          </TouchableOpacity>
        )}
        {!isEditMode && !expanded && !isEnded && !isTraveling && (
          <TouchableOpacity
            style={ss.cardStartBtn}
            activeOpacity={0.85}
            onPress={onStart}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={ss.cardStartIconWrap}>
              <ScheduleStartIcon width={13} height={13} />
            </View>
            <Text style={ss.cardStartBtnText}>시작</Text>
          </TouchableOpacity>
        )}
        {!isEditMode && expanded && !isTraveling && (
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

      {isPast && !isTraveling && !isEnded && (
        <TouchableOpacity style={ss.cardTestBtn} activeOpacity={0.7} onPress={onTestComplete}>
          <Text style={ss.cardTestBtnText}>테스트: 이 일정 완료 처리 (기록에 반영)</Text>
        </TouchableOpacity>
      )}

      {isTraveling && !isEnded && (
        <TouchableOpacity style={ss.cardTestBtn} activeOpacity={0.7} onPress={onSimulateArrival}>
          <Text style={ss.cardTestBtnText}>테스트: 다음 목적지 도착 처리</Text>
        </TouchableOpacity>
      )}

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
  initialDate,
  underlay,
}: {
  onBack: () => void;
  onSave: (dateStr: string) => void;
  initialSchedule?: Schedule;
  /** 달력에서 미리 선택해둔 날짜 — 새 일정 만들기 시작 시 기본값으로 쓴다 (수정 시엔 무시). */
  initialDate?: { year: number; month: number; day: number };
  underlay?: React.ReactNode;
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
    initialSchedule
      ? initialSchedule.year - YEAR_BASE
      : initialDate
      ? initialDate.year - YEAR_BASE
      : currentYearIdx
  );
  const [monthIdx, setMonthIdx] = useState(
    initialSchedule ? initialSchedule.month : initialDate ? initialDate.month : now.getMonth()
  );
  const [dayIdx, setDayIdx] = useState(
    initialSchedule ? initialSchedule.day - 1 : initialDate ? initialDate.day - 1 : now.getDate() - 1
  );
  const [dateConfirmed, setDateConfirmed] = useState(!!initialSchedule || !!initialDate);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSchedule?.places.map((p) => p.id))
  );
  const [pickerType, setPickerType] = useState<'location' | 'date' | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastSubtitle, setToastSubtitle] = useState<string | undefined>(undefined);
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
        const bookmarked = result.map(toSavedPlace);
        setSavedPlaces(bookmarked);
        // 서버는 "지금 저장(북마크)돼 있는 장소"만 일정에 넣을 수 있게 한다 — 원래 일정에 있던
        // 장소가 그 사이 저장 해제됐으면 선택 목록에서 빼야 수정 저장 시 거부당하지 않는다.
        if (initialSchedule) {
          const bookmarkedIds = new Set(bookmarked.map((p) => p.id));
          const stillValid = initialSchedule.places.filter((p) => bookmarkedIds.has(p.id));
          setSelectedIds(new Set(stillValid.map((p) => p.id)));
          if (stillValid.length < initialSchedule.places.length) {
            setToastMsg('일부 장소는 저장이 해제돼 선택에서 빠졌어요.');
            setToastSubtitle('다시 넣으려면 저장(북마크)부터 해주세요.');
          }
        }
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

  // 서버가 오늘 이전 날짜의 일정 생성/수정을 거부한다. minIndex로 "비활성화 후 스냅백"하면
  // 스크롤 도중 애니메이션이 겹쳐서 버벅이므로, 과거 연/월/일 항목 자체를 휠 목록에서 뺀다
  // (아래 date 피커 JSX에서 slicedYears/slicedMonths/slicedDays로 사용).
  const currentMonthIdx = now.getMonth();
  const currentDayIdx = now.getDate() - 1;
  const yearFloorIdx = currentYearIdx;
  const monthFloorIdx = tYear === currentYearIdx ? currentMonthIdx : 0;
  const dayFloorIdx = tYear === currentYearIdx && tMonth === currentMonthIdx ? currentDayIdx : 0;

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
        setToastMsg('장소가 너무 많아요!');
        setToastSubtitle(`장소는 최대 ${MAX_PLACES}개까지만 선택할 수 있어요.`);
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
      setToastMsg('장소가 너무 많아요!');
      setToastSubtitle(`장소는 최대 ${MAX_PLACES}개까지만 선택할 수 있어요.`);
    }
    setSelectedIds(new Set(savedPlaces.slice(0, maxSelectable).map((p) => p.id)));
  };

  const [showEdit, setShowEdit] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<SchedulePreviewResponse | null>(null);

  const handleCreateSchedule = async () => {
    if (departureIdx === null) {
      setToastMsg('출발지를 입력해 주세요!');
      setToastSubtitle(undefined);
      return;
    }
    if (!dateConfirmed) {
      setToastMsg('날짜를 선택해주세요.');
      setToastSubtitle(undefined);
      return;
    }
    if (selectedIds.size === 0) {
      setToastMsg('장소를 선택해주세요.');
      setToastSubtitle(undefined);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setToastMsg('로그인 정보가 없어요. 다시 로그인해주세요.');
      setToastSubtitle(undefined);
      return;
    }

    setPreviewing(true);
    try {
      const body = {
        departureArea: labelToDepartureArea(DEPARTURE_OPTIONS[departureIdx]),
        date: toIsoDate(yearIdx + YEAR_BASE, monthIdx, dayIdx + 1),
        placeIds: Array.from(selectedIds).map(Number),
      };
      const result =
        isEditing && initialSchedule
          ? await previewScheduleUpdate(Number(initialSchedule.id), body, token)
          : await previewSchedule(body, token);
      setPreview(result);
      setShowEdit(true);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '일정을 만들지 못했어요. 잠시 후 다시 시도해주세요.';
      setToastMsg(message);
      setToastSubtitle(undefined);
    } finally {
      setPreviewing(false);
    }
  };

  const dateText = dateConfirmed ? formatPreview(yearIdx, monthIdx, dayIdx) : null;

  // 스와이프 뒤로가기 중 뒤에 깔아 보여줄 이 화면(일정 만들기 입력 폼) 자체. 아래 순서 편집
  // 화면(EditScheduleView)의 underlay로 재사용한다.
  const formScreen = (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
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
        <TouchableOpacity
          style={[cs.createBtn, previewing && cs.createBtnDisabled]}
          activeOpacity={0.85}
          disabled={previewing}
          onPress={handleCreateSchedule}
        >
          {previewing ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={cs.createBtnText}>{isEditing ? '일정 수정하기 →' : '일정 만들기 →'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <Toast
        message={toastMsg}
        subtitle={toastSubtitle}
        onHide={() => {
          setToastMsg(null);
          setToastSubtitle(undefined);
        }}
        icon={
          toastMsg === '출발지를 입력해 주세요!' ? (
            <ToastDepartureIcon width={18} height={22} />
          ) : toastMsg === '장소가 너무 많아요!' ? (
            <ToastPlaceLimitIcon width={21} height={23} />
          ) : undefined
        }
      />

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
                    data={YEARS.slice(yearFloorIdx)}
                    selectedIdx={Math.max(0, tYear - yearFloorIdx)}
                    flex={1}
                    onSelect={(i) => {
                      const y = i + yearFloorIdx;
                      setTYear(y);
                      const m = y === currentYearIdx ? Math.max(tMonth, currentMonthIdx) : tMonth;
                      setTMonth(m);
                      const max = getDaysCount(y, m) - 1;
                      const dFloor = y === currentYearIdx && m === currentMonthIdx ? currentDayIdx : 0;
                      if (tDay > max || tDay < dFloor) setTDay(Math.min(Math.max(tDay, dFloor), max));
                    }}
                  />
                  <WheelPicker
                    key={`mo-${tYear}`}
                    data={MONTHS.slice(monthFloorIdx)}
                    selectedIdx={Math.max(0, tMonth - monthFloorIdx)}
                    flex={1}
                    onSelect={(i) => {
                      const m = i + monthFloorIdx;
                      setTMonth(m);
                      const max = getDaysCount(tYear, m) - 1;
                      const dFloor = tYear === currentYearIdx && m === currentMonthIdx ? currentDayIdx : 0;
                      if (tDay > max || tDay < dFloor) setTDay(Math.min(Math.max(tDay, dFloor), max));
                    }}
                  />
                  <WheelPicker
                    key={`dy-${tYear}-${tMonth}`}
                    data={getDaysArr(tYear, tMonth).slice(dayFloorIdx)}
                    selectedIdx={Math.max(0, Math.min(tDay, getDaysCount(tYear, tMonth) - 1) - dayFloorIdx)}
                    flex={1}
                    onSelect={(i) => setTDay(i + dayFloorIdx)}
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
    </SwipeBackScreen>
  );

  if (showEdit && departureIdx !== null && preview) {
    const selectedPlaces = savedPlaces.filter((p) => selectedIds.has(p.id));
    const orderedPlaces = preview.recommendedPlaces
      .slice()
      .sort((a, b) => a.visitOrder - b.visitOrder)
      .map((rp) => selectedPlaces.find((p) => p.id === String(rp.placeId)))
      .filter((p): p is SavedPlace => !!p);

    return (
      <EditScheduleView
        departureLabel={DEPARTURE_OPTIONS[departureIdx]}
        departureCoord={{ lat: preview.departure.latitude, lng: preview.departure.longitude }}
        departureImageUri={departurePlaces[DEPARTURE_OPTIONS[departureIdx]]?.imageUri ?? null}
        places={orderedPlaces}
        isEditing={isEditing}
        submitting={submitting}
        onBack={() => {
          setShowEdit(false);
          setPreview(null);
        }}
        onSaved={async (finalPlaces) => {
          const token = await getAccessToken();
          if (!token) {
            setToastMsg('로그인 정보가 없어요. 다시 로그인해주세요.');
            setToastSubtitle(undefined);
            return;
          }
          setSubmitting(true);
          try {
            const createBody = {
              matrixToken: preview.matrixToken,
              orderedPlaceIds: finalPlaces.map((p) => Number(p.id)),
            };
            const newDateStr = toIsoDate(yearIdx + YEAR_BASE, monthIdx, dayIdx + 1);
            if (isEditing && initialSchedule) {
              await updateSchedule(Number(initialSchedule.id), createBody, token);
              const oldDateStr = toIsoDate(initialSchedule.year, initialSchedule.month, initialSchedule.day);
              if (oldDateStr !== newDateStr) onSave(oldDateStr);
            } else {
              await createSchedule(createBody, token);
            }
            onSave(newDateStr);
            onBack();
          } catch (e) {
            const message = e instanceof ApiError ? e.message : '일정 저장에 실패했어요. 잠시 후 다시 시도해주세요.';
            setToastMsg(message);
            setToastSubtitle(undefined);
          } finally {
            setSubmitting(false);
          }
        }}
        underlay={formScreen}
      />
    );
  }

  return formScreen;
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
  underlay,
}: {
  schedule: Schedule;
  departurePlaces: Record<string, MapPlace>;
  onBack: () => void;
  underlay?: React.ReactNode;
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

  // 목적지 도착 감지(지오펜싱) 상태 — 감지 시작 트리거는 별도로 붙일 예정이라
  // 여기서는 이미 도착한 장소 표시(체크마크)만 반영한다.
  const [arrivedPlaceIds, setArrivedPlaceIds] = useState<string[]>([]);

  useEffect(() => {
    getArrivedPlaceIds(schedule.id).then(setArrivedPlaceIds);
  }, [schedule.id]);

  // 이름 검색(departurePlaces)은 검색 결과가 엉뚱한 장소로 매칭될 수 있어, 좌표는 서버가 실제로
  // 사용한 출발지 좌표(schedule.departureLatitude/Longitude)를 신뢰한다. 썸네일 사진은 이름 검색
  // 결과가 있으면 그대로 쓴다(없어도 좌표에는 영향 없음).
  const departurePlace = departurePlaces[schedule.departureLabel];
  const departureCoord = { lat: schedule.departureLatitude, lng: schedule.departureLongitude };
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
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
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
                  <View style={[rv.stopDot, arrivedPlaceIds.includes(place.id) && rv.stopDotArrived]}>
                    <Text style={rv.stopDotText}>{arrivedPlaceIds.includes(place.id) ? '✓' : i + 1}</Text>
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
              </RouteStopBlock>
            );
          })}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
    </SwipeBackScreen>
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
  // 날짜(YYYY-MM-DD)별로 캐싱한다 — 서버가 날짜 단위 조회만 지원해서, 달력에 표시할
  // 월 전체를 하루씩 병렬로 조회해 채운다.
  const [scheduleCache, setScheduleCache] = useState<Record<string, Schedule[]>>({});
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastSubtitle, setToastSubtitle] = useState<string | undefined>(undefined);
  const [viewingRouteSchedule, setViewingRouteSchedule] = useState<Schedule | null>(null);
  const [departurePlaces, setDeparturePlaces] = useState<Record<string, MapPlace>>({});
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [autoEndedScheduleId, setAutoEndedScheduleId] = useState<string | null>(null);
  // "여행중" 버튼을 한 번 더 누르면 바로 취소하지 않고, 진행 중인 일정이 초기화된다는 걸
  // 확인받는 모달을 먼저 띄운다.
  const [cancelConfirmSchedule, setCancelConfirmSchedule] = useState<Schedule | null>(null);
  // 다른 일정이 이미 진행 중일 때 "시작"을 누르면 기존 진행 중인 일정이 조용히 초기화돼서
  // 잘못 누르기 쉽다 — 이때도 먼저 확인 모달을 띄운다.
  const [startConfirmSchedule, setStartConfirmSchedule] = useState<Schedule | null>(null);
  const [scrapView, setScrapView] = useState<{
    pending: TodaysScrapSchedule;
    dogName: string;
    dogProfileImageUri?: string;
    accessToken: string;
  } | null>(null);
  const [viewingRecord, setViewingRecord] = useState<{
    scrap: ScrapData;
    scheduleId: number;
    accessToken: string;
  } | null>(null);
  const schedules = useMemo(() => Object.values(scheduleCache).flat(), [scheduleCache]);

  // 일정 상세 API는 장소 카테고리를 안 내려줘서(toSchedule은 임시로 '관광지'로 채워둠),
  // placeId별로 실제 카테고리를 조회해 채운다. 세션 동안 재사용하도록 캐싱한다.
  const placeCategoryCacheRef = useRef<Map<string, SavedPlace['category']>>(new Map());

  const enrichPlaceCategories = async (scheduleList: Schedule[], token: string): Promise<Schedule[]> => {
    const cache = placeCategoryCacheRef.current;
    const uncachedIds = Array.from(
      new Set(scheduleList.flatMap((s) => s.places.map((p) => p.id)).filter((id) => !cache.has(id)))
    );
    if (uncachedIds.length > 0) {
      await Promise.all(
        uncachedIds.map(async (id) => {
          try {
            const detail = await getPlaceDetail(Number(id), token);
            cache.set(id, (detail.categoryLabel as SavedPlace['category']) ?? '관광지');
          } catch (e) {
            // 카테고리 조회 실패 — 이 장소는 이번엔 그냥 기본값(관광지)으로 남겨둔다
          }
        })
      );
    }
    return scheduleList.map((s) => ({
      ...s,
      places: s.places.map((p) => ({ ...p, category: cache.get(p.id) ?? p.category })),
    }));
  };

  const fetchDateSchedules = async (dateStr: string) => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const result = await getSchedulesByDate(dateStr, token);
      const scheduleList = await enrichPlaceCategories(result.schedules.map(toSchedule), token);
      setScheduleCache((prev) => ({ ...prev, [dateStr]: scheduleList }));
    } catch (e) {
      // 하루 조회 실패는 조용히 무시 — 달력의 다른 날짜에는 영향 없음
    }
  };

  const fetchMonthSchedules = async (y: number, m: number) => {
    const days = getDaysInMonth(y, m);
    await Promise.all(
      Array.from({ length: days }, (_, i) => i + 1).map((day) => fetchDateSchedules(toIsoDate(y, m, day)))
    );
  };

  useEffect(() => {
    fetchDeparturePlaces().then(setDeparturePlaces);
  }, []);

  // 다른 화면(홈의 AI 추천경로 저장 등)에서 일정을 추가/종료/변경했을 수 있어, 이 탭에 올 때마다
  // 여행중인 일정과 이번 달 일정 목록을 다시 확인한다.
  useFocusEffect(
    useCallback(() => {
      getActiveScheduleId().then(setActiveScheduleId);
      getAutoEndedScheduleId().then(setAutoEndedScheduleId);
      fetchMonthSchedules(year, month);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, month])
  );

  useEffect(() => {
    fetchMonthSchedules(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const exitScheduleEditMode = () => {
    setIsEditMode(false);
    setSelectedScheduleIds(new Set());
  };

  // 일정 탭 아이콘을 다시 누르면 일정 만들기/편집/경로보기 화면을 닫고 첫 화면(달력)으로 되돌아간다.
  useEffect(
    () =>
      onTabReset('schedule', () => {
        setShowCreate(false);
        setEditingSchedule(null);
        setViewingRouteSchedule(null);
        exitScheduleEditMode();
      }),
    []
  );

  const toggleScheduleSelect = (id: string) => {
    setSelectedScheduleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const handleDeleteSchedules = async () => {
    const idsToDelete = new Set(selectedScheduleIds);
    const token = await getAccessToken();
    exitScheduleEditMode();
    if (!token) return;
    try {
      await deleteSchedules(Array.from(idsToDelete).map(Number), token);
      setScheduleCache((prev) => {
        const next: Record<string, Schedule[]> = {};
        for (const [dateStr, list] of Object.entries(prev)) {
          next[dateStr] = list.filter((s) => !idsToDelete.has(s.id));
        }
        return next;
      });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '일정 삭제에 실패했어요. 잠시 후 다시 시도해주세요.';
      setToastMsg(message);
      setToastSubtitle(undefined);
    }
  };

  const handleStartSchedule = async (schedule: Schedule) => {
    const result: StartTrackingResult = await setActiveSchedule(schedule);
    if (result === 'started') {
      setActiveScheduleId(schedule.id);
      setToastMsg('일정을 시작했어요! 도착하면 알려드릴게요.');
    } else if (result === 'no-places') {
      setActiveScheduleId(schedule.id);
      setToastMsg('이미 모든 장소에 도착했어요!');
    } else {
      setToastMsg('위치 접근 권한(항상 허용)이 필요해요. 설정에서 허용해주세요.');
    }
    setToastSubtitle(undefined);
  };

  // 이미 다른 일정이 진행 중일 때 "시작"을 누르면 그 일정이 조용히 초기화되므로, 먼저 확인
  // 모달을 띄운다. 진행 중인 일정이 없으면(또는 같은 일정이면) 바로 시작한다.
  const handleStartPress = (schedule: Schedule) => {
    if (activeScheduleId && activeScheduleId !== schedule.id) {
      setStartConfirmSchedule(schedule);
      return;
    }
    handleStartSchedule(schedule);
  };

  const handleConfirmStartSchedule = async () => {
    const schedule = startConfirmSchedule;
    if (!schedule) return;
    setStartConfirmSchedule(null);
    // 진행 중이던 일정을 실제로 취소(도착 기록·발자취 초기화)한 다음에 새 일정을 시작해야
    // 모달에서 안내한 "진행 중인 일정은 초기화돼요"가 실제로 이뤄진다. 이걸 안 하면 이전
    // 일정으로 다시 돌아왔을 때 이미 다 도착한 것으로 남아있게 된다.
    if (activeScheduleId && activeScheduleId !== schedule.id) {
      await cancelActiveSchedule(activeScheduleId);
      setActiveScheduleId(null);
    }
    await handleStartSchedule(schedule);
  };

  const handleCancelSchedule = (schedule: Schedule) => {
    setCancelConfirmSchedule(schedule);
  };

  const handleConfirmCancelSchedule = async () => {
    const schedule = cancelConfirmSchedule;
    if (!schedule) return;
    setCancelConfirmSchedule(null);
    const cancelled = await cancelActiveSchedule(schedule.id);
    if (cancelled) {
      setActiveScheduleId(null);
      setToastMsg('일정 시작을 취소했어요.');
      setToastSubtitle(undefined);
    }
  };

  // 개발용: 실제로 이동하지 않고도 다음 목적지에 도착한 것으로 처리해 스탬프/방문 기록을 테스트한다.
  const handleSimulateArrival = async () => {
    const placeName = await simulateArrivalAtNextPlace();
    setToastMsg(placeName ? `${placeName} 도착 처리했어요.` : '진행 중인 목적지가 없어요.');
    setToastSubtitle(undefined);
  };

  // 개발용: 경주 밖이라 실제 GPS로 테스트를 못 할 때, 위도/경도를 직접 입력해서 그 지점에
  // 있는 것처럼 관광지 스탬프·일정 도착 판정을 한 번 돌려본다.
  const [devLat, setDevLat] = useState('');
  const [devLng, setDevLng] = useState('');
  const handleSimulateCoordinate = async () => {
    const lat = Number(devLat);
    const lng = Number(devLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setToastMsg('위도/경도를 숫자로 입력해주세요.');
      setToastSubtitle(undefined);
      return;
    }
    const results = await simulateArrivalAtCoordinate({ lat, lng });
    setToastMsg(results.length > 0 ? results.join(', ') : '이 좌표 근처엔 아무것도 없어요.');
    setToastSubtitle(undefined);
  };

  const handleViewRecord = async (schedule: Schedule) => {
    const token = await getAccessToken();
    if (!token) {
      setToastMsg('로그인 정보가 없어요. 다시 로그인해주세요.');
      setToastSubtitle(undefined);
      return;
    }
    const isToday =
      schedule.year === today.getFullYear() &&
      schedule.month === today.getMonth() &&
      schedule.day === today.getDate();

    if (isToday) {
      const pending = await getTodaysScrapSchedule(schedule.id);
      if (!pending) {
        setToastMsg('스크랩 정보를 찾을 수 없어요.');
        setToastSubtitle(undefined);
        return;
      }
      try {
        const home = await getHome(token);
        setScrapView({
          pending,
          dogName: home.petName,
          dogProfileImageUri: home.petProfileImageUrl ?? undefined,
          accessToken: token,
        });
      } catch (e) {
        const message = e instanceof ApiError ? e.message : '기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
        setToastMsg(message);
        setToastSubtitle(undefined);
      }
      return;
    }

    // 지난 날짜 일정은 로컬에 스크랩 대상 정보가 없다(TODAYS_SCRAP_SCHEDULE_KEY는 "오늘"만 유지) —
    // 서버에 저장된 스탬프 앨범을 그대로 읽기 전용으로 보여준다(마이페이지 여행기록과 동일한 방식).
    try {
      const [home, album, arrivedIds] = await Promise.all([
        getHome(token),
        getStampAlbum(Number(schedule.id), token),
        getArrivedPlaceIds(schedule.id),
      ]);
      // 목적지로 저장은 해놨지만 실제로 안 간 곳은 경로에서 뺀다 — 출발지는 항상 실제로 거쳤으니
      // 예외. (기기를 바꿨거나 로컬 도착 기록이 지워졌으면 필터링 없이 저장된 장소 전부가 뜬다.)
      const visitedPlaces = schedule.places.filter((p) => arrivedIds.includes(p.id));
      setViewingRecord({
        scheduleId: Number(schedule.id),
        accessToken: token,
        scrap: {
          id: schedule.id,
          title: '오늘의 경주',
          travelDate: album.date.replace(/-/g, ' · '),
          dogName: home.petName,
          dogProfileImageUri: home.petProfileImageUrl ?? undefined,
          selectedPhotoUris: album.photoUrls,
          // 경로보기(RouteView)와 동일하게 출발지를 첫 지점으로 포함해야 경로/핀 번호가 맞게 표시된다.
          // 좌표는 이름 검색(departurePlaces) 대신 서버가 실제로 사용한 출발지 좌표를 신뢰한다.
          stops: [
            {
              id: 'departure',
              name: schedule.departureLabel,
              latitude: schedule.departureLatitude,
              longitude: schedule.departureLongitude,
            },
            ...visitedPlaces.map((p) => ({
              id: p.id,
              name: p.name,
              latitude: p.latitude,
              longitude: p.longitude,
            })),
          ],
          totalDistanceInMeters: album.totalDistanceMeters,
          stampIndex: stampIndexFromBackendName(album.stampName),
        },
      });
    } catch (e) {
      // STAMP_400_7: 시작만 하고 저장한 장소를 한 곳도 방문하지 않은 일정은 서버에 스탬프 앨범
      // 자체가 안 만들어져서, 지난 날짜인데도 "오후 9시 이후에 조회 가능" 문구가 그대로 내려온다.
      // 이 경우엔 그 문구 대신, 다녀온 곳이 없다는 걸 있는 그대로 안내한다.
      const message =
        e instanceof ApiError && e.code === 'STAMP_400_7'
          ? '이 날은 다녀온 곳이 없어서 기록이 없어요.'
          : e instanceof ApiError
            ? e.message
            : '기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
      setToastMsg(message);
      setToastSubtitle(undefined);
    }
  };

  // 개발용: 지난 일정을 실제로 여행하지 않고도 "완료" 상태로 만들어 마이페이지 여행기록에서 확인할 수 있게 한다.
  // 백엔드는 시작된(started) 일정 중 날짜가 지난 것을 자동으로 완료 처리하므로(StampService.completedSchedules),
  // 시작 + 각 장소 방문 기록만 실제 API로 남기면 된다 — 로컬 데이터 조작이 아니라 실제 서버 데이터다.
  const handleTestComplete = async (schedule: Schedule) => {
    const token = await getAccessToken();
    if (!token) {
      setToastMsg('로그인 정보가 없어요. 다시 로그인해주세요.');
      setToastSubtitle(undefined);
      return;
    }
    try {
      const started = await startSchedule(Number(schedule.id), token);
      // 방문 기록(visits)은 스탬프 대상 관광지(GEOFENCE_ATTRACTIONS)에만 의미가 있다 — 식당/카페 등
      // 스탬프 대상이 아닌 장소로 호출하면 백엔드가 STAMP_400_6("스탬프를 받을 수 있는 관광지가
      // 아닙니다")로 거부한다(정상 동작). 여행기록에 남기는 데는 시작 처리만으로 충분하니 여기선
      // 스탬프 대상 장소만 골라서 호출한다.
      const stampPlaceIds = new Set(
        GEOFENCE_ATTRACTIONS.filter((a) => !a.isProxyLocation).map((a) => a.placeId)
      );
      const visitCalls = started.places
        .filter((p) => stampPlaceIds.has(p.placeId))
        .map((p) => ({ placeId: p.placeId, latitude: p.latitude, longitude: p.longitude }));

      // 출발지도 관광지 중 하나일 수 있다(예: 교촌마을에서 출발). departure 응답엔 placeId가 없어서
      // 이름으로 GEOFENCE_ATTRACTIONS에서 매칭하고, 방문 좌표는 그 관광지의 등록된 좌표를 그대로 쓴다.
      const departureLabel = departureAreaToLabel(started.departure.code);
      const departureAttraction = GEOFENCE_ATTRACTIONS.find((a) => a.name === departureLabel);
      if (departureAttraction?.placeId != null) {
        visitCalls.push({
          placeId: departureAttraction.placeId,
          latitude: departureAttraction.latitude,
          longitude: departureAttraction.longitude,
        });
      }

      await Promise.all(
        visitCalls.map((v) =>
          visitPlace(v.placeId, { scheduleId: started.scheduleId, latitude: v.latitude, longitude: v.longitude }, token).catch(
            () => {}
          )
        )
      );

      // 실제로 걷지 않아서 서버 누적 거리가 0으로 남으면 발자국 개수도 0으로 떠서, 출발지→각
      // 장소를 잇는 직선거리 합계만큼 발자국 기록도 같이 남긴다.
      const footprintStops = [
        { lat: started.departure.latitude, lng: started.departure.longitude },
        ...started.places.map((p) => ({ lat: p.latitude, lng: p.longitude })),
      ];
      const totalDistanceMeters = footprintStops
        .slice(0, -1)
        .reduce(
          (sum, from, i) => sum + haversineMeters(from.lat, from.lng, footprintStops[i + 1].lat, footprintStops[i + 1].lng),
          0
        );
      if (totalDistanceMeters > 0) {
        await addScheduleFootprints(started.scheduleId, Math.round(totalDistanceMeters), token).catch(() => {});
      }

      // started 값을 반영해서 카드가 "시작" 대신 "기록보기"로 바로 바뀌게 이 날짜만 다시 불러온다.
      await fetchDateSchedules(toIsoDate(schedule.year, schedule.month, schedule.day));
      setToastMsg('테스트 완료 처리했어요. 마이페이지 여행기록에서도 확인해보세요.');
      setToastSubtitle(undefined);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '완료 처리에 실패했어요.';
      setToastMsg(message);
      setToastSubtitle(undefined);
    }
  };

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  // 지난 날짜는 서버가 일정 생성을 거부한다(날짜는 오늘 이후여야 함) — 캘린더에서 지난 날짜를
  // 선택했을 땐 만들기 버튼을 아예 눌러도 소용없게 미리 막는다.
  const isSelectedDatePast =
    new Date(selectedDate.year, selectedDate.month, selectedDate.day) <
    new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // 스와이프 뒤로가기 중 뒤에 깔아 보여줄 일정 탭 기본(달력) 화면. 아래 early-return 분기들
  // (경로보기, 일정 만들기/수정, 오늘의 기록, 지난 기록보기)의 underlay로 재사용한다.
  const baseScreen = (
    <SafeAreaView style={ss.safeArea}>
      <View style={ss.container}>
        <Text style={ss.pageTitle}>나의 일정</Text>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* 개발용: 경주 밖에 있을 때 좌표를 직접 입력해서 GPS 판정을 테스트한다. */}
        <View style={ss.devCoordRow}>
          <TextInput
            style={ss.devCoordInput}
            placeholder="위도 (예: 35.8343745)"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation"
            value={devLat}
            onChangeText={setDevLat}
          />
          <TextInput
            style={ss.devCoordInput}
            placeholder="경도 (예: 129.2185645)"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation"
            value={devLng}
            onChangeText={setDevLng}
          />
          <TouchableOpacity style={ss.devCoordBtn} activeOpacity={0.7} onPress={handleSimulateCoordinate}>
            <Text style={ss.devCoordBtnText}>테스트</Text>
          </TouchableOpacity>
        </View>

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
          <>
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
                onStart={() => handleStartPress(schedule)}
                onViewRoute={() => setViewingRouteSchedule(schedule)}
                onViewRecord={() => handleViewRecord(schedule)}
                onTestComplete={() => handleTestComplete(schedule)}
                onSimulateArrival={handleSimulateArrival}
                onCancel={() => handleCancelSchedule(schedule)}
                isTraveling={schedule.id === activeScheduleId}
                // "기록보기"로 바뀌는 조건: (오늘 일정이면) 시작한 채로 21시(스크랩 알림 시각)를
                // 넘겼거나 경주 이탈로 자동 종료됐거나, (지난 날짜 일정이면) 이미 시작(started)돼서
                // 백엔드가 완료로 간주하는 경우.
                isEnded={
                  schedule.started &&
                  (new Date(schedule.year, schedule.month, schedule.day) <
                    new Date(today.getFullYear(), today.getMonth(), today.getDate()) ||
                    (schedule.year === today.getFullYear() &&
                      schedule.month === today.getMonth() &&
                      schedule.day === today.getDate() &&
                      (today.getHours() >= SCRAP_REMINDER_HOUR || schedule.id === autoEndedScheduleId)))
                }
                isPast={new Date(schedule.year, schedule.month, schedule.day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())}
                isEditMode={isEditMode}
                isSelected={selectedScheduleIds.has(schedule.id)}
                onToggleSelect={() => toggleScheduleSelect(schedule.id)}
              />
            ))}
          </>
        ) : (
          <View style={ss.emptyCard}>
            <ScheduleEmptyIllustration width={280} height={141} style={{ marginBottom: Spacing.md }} />
            <Text style={ss.emptyTitle}>저장된 일정이 없어요</Text>
            <Text style={ss.emptySubtitle}>하단 + 버튼을 누른 후 새 일정을 만들어 보세요</Text>
          </View>
        )}
        </ScrollView>
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
        <TouchableOpacity
          style={[ss.fab, isSelectedDatePast && ss.fabDisabled]}
          activeOpacity={isSelectedDatePast ? 1 : 0.85}
          disabled={isSelectedDatePast}
          onPress={() => setShowCreate(true)}
        >
          <Image source={require('@/assets/icons/add.png')} style={ss.fabIcon} resizeMode="contain" />
        </TouchableOpacity>
      )}

      <Toast
        message={toastMsg}
        subtitle={toastSubtitle}
        onHide={() => {
          setToastMsg(null);
          setToastSubtitle(undefined);
        }}
        bottom={20}
        icon={
          toastMsg === '일정이 저장됐어요!' ? (
            <ToastScheduleSavedIcon width={21} height={22} />
          ) : toastMsg === '일정이 추가됐어요!' ? (
            <ToastScheduleAddedIcon width={21} height={22} />
          ) : undefined
        }
      />

      <Modal
        visible={!!cancelConfirmSchedule}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelConfirmSchedule(null)}
      >
        <View style={ss.cancelConfirmBackdrop}>
          <AlertCard
            icon={<ModalWarningIcon width={64} height={64} />}
            iconStandalone
            title="정말 초기화하시겠어요?"
            subtitle={'취소하면 지금까지 기록된\n진행 중인 일정이 초기화돼요.'}
            buttons={[
              { label: '계속 진행하기', onPress: () => setCancelConfirmSchedule(null), variant: 'outline' },
              { label: '초기화하기', onPress: handleConfirmCancelSchedule, tone: 'coral' },
            ]}
          />
        </View>
      </Modal>

      <Modal
        visible={!!startConfirmSchedule}
        transparent
        animationType="fade"
        onRequestClose={() => setStartConfirmSchedule(null)}
      >
        <View style={ss.cancelConfirmBackdrop}>
          <AlertCard
            icon={<ModalWarningIcon width={64} height={64} />}
            iconStandalone
            title="이 일정을 시작하시겠어요?"
            subtitle={'다른 일정이 진행 중이에요.\n지금 시작하면 진행 중인 일정은 초기화돼요.'}
            buttons={[
              { label: '취소', onPress: () => setStartConfirmSchedule(null), variant: 'outline' },
              { label: '시작하기', onPress: handleConfirmStartSchedule, tone: 'coral' },
            ]}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );

  if (viewingRouteSchedule) {
    return (
      <RouteView
        schedule={viewingRouteSchedule}
        departurePlaces={departurePlaces}
        onBack={() => setViewingRouteSchedule(null)}
        underlay={baseScreen}
      />
    );
  }

  if (showCreate || editingSchedule) {
    return (
      <CreateScheduleView
        initialSchedule={editingSchedule ?? undefined}
        initialDate={editingSchedule ? undefined : selectedDate}
        onBack={() => {
          setShowCreate(false);
          setEditingSchedule(null);
        }}
        onSave={(dateStr) => {
          fetchDateSchedules(dateStr);
          setToastMsg(editingSchedule ? '일정이 저장됐어요!' : '일정이 추가됐어요!');
          setToastSubtitle(undefined);
        }}
        underlay={baseScreen}
      />
    );
  }

  if (scrapView) {
    return (
      <TodayScrapView
        pending={scrapView.pending}
        dogName={scrapView.dogName}
        dogProfileImageUri={scrapView.dogProfileImageUri}
        accessToken={scrapView.accessToken}
        onBack={() => setScrapView(null)}
        underlay={baseScreen}
      />
    );
  }

  if (viewingRecord) {
    return (
      <StampAlbumScreen
        scrap={viewingRecord.scrap}
        onBack={() => setViewingRecord(null)}
        underlay={baseScreen}
        serverSave={{ scheduleId: viewingRecord.scheduleId, accessToken: viewingRecord.accessToken }}
      />
    );
  }

  return baseScreen;
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
    // 태그가 많아서 줄바꿈되면(예: 월정교) 카드가 그만큼 늘어나야 하므로 height가 아니라 minHeight.
    minHeight: 88,
    backgroundColor: Colors.background,
    borderWidth: 0.5,
    borderColor: '#EDE8E3',
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
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
  createBtnDisabled: { opacity: 0.6 },
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
  cancelConfirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(58,51,48,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
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
  cardStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryTint,
    borderRadius: Radius.full,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
  },
  cardStartIconWrap: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: Colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStartBtnText: { fontSize: 13, fontWeight: '700', color: Colors.coral },
  cardTravelingIconWrap: { backgroundColor: Colors.textMuted },
  cardTravelingBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  cardTestBtn: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  cardTestBtnText: { fontSize: 11, color: Colors.secondaryDark, textDecorationLine: 'underline' },
  devCoordRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  devCoordInput: {
    flex: 1,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    fontSize: 12,
    color: Colors.textBody1,
  },
  devCoordBtn: {
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devCoordBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textBody1 },
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
  fabDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
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
  stopDotArrived: { backgroundColor: Colors.secondary },
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
