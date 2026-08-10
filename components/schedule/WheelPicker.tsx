import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

export const ITEM_H = 44;
const VISIBLE = 5;
export const PICKER_H = ITEM_H * VISIBLE;

interface Props {
  data: string[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  /** Only needed when placed inside a row of pickers that should share width equally. */
  flex?: number;
  /** 이 인덱스 미만 항목은 흐리게 표시되고 선택할 수 없다 (예: 오늘 이전 날짜 비활성화). */
  minIndex?: number;
}

export default function WheelPicker({ data, selectedIdx, onSelect, flex, minIndex = 0 }: Props) {
  const ref = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(selectedIdx);

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIdx * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, []);

  const handleEnd = (e: any) => {
    const raw = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_H), data.length - 1));
    const idx = Math.max(raw, minIndex);
    if (idx !== raw) {
      ref.current?.scrollTo({ y: idx * ITEM_H, animated: true });
    }
    setCurrent(idx);
    onSelect(idx);
  };

  return (
    <View style={[styles.container, flex ? { flex } : null]}>
      <View style={styles.indicator} pointerEvents="none" />
      <ScrollView
        ref={ref}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        onMomentumScrollEnd={handleEnd}
        onScrollEndDrag={handleEnd}
      >
        {data.map((item, i) => (
          <View key={i} style={styles.item}>
            <Text
              style={[
                styles.text,
                i === current && styles.selected,
                i < minIndex && styles.disabled,
              ]}
            >
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: PICKER_H,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: ITEM_H * 2,
    left: 12,
    right: 12,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.coral,
    zIndex: 1,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    color: Colors.textMuted,
  },
  selected: {
    color: Colors.textBody1,
    fontWeight: '600',
  },
  disabled: {
    color: Colors.border,
  },
});
