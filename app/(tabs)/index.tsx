import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import HeroIllustration from '@/components/home/HeroIllustration';
import PlaceThumbnail from '@/components/ui/PlaceThumbnail';
import Badge from '@/components/ui/Badge';
import Toast from '@/components/ui/Toast';
import { CATEGORY_BADGE_STYLE } from '@/constants/badgeConfig';
import WalkingIcon from '@/assets/icons/walking.svg';
import { getMyPets, getPetDetail, searchPlaces, ApiError } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { toDogFromRepresentative, personalityToLabel } from '@/utils/petMappers';
import { toMapPlace } from '@/utils/placeMappers';
import { isDaytime } from '@/utils/timeOfDay';
import { fetchGyeongjuWeather, GyeongjuWeather, SkyCondition } from '@/utils/weather';
import { MapPlace } from '@/types/map';
import { DogProfile } from '@/types/mypage';

const SKY_ICON: Record<SkyCondition, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  overcast: '☁️',
  rain: '🌧️',
  snow: '❄️',
  sleet: '🌨️',
};

const HERO_HEIGHT = Dimensions.get('window').height * 0.42;
const CARD_OVERLAP = 76;

const PERSONALITY_TAGLINE: Record<string, string> = {
  활동적: '활발한 탐험가',
  느긋함: '여유로운 산책가',
  '친화력 좋음': '사교적인 친구',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [dog, setDog] = useState<DogProfile | null>(null);
  const [personalityTag, setPersonalityTag] = useState<string | null>(null);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [weather, setWeather] = useState<GyeongjuWeather | null>(null);

  useEffect(() => {
    fetchGyeongjuWeather().then(setWeather);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const list = await getMyPets(token);
        if (list.representativePet) {
          setDog(toDogFromRepresentative(list.representativePet));
          const detail = await getPetDetail(list.representativePet.petId, token);
          setPersonalityTag(personalityToLabel(detail.personality));
        }
      } catch (e) {
        // 인사말/카드는 기본값으로도 자연스럽게 보이므로 조용히 무시
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const result = await searchPlaces({ size: 6 }, token);
        setPlaces(result.places.map(toMapPlace));
      } catch (e) {
        // 홈 화면 추천 목록은 실패해도 화면 전체를 막지 않음
      }
    })();
  }, []);

  const dogName = dog?.name ?? '반려견';
  const daytime = isDaytime(new Date().getHours());

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={styles.scrollContent}>
        <View style={{ height: HERO_HEIGHT }}>
          <HeroIllustration height={HERO_HEIGHT} />
          <View style={[styles.topOverlay, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
            <Text style={[styles.greeting, !daytime && styles.greetingDark]}>
              <Text style={styles.greetingRegular}>안녕하세요,</Text>
              {'\n'}
              <Text style={styles.greetingSemibold}>{dogName} 보호자님 👋</Text>
            </Text>
            <View style={styles.topRight}>
              {weather && (
                <View style={styles.weatherChip}>
                  <Text style={styles.weatherIcon}>{SKY_ICON[weather.sky]}</Text>
                  <Text style={styles.weatherText}>{weather.temperatureC}°</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.bellBtn}
                activeOpacity={0.8}
                onPress={() => setToastMsg('준비 중인 기능이에요.')}
              >
                <Text style={styles.bellIcon}>🔔</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              {dog?.photoUri ? (
                <Image source={{ uri: dog.photoUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]} />
              )}
              <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.dogName}>{dogName}</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                {personalityTag && (
                  <View style={styles.tagChip}>
                    <Text style={styles.tagText}>🌱 {PERSONALITY_TAGLINE[personalityTag] ?? personalityTag}</Text>
                  </View>
                )}
              </View>
              <View style={styles.trophyBadge}>
                <Text style={styles.trophyIcon}>🏆</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.footprintLabelRow}>
              <Image
                source={require('@/assets/mypage/dog-name-paw.png')}
                style={styles.footprintPawIcon}
                resizeMode="contain"
              />
              <Text style={styles.footprintLabel}>오늘까지 모은 발자국</Text>
            </View>
            <Text style={styles.footprintCount}>
              {dog?.stampCount ?? 0}
              <Text style={styles.footprintUnit}> 개</Text>
            </Text>
          </View>

          <TouchableOpacity style={styles.ctaRow} activeOpacity={0.85} onPress={() => router.push('/(tabs)/map')}>
            <WalkingIcon width={20} height={20} color={Colors.textBody1} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>추천 경로 시작하기</Text>
              <Text style={styles.ctaSubtitle}>{dogName}를 위한 경로를 추천해드려요</Text>
            </View>
            <Text style={styles.ctaArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📍</Text>
            <Text style={styles.sectionTitle}>관광지 살펴보기</Text>
          </View>

          {places.map((place, i) => {
            const cat = CATEGORY_BADGE_STYLE[place.category];
            return (
              <TouchableOpacity
                key={place.id}
                style={styles.placeCard}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/(tabs)/map', params: { placeId: place.id } })}
              >
                <PlaceThumbnail uri={place.imageUri} style={styles.placeThumb} />
                <View style={styles.placeInfo}>
                  <View style={styles.placeBadgeRow}>
                    {i === 0 && <Badge label="BEST" variant="best" />}
                    {cat && (
                      <Badge
                        label={place.category}
                        variant="outline"
                        tone={cat.tone}
                        leading={<cat.Icon width={13} height={13} />}
                      />
                    )}
                  </View>
                  <Text style={styles.placeName} numberOfLines={1}>
                    {place.name}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Toast message={toastMsg} onHide={() => setToastMsg(null)} bottom={100} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: Spacing.xxl },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { fontSize: 18, color: Colors.textBody1, lineHeight: 25, marginTop: 22 },
  greetingRegular: { fontWeight: '400' },
  greetingSemibold: { fontWeight: '600' },
  greetingDark: {
    color: Colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    height: 34,
  },
  weatherIcon: { fontSize: 14 },
  weatherText: { fontSize: 14, fontWeight: '600', color: Colors.textBody1 },
  bellBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 15 },
  body: { paddingHorizontal: Spacing.xl, marginTop: -CARD_OVERLAP },
  profileCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.xl,
    paddingTop: Spacing.lg + 20,
    paddingBottom: Spacing.lg + 20,
    paddingHorizontal: Spacing.lg + 8,
    shadowColor: '#3A3330',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 56, height: 56, borderRadius: Radius.full },
  avatarPlaceholder: { backgroundColor: Colors.bgWarm },
  profileInfo: { flex: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dogName: { fontSize: 17, fontWeight: '700', color: Colors.textBody1 },
  chevron: { fontSize: 18, color: Colors.textMuted },
  tagChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.secondaryTint,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontSize: 12, fontWeight: '600', color: Colors.secondaryDark },
  trophyBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyIcon: { fontSize: 18 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: Spacing.md },
  footprintLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  footprintPawIcon: { width: 16, height: 16 },
  footprintLabel: { fontSize: 13, color: Colors.textBody2 },
  footprintCount: { fontSize: 26, fontWeight: '800', color: Colors.coral },
  footprintUnit: { fontSize: 15, fontWeight: '600', color: Colors.textBody2 },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  ctaTitle: { fontSize: 15, fontWeight: '700', color: Colors.textBody1 },
  ctaSubtitle: { fontSize: 12, color: Colors.textBody2, marginTop: 2 },
  ctaArrow: { fontSize: 18, color: Colors.textBody1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  sectionIcon: { fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textBody1 },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  placeThumb: { width: 56, height: 56, borderRadius: Radius.sm },
  placeInfo: { flex: 1, gap: 6 },
  placeBadgeRow: { flexDirection: 'row', gap: 6 },
  placeName: { fontSize: 14, fontWeight: '600', color: Colors.textBody1 },
});
