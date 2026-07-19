import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

interface Props {
  message: string | null;
  subtitle?: string;
  onHide: () => void;
  duration?: number;
}

export default function Toast({ message, subtitle, onHide, duration = 2000 }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(onHide);
    }, duration);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="box-none">
      <View style={styles.iconCircle}>
        <Image source={require('@/assets/icons/pets.png')} style={styles.icon} resizeMode="contain" />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {message}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={onHide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.close}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#3A3330',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { width: 18, height: 18, tintColor: Colors.coral },
  textCol: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '400', color: Colors.textBody1 },
  subtitle: { fontSize: 12, color: Colors.textBody2 },
  close: { fontSize: 18, color: Colors.textMuted, paddingHorizontal: 4 },
});
