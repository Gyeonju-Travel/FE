import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  PanResponder,
  Easing,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import WheelPicker from '@/components/schedule/WheelPicker';
import ScheduleDepartureIcon from '@/assets/icons/schedule-departure.svg';
import ScheduleDateIcon from '@/assets/icons/schedule-date.svg';
import ConditionBestIcon from '@/assets/home/condition-best.svg';
import ConditionNormalIcon from '@/assets/home/condition-normal.svg';
import ConditionBadIcon from '@/assets/home/condition-bad.svg';
import Toast from '@/components/ui/Toast';

const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];
const DEPARTURE_OPTIONS = ['황리단길', '금리단길', '첨성대', '교촌마을'];
const YEAR_BASE = 2024;
const YEARS = Array.from({ length: 6 }, (_, i) => `${YEAR_BASE + i}년`);
const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
const getDaysCount = (yi: number, mi: number) => new Date(YEAR_BASE + yi, mi + 1, 0).getDate();
const getDaysArr = (yi: number, mi: number) =>
  Array.from({ length: getDaysCount(yi, mi) }, (_, i) => `${i + 1}일`);
const formatDate = (yi: number, mi: number, di: number) => {
  const d = new Date(YEAR_BASE + yi, mi, di + 1);
  return `${YEAR_BASE + yi}년 ${mi + 1}월 ${di + 1}일 ${DOW_KR[d.getDay()]}`;
};

const SHEET_OFFSCREEN_Y = 500;

type Condition = 'best' | 'normal' | 'bad';
const CONDITION_OPTIONS: { id: Condition; label: string; Icon: React.FC<{ width?: number; height?: number }> }[] = [
  { id: 'best', label: '최고', Icon: ConditionBestIcon },
  { id: 'normal', label: '보통', Icon: ConditionNormalIcon },
  { id: 'bad', label: '나쁨', Icon: ConditionBadIcon },
];

