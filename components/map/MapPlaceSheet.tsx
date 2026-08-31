import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
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
import MapPlaceIcon from '@/assets/icons/map-place.svg';
import TelephoneIcon from '@/assets/icons/telephone.svg';
import MapHoursIcon from '@/assets/icons/map-hours.svg';
import InfoCircleIcon from '@/assets/icons/info-circle.svg';
import HeartIcon from '@/assets/icons/heart.svg';
import HeartFilledIcon from '@/assets/icons/heart-filled.svg';
import PlaceThumbnail from '@/components/ui/PlaceThumbnail';
import { parsePetInfoBullets } from '@/utils/placeMappers';

export const SHEET_HEIGHT = 295;
const DISMISS_THRESHOLD = 80;
const DISMISS_VELOCITY = 0.5;

interface Props {
  place: MapPlace | null;
  liked?: boolean;
  onClose: () => void;
  onToggleLike?: (place: MapPlace, liked: boolean) => void;
}

export default function MapPlaceSheet({ place, liked: likedProp = false, onClose, onToggleLike }: Props) {
  const animY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [visible, setVisible] = useState(false);
  const [liked, setLiked] = useState(false);
  // prevents double-close when swipe gesture already fired the dismiss animation
  const swipeClosing = useRef(false);

  useEffect(() => {
    if (place) {
      swipeClosing.current = false;
      setLiked(likedProp);
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

  // likedProp은 저장 페이지 등 다른 화면에서 저장/삭제하고 돌아왔을 때도 바뀔 수 있는데,
  // 위 effect는 place가 바뀔 때만 실행돼서 같은 장소를 계속 보고 있으면 반영이 안 된다.
  // 그래서 likedProp 변경만 따로 감지해서 내부 상태에 반영한다.
  useEffect(() => {
    setLiked(likedProp);
  }, [likedProp]);

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
              <PlaceThumbnail uri={place.imageUri} style={styles.image} />

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
                          cat && <cat.Icon width={15} height={15} color={BADGE_TONE_COLORS[cat.tone].text} />
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
                          cfg.Icon ? (
                            <cfg.Icon width={15} height={15} color={BADGE_TONE_COLORS[cfg.tone].text} />
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
                onPress={() => {
                  const next = !liked;
                  setLiked(next);
                  onToggleLike?.(place, next);
                }}
              >
                {liked ? (
                  <HeartFilledIcon width={20} height={18} color={Colors.coral} />
                ) : (
                  <HeartIcon width={20} height={18} color={Colors.border} />
                )}
              </TouchableOpacity>
            </View>

            {/* 정보 rows */}
            <View style={styles.infoCard}>
              {[
                <View key="address" style={styles.infoRow}>
                  <MapPlaceIcon width={15} height={15} color={Colors.textBody2} style={styles.infoRowIcon} />
                  <Text style={styles.infoText}>{place.address}</Text>
                </View>,
                !!place.petInfo && (
                  <View key="petInfo" style={styles.infoRow}>
                    <InfoCircleIcon width={15} height={15} color={Colors.textBody2} style={styles.infoRowIcon} />
                    <View style={styles.infoTextCol}>
                      <Text style={styles.noticeTitle}>관광지 입장 전 안내 사항</Text>
                      {parsePetInfoBullets(place.petInfo).map((line, i) => (
                        <Text key={i} style={styles.noticeBulletText}>{'•'} {line}</Text>
                      ))}
                    </View>
                  </View>
                ),
                !!place.phone && (
                  <View key="phone" style={styles.infoRow}>
                    <TelephoneIcon width={15} height={15} color={Colors.textBody2} style={styles.infoRowIcon} />
                    <Text style={styles.infoText}>{place.phone}</Text>
                  </View>
                ),
                (!!place.hours || !!place.breakTime || !!place.closedDays) && (
                  <View key="hours" style={styles.infoRow}>
                    <MapHoursIcon width={15} height={15} color={Colors.textBody2} style={styles.infoRowIcon} />
                    <View style={styles.infoTextCol}>
                      {!!place.hours && (
                        <Text style={styles.infoTextLine}>
                          {place.hours}
                          {!!place.closedDays && ` ${place.closedDays} 휴무`}
                        </Text>
                      )}
                      {!place.hours && !!place.closedDays && (
                        <Text style={styles.infoTextLine}>{place.closedDays} 휴무</Text>
                      )}
                      {!!place.breakTime && <Text style={styles.infoTextLine}>{place.breakTime} 브레이크 타임</Text>}
                    </View>
                  </View>
                ),
              ]
                .filter(Boolean)
                .map((row, i, arr) => (
                  <React.Fragment key={i}>
                    {row}
                    {i < arr.length - 1 && <View style={styles.infoDivider} />}
                  </React.Fragment>
                ))}
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
    // 관광지 입장 전 안내 사항처럼 항목이 많으면 고정 높이(SHEET_HEIGHT)를 넘어서는 곳이
    // 있어서, 그 이상 필요하면 늘어나도록 최소 높이로 둔다(내용이 짧은 평소엔 기존과 동일).
    minHeight: SHEET_HEIGHT,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#3A3330',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
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
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heartBtn: {
    alignSelf: 'center',
    padding: 4,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  // 텍스트 줄이 여러 줄이어도(영업시간+브레이크타임) 아이콘이 전체 블록 가운데가 아니라
  // 첫 줄 옆에 오도록, 첫 줄의 lineHeight(18)와 아이콘 높이(15)의 차이만큼만 살짝 내린다.
  infoRowIcon: { marginTop: 1.5 },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textBody2,
    lineHeight: 18,
  },
  infoTextCol: {
    flex: 1,
    gap: 2,
  },
  // infoTextCol처럼 세로로 여러 줄을 쌓는 자리에서는 infoText의 flex: 1을 그대로 쓰면 안 된다 —
  // infoRow(가로 배치)에서는 아이콘 옆 남은 가로 공간을 차지하라는 의미지만, 세로로 쌓인 형제
  // Text들에 flex: 1을 주면 높이가 정해지지 않은 부모 안에서 서로 공간을 다투다 겹쳐 보인다.
  infoTextLine: {
    fontSize: 13,
    color: Colors.textBody2,
    lineHeight: 18,
  },
  noticeTitle: {
    fontSize: 13,
    color: Colors.textBody2,
    lineHeight: 18,
  },
  noticeBulletText: {
    fontSize: 13,
    color: Colors.textBody2,
    lineHeight: 19,
    marginTop: 1,
  },
});
