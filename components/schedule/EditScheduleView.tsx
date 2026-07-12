import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  PanResponderInstance,
  SafeAreaView,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { SavedPlace } from '@/types/save';

const ROW_HEIGHT = 68;
const ROW_GAP = 12;
const SLOT = ROW_HEIGHT + ROW_GAP;
const DEPARTURE_ID = '__departure__';
const LONG_PRESS_MS = 250;

interface RowItem {
  id: string;
  place?: SavedPlace;
}

interface Props {
  departureLabel: string;
  places: SavedPlace[];
  isEditing?: boolean;
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
  places,
  isEditing,
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
    if (!positions[id]) positions[id] = new Animated.Value(index * SLOT);
    return positions[id];
  };

  useEffect(() => {
    order.forEach((item, index) => {
      if (item.id === draggingId) return;
      const pos = getPosition(item.id, index);
      Animated.timing(pos, { toValue: index * SLOT, duration: 200, useNativeDriver: true }).start();
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
          dragStartIndex.current * SLOT + (gestureState.dy - activationOffset.current);
        getPosition(id, dragStartIndex.current).setValue(rawY);

        // index 0은 출발지 고정 자리라 장소는 그 아래로만 이동 가능
        const targetIndex = Math.max(
          1,
          Math.min(Math.round(rawY / SLOT), orderRef.current.length - 1)
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
            toValue: finalIndex * SLOT,
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

      <View style={[es.listArea, { height: order.length * SLOT - ROW_GAP }]}>
        {order.map((item, index) => {
          const pos = getPosition(item.id, index);
          const isDragging = draggingId === item.id;
          return (
            <Animated.View
              key={item.id}
              style={[
                es.row,
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

              {item.place ? (
                <Image source={{ uri: item.place.imageUri }} style={es.thumb} resizeMode="cover" />
              ) : (
                <View style={es.departureIcon}>
                  <Image
                    source={require('@/assets/icons/location.png')}
                    style={{ width: 18, height: 18, tintColor: Colors.textBody2 }}
                    resizeMode="contain"
                  />
                </View>
              )}

              <Text style={es.rowLabel} numberOfLines={1}>
                {item.place ? item.place.name : departureLabel}
              </Text>

              {item.place && (
                <TouchableOpacity
                  onPress={() => removePlace(item.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={es.removeX}>×</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          );
        })}
      </View>

      <View style={es.bottomBar}>
        <TouchableOpacity
          style={es.saveBtn}
          activeOpacity={0.85}
          onPress={() =>
            onSaved(order.filter((it): it is Required<RowItem> => !!it.place).map((it) => it.place))
          }
        >
          <Text style={es.saveBtnText}>{isEditing ? '일정 수정하기' : '일정 저장하기'}</Text>
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
  listArea: {
    marginHorizontal: Spacing.xl,
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
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
  departureIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: 48, height: 48, borderRadius: Radius.sm },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textBody1 },
  removeX: { fontSize: 20, color: Colors.textMuted, paddingHorizontal: 4 },
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
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
