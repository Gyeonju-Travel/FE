import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';
import CelebrationBg from '@/assets/toast/celebration-bg.svg';
import CloseIcon from '@/assets/toast/close.svg';

const BG_ASPECT = 85 / 358;
const CARD_WIDTH = Math.min(Dimensions.get('window').width - 32, 358);
const CARD_HEIGHT = CARD_WIDTH * BG_ASPECT;

interface Props {
  visible: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onHide: () => void;
  /** 닫기(×) 버튼이 아닌 카드 본문을 탭했을 때 실행된다 (예: 스탬프 페이지로 이동). */
  onPress?: () => void;
  duration?: number;
  top?: number;
}

/** 회원가입 환영/스탬프 획득 등 축하 이벤트용 상단 토스트. */
export default function CelebrationToast({
  visible,
  icon,
  title,
  subtitle,
  onHide,
  onPress,
  duration = 3600,
  top = 12,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  const hide = () => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(onHide);
  };

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    translateY.setValue(-12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(hide, duration);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { top, width: CARD_WIDTH, height: CARD_HEIGHT, opacity, transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <CelebrationBg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill} />
      <TouchableOpacity
        style={styles.content}
        activeOpacity={onPress ? 0.85 : 1}
        disabled={!onPress}
        onPress={onPress}
      >
        <View style={styles.iconCircle}>{icon}</View>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Image source={require('@/assets/toast/celebration-sparkle.png')} style={styles.sparkle} resizeMode="contain" />
        <TouchableOpacity onPress={hide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <CloseIcon width={14} height={14} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 999,
    elevation: 999,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 18,
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#3A3330',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  textCol: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '500', color: Colors.textBody1 },
  subtitle: { fontSize: 12, color: Colors.textBody2 },
  sparkle: { width: 60, height: 60, flexShrink: 0 },
});
