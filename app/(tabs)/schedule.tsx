import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { SavedPlace } from '@/types/save';
import { Schedule } from '@/types/schedule';
import { MOCK_SAVED_PLACES } from '@/mock/savedPlaces';
import WheelPicker, { PICKER_H } from '@/components/schedule/WheelPicker';
import Badge, { BADGE_TONE_COLORS } from '@/components/ui/Badge';
import Toast from '@/components/ui/Toast';
import EditScheduleView from '@/components/schedule/EditScheduleView';
import { PLACE_TAG_STYLE, DEFAULT_PLACE_TAG_STYLE } from '@/constants/badgeConfig';

// ─── 상수 ───────────────────────────────────────────────────────────────────
const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];
const DEPARTURE_OPTIONS = ['황리단길', '금리단길', '첨성대', '교촌마을'];
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
      <Image source={{ uri: place.imageUri }} style={cs.placeImg} resizeMode="cover" />
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
                  cfg.icon ? (
                    <Image
                      source={cfg.icon}
                      style={[cs.tagIcon, { tintColor: BADGE_TONE_COLORS[cfg.tone].text }]}
                      resizeMode="contain"
                    />
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
  onEdit,
}: {
  schedule: Schedule;
  onEdit: () => void;
}) {
  const lastPlace = schedule.places[schedule.places.length - 1];
  const title = lastPlace
    ? `${schedule.departureLabel} → ${lastPlace.name} 코스`
    : schedule.departureLabel;
  const durationHours = Math.max(1, schedule.places.length - 1);

  return (
    <View style={ss.scheduleCard}>
      <View style={ss.scheduleCardRow}>
        <Image
          source={{ uri: schedule.places[0]?.imageUri }}
          style={ss.scheduleCardImg}
          resizeMode="cover"
        />
        <View style={ss.scheduleCardInfo}>
          <Text style={ss.scheduleCardTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={ss.scheduleCardMetaRow}>
            <Image
              source={require('@/assets/icons/location.png')}
              style={[ss.scheduleCardMetaIcon, { tintColor: Colors.textBody2 }]}
              resizeMode="contain"
            />
            <Text style={ss.scheduleCardMetaText}>{schedule.places.length}곳 경유</Text>
            <Image
              source={require('@/assets/icons/clock.png')}
              style={[ss.scheduleCardMetaIcon, { tintColor: Colors.textBody2, marginLeft: 10 }]}
              resizeMode="contain"
            />
            <Text style={ss.scheduleCardMetaText}>약 {durationHours}시간</Text>
          </View>
        </View>
      </View>

      <View style={ss.scheduleDetail}>
        {schedule.places.map((place, i) => {
          const isLast = i === schedule.places.length - 1;
          return (
            <View key={place.id} style={[ss.timelineRow, !isLast && ss.timelineRowGap]}>
              <View style={ss.timelineDot}>
                <Text style={ss.timelineDotText}>{i + 1}</Text>
              </View>
              {!isLast && <View style={ss.timelineLine} />}
              <Image source={{ uri: place.imageUri }} style={ss.timelineThumb} resizeMode="cover" />
              <Text style={ss.timelineText} numberOfLines={1}>
                {place.name}
              </Text>
            </View>
          );
        })}

        <TouchableOpacity style={ss.editBtn} activeOpacity={0.85} onPress={onEdit}>
          <Image
            source={require('@/assets/icons/pencil.png')}
            style={[ss.editBtnIcon, { tintColor: Colors.coral }]}
            resizeMode="contain"
          />
          <Text style={ss.editBtnText}>수정하기</Text>
        </TouchableOpacity>
      </View>
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

  const maxSelectable = Math.min(MAX_PLACES, MOCK_SAVED_PLACES.length);

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
    if (MOCK_SAVED_PLACES.length > MAX_PLACES) {
      setToastMsg(`장소는 최대 ${MAX_PLACES}개까지만 선택할 수 있어요.`);
    }
    setSelectedIds(new Set(MOCK_SAVED_PLACES.slice(0, maxSelectable).map((p) => p.id)));
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
        places={MOCK_SAVED_PLACES.filter((p) => selectedIds.has(p.id))}
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
      >
        {/* 출발지 설정 */}
        <Text style={cs.sectionLabel}>출발지 설정</Text>
        <TouchableOpacity style={cs.selectorRow} onPress={openLocation} activeOpacity={0.8}>
          <Image
            source={require('@/assets/icons/location.png')}
            style={[cs.rowIcon, { tintColor: Colors.textBody2 }]}
            resizeMode="contain"
          />
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
          <Image
            source={require('@/assets/icons/clock.png')}
            style={[cs.rowIcon, { tintColor: Colors.textBody2 }]}
            resizeMode="contain"
          />
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
        {MOCK_SAVED_PLACES.map((place) => {
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
                    onPress={() => day && setSelectedDate({ year, month, day })}
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
              <Image
                source={require('@/assets/icons/tab-schedule.png')}
                style={[ss.dayHeaderIcon, { tintColor: Colors.textBody1 }]}
                resizeMode="contain"
              />
              <Text style={ss.dayHeaderText}>
                {selectedDate.month + 1}월 {selectedDate.day}일 (
                {DOW_KR[new Date(selectedDate.year, selectedDate.month, selectedDate.day).getDay()]})
              </Text>
              <Text style={ss.dayHeaderCount}> · {daySchedules.length}개 일정</Text>
            </View>
            {daySchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                onEdit={() => setEditingSchedule(schedule)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={ss.emptyCard}>
            <Image
              source={require('@/assets/icons/tab-schedule.png')}
              style={ss.emptyIcon}
              resizeMode="contain"
            />
            <Text style={ss.emptyTitle}>저장된 일정이 없어요</Text>
            <Text style={ss.emptySubtitle}>새 일정 탭에서 일정을 만들어 보세요</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={ss.fab} activeOpacity={0.85} onPress={() => setShowCreate(true)}>
        <Image source={require('@/assets/icons/add.png')} style={ss.fabIcon} resizeMode="contain" />
      </TouchableOpacity>
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
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: 120 },
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
  rowIcon: { width: 16, height: 16 },
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
    marginBottom: Spacing.md,
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
  emptyCard: { backgroundColor: Colors.bgWarm, borderRadius: Radius.lg, paddingVertical: 40, alignItems: 'center', gap: 6 },
  emptyIcon: { width: 32, height: 32, marginBottom: 4, tintColor: Colors.coral },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: Colors.textMuted },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: 6,
  },
  dayHeaderIcon: { width: 16, height: 16 },
  dayHeaderText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  dayHeaderCount: { fontSize: 13, color: Colors.textMuted },
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
  scheduleCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  scheduleCardImg: { width: 64, height: 64, borderRadius: Radius.sm },
  scheduleCardInfo: { flex: 1, gap: 6 },
  scheduleCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  scheduleCardMetaRow: { flexDirection: 'row', alignItems: 'center' },
  scheduleCardMetaIcon: { width: 13, height: 13, marginRight: 4 },
  scheduleCardMetaText: { fontSize: 12, color: Colors.textBody2 },
  scheduleDetail: {
    borderTopWidth: 0.5,
    borderTopColor: '#EDE8E3',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
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
  editBtn: {
    flexDirection: 'row',
    marginTop: 16,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editBtnIcon: { width: 15, height: 15 },
  editBtnText: { fontSize: 14, fontWeight: '600', color: Colors.coral },
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
});
