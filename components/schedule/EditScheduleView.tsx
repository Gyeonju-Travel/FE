import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  PanResponderInstance,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { SavedPlace } from '@/types/save';
import WalkingIcon from '@/assets/icons/walking.svg';
import Badge, { BADGE_TONE_COLORS } from '@/components/ui/Badge';
import PlaceThumbnail from '@/components/ui/PlaceThumbnail';
import { PLACE_TAG_STYLE, DEFAULT_PLACE_TAG_STYLE } from '@/constants/badgeConfig';
import { haversineMeters, estimateWalkMinutes, formatDistance } from '@/utils/distance';

const DEPARTURE_HEIGHT = 88;
const CARD_HEIGHT = 88;
const PILL_HEIGHT = 34;
const ROW_GAP = 12;
// 출발지 → 첫 장소 구간도 장소↔장소 구간과 동일하게 도보 배지가 껴서 모든 구간이 균일한 슬롯이다.
const FIRST_PLACE_OFFSET = DEPARTURE_HEIGHT + ROW_GAP + PILL_HEIGHT + ROW_GAP;
const PLACE_SLOT = CARD_HEIGHT + ROW_GAP + PILL_HEIGHT + ROW_GAP;
const DEPARTURE_ID = '__departure__';
const LONG_PRESS_MS = 250;

function slotHeightAt(index: number): number {
  return index === 0 ? DEPARTURE_HEIGHT : CARD_HEIGHT;
}

function slotY(index: number): number {
  if (index === 0) return 0;
  return FIRST_PLACE_OFFSET + (index - 1) * PLACE_SLOT;
}

interface RowItem {
  id: string;
  place?: SavedPlace;
}

interface Props {
  departureLabel: string;
  departureCoord?: { lat: number; lng: number };
  departureImageUri?: string | null;
  /** 이미 서버가 추천한(또는 이전 저장된) 순서대로 정렬되어 들어온다. */
  places: SavedPlace[];
  isEditing?: boolean;
  submitting?: boolean;
  onBack: () => void;
  onSaved: (places: SavedPlace[]) => void;
}

function GripDots() {
  return (
    <View style={styles.grip}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.gripDot} />
      ))}
    </View>
  );
}

