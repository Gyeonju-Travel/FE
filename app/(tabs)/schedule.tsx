import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { SavedPlace } from '@/types/save';
import { MOCK_SAVED_PLACES } from '@/mock/savedPlaces';
import WheelPicker, { PICKER_H } from '@/components/schedule/WheelPicker';

// ─── 상수 ───────────────────────────────────────────────────────────────────
const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];
const DEPARTURE_OPTIONS = ['경주역', '황리단길', '불국사', '동궁과 월지', '숙소'];
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

const TAG_BG: Record<string, string> = {
  '전 구역': Colors.secondaryTint,
  '야외만': Colors.secondaryTint,
  '이동장 필수': Colors.primaryTint,
  '목줄 필수': Colors.primaryTint,
};
const TAG_DOT: Record<string, string> = {
  '전 구역': Colors.sage,
  '야외만': Colors.sage,
  '이동장 필수': Colors.coral,
  '목줄 필수': Colors.coral,
};

// ─── PlaceCard ───────────────────────────────────────────────────────────────
function PlaceCard({
  place,
  selected,
  onToggle,
}: {
  place: SavedPlace;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[cs.placeCard, selected && cs.placeCardSelected]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <View style={[cs.checkbox, selected && cs.checkboxFilled]}>
        {selected && <Text style={cs.checkmark}>✓</Text>}
      </View>
      <Image source={{ uri: place.imageUri }} style={cs.placeImg} resizeMode="cover" />
      <View style={cs.placeInfo}>
        <Text style={cs.placeName} numberOfLines={1}>
          {place.name}
        </Text>
        <View style={cs.placeTags}>
          {place.tags.map((tag) => (
            <View
              key={tag}
              style={[cs.tag, { backgroundColor: TAG_BG[tag] ?? Colors.primaryTint }]}
            >
              <View style={[cs.tagDot, { backgroundColor: TAG_DOT[tag] ?? Colors.coral }]} />
              <Text style={cs.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={cs.heart}>♡</Text>
    </TouchableOpacity>
  );
}

// ─── CreateScheduleView ───────────────────────────────────────────────────────
function CreateScheduleView({ onBack }: { onBack: () => void }) {
  const now = new Date();
  const [departureIdx, setDepartureIdx] = useState(0);
  const [yearIdx, setYearIdx] = useState(0);
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [dayIdx, setDayIdx] = useState(now.getDate() - 1);
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['1']));
  const [pickerType, setPickerType] = useState<'location' | 'date' | null>(null);

  // 임시 상태 (picker 열린 동안)
  const [tDep, setTDep] = useState(0);
  const [tYear, setTYear] = useState(0);
  const [tMonth, setTMonth] = useState(now.getMonth());
  const [tDay, setTDay] = useState(now.getDate() - 1);

  const openLocation = () => { setTDep(departureIdx); setPickerType('location'); };
  const openDate = () => { setTYear(yearIdx); setTMonth(monthIdx); setTDay(dayIdx); setPickerType('date'); };

  const confirmLocation = () => { setDepartureIdx(tDep); setPickerType(null); };
  const confirmDate = () => {
    setYearIdx(tYear);
    setMonthIdx(tMonth);
    setDayIdx(Math.min(tDay, getDaysCount(tYear, tMonth) - 1));
    setDateConfirmed(true);
    setPickerType(null);
  };

  const togglePlace = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () =>
    setSelectedIds(
      selectedIds.size === MOCK_SAVED_PLACES.length
        ? new Set()
        : new Set(MOCK_SAVED_PLACES.map((p) => p.id))
    );

  const dateText = dateConfirmed ? formatPreview(yearIdx, monthIdx, dayIdx) : null;

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
          <Text style={cs.selectorText}>{DEPARTURE_OPTIONS[departureIdx]}</Text>
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
        {MOCK_SAVED_PLACES.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            selected={selectedIds.has(place.id)}
            onToggle={() => togglePlace(place.id)}
          />
        ))}
      </ScrollView>

      {/* 일정 만들기 버튼 */}
      <View style={cs.bottomBar}>
        <TouchableOpacity style={cs.createBtn} activeOpacity={0.85}>
          <Text style={cs.createBtnText}>일정 만들기 →</Text>
        </TouchableOpacity>
      </View>

      {/* 출발지 Picker 모달 */}
      <Modal
        visible={pickerType === 'location'}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerType(null)}
      >
        <View style={cs.modalWrapper}>
          <TouchableOpacity
            style={cs.backdrop}
            activeOpacity={1}
            onPress={() => setPickerType(null)}
          />
          <View style={cs.sheet}>
            <View style={cs.sheetHandle} />
            <Text style={cs.sheetTitle}>출발지 설정</Text>
            <WheelPicker
              key={`loc-${pickerType}`}
              data={DEPARTURE_OPTIONS}
              selectedIdx={tDep}
              onSelect={setTDep}
            />
            <TouchableOpacity style={cs.confirmBtn} onPress={confirmLocation}>
              <Text style={cs.confirmText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 날짜 Picker 모달 */}
      <Modal
        visible={pickerType === 'date'}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerType(null)}
      >
        <View style={cs.modalWrapper}>
          <TouchableOpacity
            style={cs.backdrop}
            activeOpacity={1}
            onPress={() => setPickerType(null)}
          />
          <View style={cs.sheet}>
            <View style={cs.sheetHandle} />
            <Text style={cs.datePreview}>{formatPreview(tYear, tMonth, tDay)}</Text>
            <View style={cs.dateRow}>
              <WheelPicker
                key={`yr-${pickerType}`}
                data={YEARS}
                selectedIdx={tYear}
                onSelect={(i) => {
                  setTYear(i);
                  const max = getDaysCount(i, tMonth) - 1;
                  if (tDay > max) setTDay(max);
                }}
              />
              <WheelPicker
                key={`mo-${pickerType}`}
                data={MONTHS}
                selectedIdx={tMonth}
                onSelect={(i) => {
                  setTMonth(i);
                  const max = getDaysCount(tYear, i) - 1;
                  if (tDay > max) setTDay(max);
                }}
              />
              <WheelPicker
                key={`dy-${pickerType}-${tYear}-${tMonth}`}
                data={getDaysArr(tYear, tMonth)}
                selectedIdx={Math.min(tDay, getDaysCount(tYear, tMonth) - 1)}
                onSelect={setTDay}
              />
            </View>
            <TouchableOpacity style={cs.confirmBtn} onPress={confirmDate}>
              <Text style={cs.confirmText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  const [showCreate, setShowCreate] = useState(false);

  if (showCreate) {
    return <CreateScheduleView onBack={() => setShowCreate(false)} />;
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

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

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
                const todayCell = day !== null && isToday(day);
                return (
                  <TouchableOpacity
                    key={ci}
                    style={ss.dayCell}
                    activeOpacity={day ? 0.7 : 1}
                    disabled={!day}
                  >
                    <View style={[ss.dayInner, todayCell && ss.todayCircle]}>
                      <Text style={[ss.dayText, ci === 0 && ss.sundayText, todayCell && ss.todayText]}>
                        {day ?? ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <View style={ss.emptyCard}>
          <Image
            source={require('@/assets/icons/tab-schedule.png')}
            style={ss.emptyIcon}
            resizeMode="contain"
          />
          <Text style={ss.emptyTitle}>저장된 일정이 없어요</Text>
          <Text style={ss.emptySubtitle}>새 일정 탭에서 일정을 만들어 보세요</Text>
        </View>
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
  checkmark: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  placeImg: { width: 64, height: 64, borderRadius: Radius.sm },
  placeInfo: { flex: 1, gap: 6 },
  placeName: { fontSize: 14, fontWeight: '600', color: Colors.textBody1 },
  placeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagDot: { width: 5, height: 5, borderRadius: 3 },
  tagText: { fontSize: 10, color: Colors.textBody2 },
  heart: { fontSize: 20, color: Colors.coral, opacity: 0.4 },
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
  // 모달
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D9D4CF',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
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
  emptyCard: { backgroundColor: Colors.bgWarm, borderRadius: Radius.lg, paddingVertical: 40, alignItems: 'center', gap: 6 },
  emptyIcon: { width: 32, height: 32, marginBottom: 4, tintColor: Colors.coral },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: Colors.textMuted },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.coral,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabIcon: { width: 24, height: 24, tintColor: Colors.white },
});