export default function RecommendedRouteView({ dogName, onBack }: { dogName: string; onBack: () => void }) {
  const now = new Date();
  const currentYearIdx = Math.min(Math.max(now.getFullYear() - YEAR_BASE, 0), YEARS.length - 1);
  const currentMonthIdx = now.getMonth();
  const currentDayIdx = now.getDate() - 1;

  const [departureIdx, setDepartureIdx] = useState<number | null>(null);
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const [yearIdx, setYearIdx] = useState(currentYearIdx);
  const [monthIdx, setMonthIdx] = useState(currentMonthIdx);
  const [dayIdx, setDayIdx] = useState(currentDayIdx);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [pickerType, setPickerType] = useState<'location' | 'date' | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetY = useRef(new Animated.Value(SHEET_OFFSCREEN_Y)).current;
  const lastPickerType = useRef<'location' | 'date'>('location');
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

  const [tDep, setTDep] = useState(0);
  const [tYear, setTYear] = useState(currentYearIdx);
  const [tMonth, setTMonth] = useState(currentMonthIdx);
  const [tDay, setTDay] = useState(currentDayIdx);

  const openLocation = () => {
    setTDep(departureIdx ?? 0);
    setPickerType('location');
  };
  const openDate = () => {
    setTYear(yearIdx);
    setTMonth(monthIdx);
    setTDay(dayIdx);
    setPickerType('date');
  };
  const confirmLocation = () => {
    setDepartureIdx(tDep);
    setPickerType(null);
  };
  const confirmDate = () => {
    setYearIdx(tYear);
    setMonthIdx(tMonth);
    setDayIdx(Math.min(tDay, getDaysCount(tYear, tMonth) - 1));
    setDateConfirmed(true);
    setPickerType(null);
  };

  // 오늘 이전 연/월/일은 선택할 수 없다.
  const monthMinIndex = tYear === currentYearIdx ? currentMonthIdx : 0;
  const dayMinIndex = tYear === currentYearIdx && tMonth === currentMonthIdx ? currentDayIdx : 0;

  const dateText = dateConfirmed ? formatDate(yearIdx, monthIdx, dayIdx) : null;

  const handleCreateSchedule = () => {
    if (departureIdx === null) {
      setToastMsg('출발지를 선택해주세요.');
      return;
    }
    if (!dateConfirmed) {
      setToastMsg('날짜를 선택해주세요.');
      return;
    }
    if (!condition) {
      setToastMsg(`${dogName}의 오늘 컨디션을 선택해주세요.`);
      return;
    }
    setToastMsg('추천 경로를 준비하고 있어요. 곧 만나요!');
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>홈</Text>
      </View>

      <View style={s.content}>
        <Text style={s.sectionLabel}>출발지 설정</Text>
        <TouchableOpacity style={s.selectorRow} onPress={openLocation} activeOpacity={0.8}>
          <ScheduleDepartureIcon width={16} height={16} color={Colors.textBody2} />
          {departureIdx !== null ? (
            <Text style={s.selectorText}>{DEPARTURE_OPTIONS[departureIdx]}</Text>
          ) : (
            <Text style={s.selectorPlaceholder}>출발지를 선택해주세요.</Text>
          )}
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>

        <Text style={[s.sectionLabel, { marginTop: Spacing.xl }]}>날짜 선택</Text>
        <TouchableOpacity style={s.selectorRow} onPress={openDate} activeOpacity={0.8}>
          <ScheduleDateIcon width={16} height={16} color={Colors.textBody2} />
          {dateText ? (
            <Text style={s.selectorText}>{dateText}</Text>
          ) : (
            <Text style={s.selectorPlaceholder}>날짜를 선택해주세요.</Text>
          )}
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>

        <Text style={[s.sectionLabel, { marginTop: Spacing.xl }]}>{dogName}의 오늘 컨디션은?</Text>
        <View style={s.conditionRow}>
          {CONDITION_OPTIONS.map((opt) => {
            const selected = condition === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[s.conditionCard, selected && s.conditionCardSelected]}
                activeOpacity={0.85}
                onPress={() => setCondition(opt.id)}
              >
                <opt.Icon width={88} height={64} />
                <Text style={[s.conditionLabel, selected && s.conditionLabelSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={s.bottomBar}>
        <TouchableOpacity style={s.createBtn} activeOpacity={0.85} onPress={handleCreateSchedule}>
          <Text style={s.createBtnText}>일정 만들기 →</Text>
        </TouchableOpacity>
      </View>

      <Toast message={toastMsg} onHide={() => setToastMsg(null)} bottom={90} />

      {sheetVisible && (
        <>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={closeSheet} />
          <Animated.View style={[s.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={s.sheetHandleArea} {...sheetPanResponder.panHandlers}>
              <View style={s.sheetHandle} />
            </View>
            {lastPickerType.current === 'location' ? (
              <>
                <Text style={s.sheetTitle}>출발지 설정</Text>
                <WheelPicker data={DEPARTURE_OPTIONS} selectedIdx={tDep} onSelect={setTDep} />
                <TouchableOpacity style={s.confirmBtn} onPress={confirmLocation}>
                  <Text style={s.confirmText}>확인</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.sheetTitle}>날짜 선택</Text>
                <Text style={s.datePreview}>{formatDate(tYear, tMonth, tDay)}</Text>
                <View style={s.dateRow}>
                  <WheelPicker
                    key="yr"
                    data={YEARS}
                    selectedIdx={tYear}
                    flex={1}
                    minIndex={currentYearIdx}
                    onSelect={(i) => {
                      setTYear(i);
                      const minMo = i === currentYearIdx ? currentMonthIdx : 0;
                      if (tMonth < minMo) setTMonth(minMo);
                      const max = getDaysCount(i, Math.max(tMonth, minMo)) - 1;
                      if (tDay > max) setTDay(max);
                    }}
                  />
                  <WheelPicker
                    key="mo"
                    data={MONTHS}
                    selectedIdx={tMonth}
                    flex={1}
                    minIndex={monthMinIndex}
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
                    minIndex={dayMinIndex}
                    onSelect={setTDay}
                  />
                </View>
                <TouchableOpacity style={s.confirmBtn} onPress={confirmDate}>
                  <Text style={s.confirmText}>확인</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  content: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
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
  conditionRow: { flexDirection: 'row', gap: Spacing.sm },
  conditionCard: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  conditionCardSelected: { borderColor: Colors.coral, borderWidth: 1.5, backgroundColor: '#F8F5F0' },
  conditionLabel: { fontSize: 14, color: Colors.textBody2 },
  conditionLabelSelected: { color: Colors.textBody1, fontWeight: '700' },
  bottomBar: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
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
