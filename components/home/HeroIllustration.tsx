import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import Sun from '@/assets/home/sun.svg';
import Cloud1 from '@/assets/home/cloud-1.svg';
import Cloud2 from '@/assets/home/cloud-2.svg';
import AllScene from '@/assets/home/all.svg';
import { getSkyGradient, getTimeBucket, isDaytime, isNight } from '@/utils/timeOfDay';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCENE_HEIGHT = SCREEN_WIDTH * (232 / 519);
const HERO_RADIUS = 40;
const STAR_COUNT = 55;
const SUN_GLOW_SIZE = 160;

interface Star {
  left: number;
  top: number;
  size: number;
  baseOpacity: number;
  duration: number;
  delay: number;
}

function TwinkleStar({ star }: { star: Star }) {
  const twinkle = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(star.delay),
        Animated.timing(twinkle, {
          toValue: 0.25,
          duration: star.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 1,
          duration: star.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${star.left}%`,
        top: star.top,
        width: star.size,
        height: star.size,
        borderRadius: star.size / 2,
        backgroundColor: '#FFFFFF',
        opacity: Animated.multiply(twinkle, star.baseOpacity),
      }}
    />
  );
}

function Starfield({ skyHeight }: { skyHeight: number }) {
  const stars = useMemo<Star[]>(
    () =>
      Array.from({ length: STAR_COUNT }, () => ({
        left: Math.random() * 100,
        top: Math.random() * skyHeight,
        size: Math.random() < 0.15 ? 2.5 : 1.4,
        baseOpacity: 0.4 + Math.random() * 0.6,
        duration: 1200 + Math.random() * 1600,
        delay: Math.random() * 3000,
      })),
    [skyHeight]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((star, i) => (
        <TwinkleStar key={i} star={star} />
      ))}
    </View>
  );
}

interface Props {
  height: number;
}

export default function HeroIllustration({ height }: Props) {
  const cloud1X = useRef(new Animated.Value(0)).current;
  const cloud2X = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drift = (val: Animated.Value, distance: number, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: distance,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
    const anim1 = drift(cloud1X, 22, 7000);
    const anim2 = drift(cloud2X, -16, 8500);
    anim1.start();
    anim2.start();
    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, []);

  const hour = new Date().getHours();
  const sky = getSkyGradient(hour);
  const daytime = isDaytime(hour);
  const night = isNight(hour);
  const bucket = getTimeBucket(hour);
  const sceneOpacity = bucket === 'night' ? 0.55 : bucket === 'dusk' ? 0.82 : 1;

  return (
    <View style={[styles.container, { height }]}>
      <LinearGradient colors={sky.colors} locations={sky.locations} style={StyleSheet.absoluteFill} />

      {night && <Starfield skyHeight={height - SCENE_HEIGHT} />}

      {!night && (
        <>
          <View style={styles.sunWrap} pointerEvents="none">
            {daytime && (
              <Svg width={SUN_GLOW_SIZE} height={SUN_GLOW_SIZE} style={styles.sunGlow}>
                <Defs>
                  <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#FFF6D6" stopOpacity={0.85} />
                    <Stop offset="35%" stopColor="#FFEEA0" stopOpacity={0.45} />
                    <Stop offset="100%" stopColor="#FFEEA0" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx="50%" cy="50%" r="50%" fill="url(#sunGlow)" />
              </Svg>
            )}
            <Sun width={64} height={64} opacity={daytime ? 1 : 0.25} />
          </View>

          <Animated.View style={[styles.cloud1, { transform: [{ translateX: cloud1X }] }]}>
            <Cloud1 width={104} height={104 * (54 / 142)} opacity={daytime ? 0.95 : 0.35} />
          </Animated.View>
          <Animated.View style={[styles.cloud2, { transform: [{ translateX: cloud2X }] }]}>
            <Cloud2 width={72} height={72 * (34 / 90)} opacity={daytime ? 0.9 : 0.3} />
          </Animated.View>
        </>
      )}

      <AllScene width={SCREEN_WIDTH} height={SCENE_HEIGHT} style={styles.scene} opacity={sceneOpacity} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    overflow: 'hidden',
    borderBottomLeftRadius: HERO_RADIUS,
    borderBottomRightRadius: HERO_RADIUS,
  },
  sunWrap: {
    position: 'absolute',
    top: '15%',
    right: '12%',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunGlow: {
    position: 'absolute',
  },
  cloud1: {
    position: 'absolute',
    top: '38%',
    left: '6%',
  },
  cloud2: {
    position: 'absolute',
    top: '30%',
    right: '32%',
  },
  scene: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
});
