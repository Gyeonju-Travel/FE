import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Image, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

const CYCLE_MS = 3800;
const TRANSITION_MS = 320;
const SLIDE_DISTANCE = 14;

/** 힌트 문구를 위로 슬라이드시키며 자동으로 다음 것으로 넘긴다 (탭하면 바로 다음으로). */
export default function StampHintCarousel({ hints }: { hints: string[] }) {
  const [index, setIndex] = useState(0);
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const animating = useRef(false);

  const advance = () => {
    if (hints.length <= 1 || animating.current) return;
    animating.current = true;
    Animated.parallel([
      Animated.timing(translateY, { toValue: -SLIDE_DISTANCE, duration: TRANSITION_MS, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: TRANSITION_MS, useNativeDriver: true }),
    ]).start(() => {
      setIndex((prev) => (prev + 1) % hints.length);
      translateY.setValue(SLIDE_DISTANCE);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: TRANSITION_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: TRANSITION_MS, useNativeDriver: true }),
      ]).start(() => {
        animating.current = false;
      });
    });
  };

  useEffect(() => {
    if (hints.length <= 1) return;
    const timer = setInterval(advance, CYCLE_MS);
    return () => clearInterval(timer);
  }, [hints.length]);

  if (hints.length === 0) return null;

  return (
    <View style={s.hintCard}>
      {hints.length > 1 && (
        <View style={s.dotsCol}>
          {hints.map((_, i) => (
            <View key={i} style={[s.dot, i === index && s.dotActive]} />
          ))}
        </View>
      )}
      <View style={s.hintTitleRow}>
        <Image source={require('@/assets/mypage/stamp-hint-leaf.png')} style={s.hintLeaf} resizeMode="contain" />
        <Text style={s.hintTitle}>다음 스탬프 힌트</Text>
      </View>
      <TouchableOpacity activeOpacity={0.7} onPress={advance} style={s.hintBodyRow}>
        <Animated.Text
          style={[s.hintBody, { opacity, transform: [{ translateY }] }]}
          numberOfLines={2}
        >
          {hints[index]}
        </Animated.Text>
      </TouchableOpacity>
    </View>
  );
}

const HINT_CARD_HEIGHT = 98;

const s = StyleSheet.create({
  hintCard: {
    height: HINT_CARD_HEIGHT,
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  dotsCol: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'column',
    gap: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.secondaryBorder },
  dotActive: { backgroundColor: Colors.secondary },
  hintTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  hintLeaf: { width: 15, height: 18 },
  hintTitle: { fontSize: 14, fontWeight: '700', color: Colors.secondary },
  hintBodyRow: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: Spacing.xxl,
  },
  hintBody: { fontSize: 14, color: Colors.textBody2, lineHeight: 20 },
});
