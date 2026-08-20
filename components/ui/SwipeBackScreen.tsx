import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SCREEN_WIDTH = Dimensions.get('window').width;
const EDGE_WIDTH = 24;
const DISMISS_DISTANCE = SCREEN_WIDTH * 0.3;
const DISMISS_VELOCITY = 800;

interface Props {
  onBack: () => void;
  children: React.ReactNode;
  /**
   * 스와이프하는 동안 뒤에 깔려 보일 "이전 화면". 실제 라우터 스택이 아니라 상위 state로
   * 화면을 전환하는 구조라, 이걸 넘기지 않으면 드래그 중 뒤에 아무것도 없어 빈 공간이 드러난다.
   * iOS 기본 전환처럼, 이전 화면은 살짝 어두워지며 아주 조금만 따라 움직인다.
   */
  underlay?: React.ReactNode;
}

/**
 * 이 앱의 "상세 화면"들은 실제 라우터 push가 아니라 상위 컴포넌트의 state로 전환되기 때문에
 * iOS 기본 엣지 스와이프 뒤로가기가 동작하지 않는다. 화면 왼쪽 끝에서 오른쪽으로 미는 제스처를
 * 감지해서 onBack을 호출해, 네이티브 스와이프 뒤로가기를 흉내낸다.
 */
export default function SwipeBackScreen({ onBack, children, underlay }: Props) {
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-1000, 10])
    .failOffsetY([-20, 20])
    .hitSlop({ left: 0, width: EDGE_WIDTH })
    .onUpdate((e) => {
      if (e.translationX > 0) {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      const shouldDismiss = e.translationX > DISMISS_DISTANCE || e.velocityX > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onBack)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 22, stiffness: 220 });
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const underlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(translateX.value, [0, SCREEN_WIDTH], [-SCREEN_WIDTH * 0.25, 0]) }],
    opacity: interpolate(translateX.value, [0, SCREEN_WIDTH], [0.6, 1]),
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.flex}>
        {underlay && (
          <Animated.View style={[StyleSheet.absoluteFill, underlayStyle]} pointerEvents="none">
            {underlay}
          </Animated.View>
        )}
        <Animated.View style={[styles.flex, styles.foreground, style]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  foreground: { backgroundColor: 'transparent' },
});