export default function EditScheduleView({
  departureLabel,
  departureCoord,
  departureImageUri,
  places,
  isEditing,
  submitting,
  onBack,
  onSaved,
}: Props) {
  const [order, setOrder] = useState<RowItem[]>(() => [
    { id: DEPARTURE_ID },
    ...places.map((p) => ({ id: p.id, place: p })),
  ]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const orderRef = useRef(order);
  orderRef.current = order;
  const draggingIdRef = useRef<string | null>(null);

  const positions = useRef<Record<string, Animated.Value>>({}).current;
  const responders = useRef<Record<string, PanResponderInstance>>({}).current;
  const activationOffset = useRef(0);
  // 드래그가 시작된 시점의 인덱스 — 드래그 도중 배열 순서가 바뀌어도 이 값을 기준으로 위치를 계산해야
  // 손가락 움직임과 끊김 없이 이어짐 (매번 최신 인덱스를 다시 찾으면 순서가 바뀔 때마다 위치가 튄다)
  const dragStartIndex = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getPosition = (id: string, index: number) => {
    if (!positions[id]) positions[id] = new Animated.Value(slotY(index));
    return positions[id];
  };

  useEffect(() => {
    order.forEach((item, index) => {
      if (item.id === draggingId) return;
      const pos = getPosition(item.id, index);
      Animated.timing(pos, { toValue: slotY(index), duration: 200, useNativeDriver: true }).start();
    });
  }, [order, draggingId]);

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const finishDrag = () => {
    draggingIdRef.current = null;
    setDraggingId(null);
  };

  const getResponder = (id: string) => {
    if (responders[id]) return responders[id];

    responders[id] = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gestureState) => {
        clearLongPressTimer();
        longPressTimer.current = setTimeout(() => {
          draggingIdRef.current = id;
          dragStartIndex.current = orderRef.current.findIndex((it) => it.id === id);
          activationOffset.current = gestureState.dy;
          setDraggingId(id);
        }, LONG_PRESS_MS);
      },
      onPanResponderMove: (_, gestureState) => {
        if (draggingIdRef.current !== id) return;
        const rawY =
          slotY(dragStartIndex.current) + (gestureState.dy - activationOffset.current);
        getPosition(id, dragStartIndex.current).setValue(rawY);

        // index 0은 출발지 고정 자리라 장소는 그 아래로만 이동 가능. 장소 슬롯은 모두 균일한
        // 간격(PLACE_SLOT)이라 첫 장소 기준 오프셋만 빼주면 바로 인덱스로 환산된다.
        const targetIndex = Math.max(
          1,
          Math.min(
            Math.round((rawY - FIRST_PLACE_OFFSET) / PLACE_SLOT) + 1,
            orderRef.current.length - 1
          )
        );
        const currentIndex = orderRef.current.findIndex((it) => it.id === id);
        if (targetIndex !== currentIndex) {
          setOrder((prev) => {
            const idx = prev.findIndex((it) => it.id === id);
            if (idx === -1 || idx === targetIndex) return prev;
            const next = [...prev];
            const [moved] = next.splice(idx, 1);
            next.splice(targetIndex, 0, moved);
            return next;
          });
        }
      },
      onPanResponderRelease: () => {
        clearLongPressTimer();
        if (draggingIdRef.current !== id) return;
        const finalIndex = orderRef.current.findIndex((it) => it.id === id);
        if (finalIndex !== -1) {
          Animated.timing(getPosition(id, finalIndex), {
            toValue: slotY(finalIndex),
            duration: 180,
            useNativeDriver: true,
          }).start();
        }
        finishDrag();
      },
      onPanResponderTerminate: () => {
        clearLongPressTimer();
        finishDrag();
      },
      // 드래그 핸들이 반응자를 잡은 뒤에는 감싸고 있는 ScrollView가 세로 스크롤로 가로채지 못하게 막는다.
      onPanResponderTerminationRequest: () => false,
    });

    return responders[id];
  };

  const removePlace = (id: string) => {
    setOrder((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <SafeAreaView style={es.safeArea}>
      <View style={es.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={es.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={es.headerTitle}>나의 일정</Text>
      </View>

      <View style={es.hintRow}>
        <GripDots />
        <Text style={es.hintText}>길게 눌러 순서 변경</Text>
      </View>

      <ScrollView
        style={es.listScroll}
        contentContainerStyle={es.listScrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={draggingId === null}
      >
      <View
        style={[
          es.listArea,
          { height: slotY(order.length - 1) + slotHeightAt(order.length - 1) },
        ]}
      >
        {order.map((item, index) => {
          const pos = getPosition(item.id, index);
          const isDragging = draggingId === item.id;
          // 다음 항목이 있으면(=마지막이 아니면) 그 사이에 도보 배지가 낀다.
          // 출발지(item.place 없음) → 첫 장소 구간도 departureCoord가 있으면 동일하게 계산한다.
          const nextItem = order[index + 1];
          const fromCoord = item.place
            ? { lat: item.place.latitude, lng: item.place.longitude }
            : departureCoord;
          const walk =
            fromCoord && nextItem?.place
              ? haversineMeters(
                  fromCoord.lat,
                  fromCoord.lng,
                  nextItem.place.latitude,
                  nextItem.place.longitude
                )
              : null;

          return (
            <React.Fragment key={item.id}>
              <Animated.View
                style={[
                  es.row,
                  { height: slotHeightAt(index) },
                  isDragging && es.rowDragging,
                  {
                    transform: [{ translateY: pos }],
                    zIndex: isDragging ? 10 : 1,
                    elevation: isDragging ? 6 : 1,
                  },
                ]}
              >
                {item.place ? (
                  <View {...getResponder(item.id).panHandlers}>
                    <GripDots />
                  </View>
                ) : (
                  // 출발지는 순서 고정이라 드래그 핸들(수정 가능해 보이는 UI)을 아예 표시하지 않음
                  <View style={styles.gripSpacer} />
                )}

                <PlaceThumbnail
                  uri={item.place ? item.place.imageUri : departureImageUri ?? null}
                  style={es.thumb}
                />

                {item.place ? (
                  <View style={es.rowBody}>
                    <Text style={es.rowLabel} numberOfLines={1}>
                      {item.place.name}
                    </Text>
                    <View style={es.tagsRow}>
                      {item.place.tags.map((tag) => {
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
                ) : (
                  <Text style={es.rowLabel} numberOfLines={1}>
                    {departureLabel}
                  </Text>
                )}

                {item.place && (
                  <TouchableOpacity
                    onPress={() => removePlace(item.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={es.removeX}>×</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>

              {walk != null && (
                <View style={[es.walkPillWrap, { top: slotY(index) + slotHeightAt(index) + ROW_GAP }]}>
                  <View style={es.walkPill}>
                    <WalkingIcon width={13} height={13} color={Colors.textMuted} />
                    <Text style={es.walkText}>
                      도보 {estimateWalkMinutes(walk)}분 · {formatDistance(walk)}
                    </Text>
                  </View>
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
      </ScrollView>

      <View style={es.bottomBar}>
        <TouchableOpacity
          style={[es.saveBtn, submitting && es.saveBtnDisabled]}
          activeOpacity={0.85}
          disabled={submitting}
          onPress={() =>
            onSaved(order.filter((it): it is Required<RowItem> => !!it.place).map((it) => it.place))
          }
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={es.saveBtnText}>{isEditing ? '일정 수정하기' : '일정 저장하기'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  gripSpacer: {
    width: 16,
    marginRight: 12,
  },
  grip: {
    width: 16,
    height: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    gap: 2,
    marginRight: 12,
  },
  gripDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#C9C2BC',
  },
});

const es = StyleSheet.create({
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
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  hintText: { fontSize: 13, color: Colors.textMuted },
  listScroll: { flex: 1, minHeight: 0 },
  listScrollContent: { paddingBottom: Spacing.xl },
  listArea: {
    marginHorizontal: Spacing.xl,
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 0.5,
    borderColor: '#EDE8E3',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    shadowColor: '#3A3330',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  rowDragging: {
    shadowOpacity: 0.18,
    shadowRadius: 12,
    borderColor: Colors.primaryBorder,
  },
  thumb: { width: 64, height: 64, borderRadius: Radius.sm },
  rowBody: { flex: 1, gap: 6 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: Colors.textBody1 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  removeX: { fontSize: 20, color: Colors.textMuted, paddingHorizontal: 4 },
  walkPillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgWarm,
  },
  walkText: { fontSize: 12, color: Colors.textMuted },
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  saveBtn: {
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
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
