import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import SplashLandscape from '@/assets/splash/splash-landscape.svg';

const SCREEN_WIDTH = Dimensions.get('window').width;
const LANDSCAPE_ASPECT = 390 / 218;

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={require('@/assets/splash/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>견주여행</Text>
        <Text style={styles.subtitle}>반려견과 동행하는 경주 여행</Text>
      </View>
      <SplashLandscape
        style={styles.landscape}
        width={SCREEN_WIDTH}
        height={SCREEN_WIDTH / LANDSCAPE_ASPECT}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgWarm,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logo: {
    width: 190,
    height: 190,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textBody1,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textBody2,
  },
  landscape: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
});
