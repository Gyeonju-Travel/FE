import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { MapPlace } from '@/types/map';
import Badge, { BADGE_TONE_COLORS } from '@/components/ui/Badge';
import { PLACE_TAG_STYLE, DEFAULT_PLACE_TAG_STYLE, CATEGORY_BADGE_STYLE } from '@/constants/badgeConfig';

export const SHEET_HEIGHT = 295;
const DISMISS_THRESHOLD = 80;
const DISMISS_VELOCITY = 0.5;

interface Props {
  place: MapPlace | null;
  onClose: () => void;
}

export default function MapPlaceSheet({ place, onClose }: Props) {
  const animY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [visible, setVisible] = useState(false);
  const [liked, setLiked] = useState(false);
  // prevents double-close when swipe gesture already fired the dismiss animation
  const swipeClosing = useRef(false);

  useEffect(() => {
    if (place) {
      swipeClosing.current = false;
      setLiked(false);
      setVisible(true);
      animY.setValue(SHEET_HEIGHT);
      Animated.timing(animY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (!swipeClosing.current) {
      Animated.timing(animY, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [place]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => dy > 3,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) animY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > DISMISS_THRESHOLD || vy > DISMISS_VELOCITY) {
          swipeClosing.current = true;
          Animated.timing(animY, {
            toValue: SHEET_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setVisible(false);
            onClose();
          });
        } else {
          Animated.timing(animY, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      />

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: animY }] }]}
      >
        {/* 드래그 핸들 — PanResponder 부착 */}
        <View style={styles.handleArea} {...panResponder.panHandlers}>
          <View style={styles.handle} />
        </View>

        {place && (
          <>
            {/* 장소 카드 */}
            <View style={styles.cardRow}>
              <Image
                source={{ uri: place.imageUri }}
                style={styles.image}
                resizeMode="cover"
              />

              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {place.name}
                  </Text>
                  {(() => {
                    const cat = CATEGORY_BADGE_STYLE[place.category];
                    return (
                      <Badge
                        label={place.category}
                        variant="filled"
                        tone={cat?.tone}
                        leading={
                          cat && (
                            <Image
                              source={cat.icon}
                              style={[styles.categoryIcon, { tintColor: BADGE_TONE_COLORS[cat.tone].text }]}
                              resizeMode="contain"
                            />
                          )
                        }
                      />
                    );
                  })()}
                </View>

                <View style={styles.tags}>
                  {place.tags.map((tag) => {
                    const cfg = PLACE_TAG_STYLE[tag] ?? DEFAULT_PLACE_TAG_STYLE;
                    return (
                      <Badge
                        key={tag}
                        label={tag}
                        variant="outline"
                        tone={cfg.tone}
                        dot={cfg.dot}
                        leading={
                          cfg.icon ? (
                            <Image
                              source={cfg.icon}
                              style={[styles.tagIcon, { tintColor: BADGE_TONE_COLORS[cfg.tone].text }]}
                              resizeMode="contain"
                            />
                          ) : undefined
                        }
                      />
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={styles.heartBtn}
                activeOpacity={0.7}
                onPress={() => setLiked((v) => !v)}
              >
                <Text style={[styles.heart, liked && styles.heartActive]}>
                  {liked ? '♥' : '♡'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 구분선 */}
            <View style={styles.separator} />

            {/* 정보 rows */}
            <View style={styles.infoRows}>
              <View style={styles.infoRow}>
                <Image
                  source={require('@/assets/icons/location.png')}
                  style={[styles.infoIcon, { tintColor: Colors.textBody2 }]}
                  resizeMode="contain"
                />
                <Text style={styles.infoText}>{place.address}</Text>
              </View>
              <View style={styles.infoRow}>
                <Image
                  source={require('@/assets/icons/telephone.png')}
                  style={[styles.infoIcon, { tintColor: Colors.textBody2 }]}
                  resizeMode="contain"
                />
                <Text style={styles.infoText}>{place.phone}</Text>
              </View>
              <View style={styles.infoRow}>
                <Image
                  source={require('@/assets/icons/clock.png')}
                  style={[styles.infoIcon, { tintColor: Colors.textBody2 }]}
                  resizeMode="contain"
                />
                <Text style={styles.infoText}>{place.hours}</Text>
              </View>
            </View>
          </>
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#3A3330',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
    paddingHorizontal: Spacing.xl,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D9D4CF',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: 16,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: Radius.sm,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textBody1,
    flexShrink: 1,
  },
  categoryIcon: {
    width: 15,
    height: 15,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagIcon: {
    width: 15,
    height: 15,
  },
  heartBtn: {
    alignSelf: 'flex-start',
    padding: 4,
  },
  heart: {
    fontSize: 22,
    color: Colors.coral,
    opacity: 0.35,
  },
  heartActive: {
    opacity: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#F0EDE8',
    marginBottom: 14,
  },
  infoRows: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoIcon: {
    width: 15,
    height: 15,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textBody2,
    lineHeight: 18,
  },
});
