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
}

export default function WheelPicker({ data, selectedIdx, onSelect, flex }: Props) {
  const ref = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(selectedIdx);

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIdx * ITEM_H, animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, []);

  const handleEnd = (e: any) => {
    const idx = Math.max(
      0,
      Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_H), data.length - 1)
    );
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
            <Text style={[styles.text, i === current && styles.selected]}>{item}</Text>
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
});
