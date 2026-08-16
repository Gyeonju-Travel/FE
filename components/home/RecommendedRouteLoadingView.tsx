import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, SafeAreaView, DimensionValue } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import StepPawIcon from '@/assets/icons/step-paw.svg';
import ShieldCheckIcon from '@/assets/icons/shield-check.svg';
import LoadingPath from '@/assets/home/loading-path.svg';
import LoadingGarden from '@/assets/home/loading-garden.svg';
import LoadingLeaf from '@/assets/home/loading-leaf.svg';

// home_loading_line.svg(viewBox 0 0 252 358) 경로의 실제 베지어 곡선 위 좌표를 계산해서 잡은 위치.
const STEP_LABELS = ['출발지 분석중', '코스 탐색중', '컨디션 체크중', '추천 경로 설정 완료!'];
const STEP_POSITIONS: { top: DimensionValue; left: DimensionValue }[] = [
  { top: '0%', left: '4%' },
  { top: '15%', left: '58%' },
  { top: '68%', left: '62%' },
  { top: '94%', left: '10%' },
];

// 실제 생성 완료 여부와 무관하게, 화면에는 4단계를 순서대로 이 시간만큼씩 보여준다.
// 마지막 단계에 도달하면 실제로 결과가 올 때까지 그 자리에서 머문다(반복하지 않음).
const STEP_DISPLAY_MS = 700;

/** 4단계를 전부 보여주는 데 걸리는 최소 시간(ms). 실제 생성이 이보다 빨리 끝나도
 * 호출부(RecommendedRouteView)가 이 시간만큼은 로딩 화면을 유지해야 1~4단계가 다 보인다. */
export const MIN_LOADING_MS = STEP_DISPLAY_MS * 4;

const PATH_WIDTH = 260;
const PATH_HEIGHT = (PATH_WIDTH * 358) / 252;

// loading-leaf.svg는 좌우 잎사귀 뭉치가 한 파일(viewBox 0 0 220 23) 양 끝(0~18, 201~220)에
// 같이 들어있다. 전체를 작은 창(overflow: hidden)으로 잘라서 왼쪽/오른쪽 잎사귀 뭉치만 각각
// 보여주는 방식으로, "추천 경로를" 문장 좌우에 따옴표처럼 하나씩 배치한다.
const LEAF_WIDTH = 180;
const LEAF_HEIGHT = (LEAF_WIDTH * 23) / 220;
const LEAF_CLIP_WIDTH = 36;

const STEP_DOT_SIZE = 26;
const STEP_DOT_ACTIVE_SIZE = 38;

export default function RecommendedRouteLoadingView({ dogName }: { dogName: string }) {
  const [visualIndex, setVisualIndex] = useState(0);
  // 각 단계 원의 "활성화 정도"(0~1)를 따로 들고 있다가, 켜지고 꺼질 때 크기/색을 부드럽게 보간한다.
  const progressRefs = useRef(STEP_LABELS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const prevIndexRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisualIndex((prev) => (prev >= STEP_LABELS.length - 1 ? prev : prev + 1));
    }, STEP_DISPLAY_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (visualIndex === prevIndexRef.current) return;
    Animated.parallel([
      Animated.spring(progressRefs[prevIndexRef.current], {
        toValue: 0,
        useNativeDriver: false,
        friction: 7,
        tension: 60,
      }),
      Animated.spring(progressRefs[visualIndex], {
        toValue: 1,
        useNativeDriver: false,
        friction: 7,
        tension: 60,
      }),
    ]).start();
    prevIndexRef.current = visualIndex;
  }, [visualIndex, progressRefs]);

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.content}>
        <View style={s.line1Row}>
          <View style={s.leafClip}>
            <LoadingLeaf width={LEAF_WIDTH} height={LEAF_HEIGHT} />
          </View>
          <Text style={s.title}>
            <Text style={s.titleAccent}>추천 경로</Text>를
          </Text>
          <View style={s.leafClip}>
            <LoadingLeaf width={LEAF_WIDTH} height={LEAF_HEIGHT} style={s.leafRightInner} />
          </View>
        </View>
        <Text style={s.title}>구성하고 있어요!</Text>
        <Text style={s.subtitle}>잠시만 기다려 주세요</Text>

        <View style={s.pathBox}>
          <LoadingPath width={PATH_WIDTH} height={PATH_HEIGHT} style={s.pathSvg} />
          <LoadingGarden width={PATH_WIDTH * 0.92} height={(PATH_WIDTH * 0.92 * 161) / 280} style={s.garden} />

          {STEP_LABELS.map((label, i) => {
            const active = i === visualIndex;
            const pos = STEP_POSITIONS[i];
            const progress = progressRefs[i];
            const size = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [STEP_DOT_SIZE, STEP_DOT_ACTIVE_SIZE],
            });
            const backgroundColor = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [Colors.bgWarm, Colors.coral],
            });
            const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] });
            return (
              <View key={label} style={[s.stepMarker, { top: pos.top, left: pos.left }]}>
                <Animated.View style={[s.stepDot, { width: size, height: size, backgroundColor, shadowOpacity }]}>
                  <StepPawIcon width={13} height={12} color={active ? Colors.white : Colors.textMuted} />
                </Animated.View>
                <Text style={[s.stepLabel, active && s.stepLabelActive]}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={s.hintPill}>
        <ShieldCheckIcon width={14} height={16} color={Colors.secondaryBorder} />
        <Text style={s.hintPillText} numberOfLines={1}>
          {dogName}에게 맞는 맞춤 코스를 선별하는 중이에요
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: Spacing.xl },
  line1Row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  leafClip: { width: LEAF_CLIP_WIDTH, height: LEAF_HEIGHT, overflow: 'hidden' },
  leafRightInner: { marginLeft: -(LEAF_WIDTH - LEAF_CLIP_WIDTH) },
  title: { fontSize: 26, fontWeight: '600', color: Colors.textBody1, textAlign: 'center', lineHeight: 34 },
  titleAccent: { color: Colors.coral },
  subtitle: { fontSize: 16, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },
  pathBox: {
    width: PATH_WIDTH,
    height: PATH_HEIGHT,
    marginTop: Spacing.xl,
  },
  pathSvg: { position: 'absolute', top: 0, left: 0 },
  garden: {
    position: 'absolute',
    top: '30%',
    left: '4%',
  },
  stepMarker: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stepDot: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A3330',
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  stepLabel: { fontSize: 11, fontWeight: '500', color: Colors.textMuted },
  stepLabelActive: { fontSize: 13, fontWeight: '700', color: Colors.coral },
  hintPill: {
    width: '92%',
    maxWidth: 358,
    height: 52,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  hintPillText: { fontSize: 13, color: Colors.textBody2 },
});
