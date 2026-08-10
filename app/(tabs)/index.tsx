import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import HeroIllustration from '@/components/home/HeroIllustration';
import RecommendedRouteView from '@/components/home/RecommendedRouteView';
import PlaceThumbnail from '@/components/ui/PlaceThumbnail';
import Badge, { BADGE_TONE_COLORS } from '@/components/ui/Badge';
import Toast from '@/components/ui/Toast';
import CelebrationToast from '@/components/ui/CelebrationToast';
import FilterTourIcon from '@/assets/icons/filter-tour.svg';
import WalkingDogIcon from '@/assets/home/walking-dog.svg';
import BellIcon from '@/assets/home/bell.svg';
import DogPhotoBlank from '@/assets/mypage/dog-photo-blank.svg';
import { STAMP_ICONS, STAMP_LOCKED_ICON, GEOFENCE_ATTRACTIONS, getEarnedStampIndices } from '@/constants/stamps';
import { getMyPets, getPetDetail, getPlaceDetail, ApiError } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { onTabReset } from '@/utils/tabReset';
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
const HOME_STAMP_PREVIEW_SLOTS = 3;

const PERSONALITY_TAGLINE: Record<string, string> = {
  활동적: '활발한 탐험가',
  느긋함: '여유로운 산책가',
  '친화력 좋음': '사교적인 친구',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { justOnboarded } = useLocalSearchParams<{ justOnboarded?: string }>();
  const [dog, setDog] = useState<DogProfile | null>(null);
  const [personalityTag, setPersonalityTag] = useState<string | null>(null);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showStampCelebration, setShowStampCelebration] = useState(false);
  const [weather, setWeather] = useState<GyeongjuWeather | null>(null);
  const [profileTopHeight, setProfileTopHeight] = useState(0);
  const [profileBottomHeight, setProfileBottomHeight] = useState(0);
  const [showRecommendedRoute, setShowRecommendedRoute] = useState(false);
  const [earnedStampIndices, setEarnedStampIndices] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    fetchGyeongjuWeather().then(setWeather);
  }, []);

  // 다른 탭에 있는 동안 관광지 도착(지오펜싱)으로 스탬프가 늘었을 수 있어, 홈 탭에 올 때마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      getEarnedStampIndices().then(setEarnedStampIndices);
    }, [])
  );

  // 온보딩(반려견 등록)을 마치고 넘어온 경우, 홈 화면에서 스탬프 획득 토스트를 띄운다.
  // 뒤로가기/재방문 시 다시 뜨지 않도록 파라미터를 즉시 지운다.
  useEffect(() => {
    if (justOnboarded !== '1') return;
    setShowStampCelebration(true);
    router.setParams({ justOnboarded: undefined });
  }, [justOnboarded]);

  // 홈 탭 아이콘을 다시 누르면 첫 화면으로 되돌아간다.
  useEffect(() => onTabReset('home', () => setShowRecommendedRoute(false)), []);

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

  // 홈 화면 추천 목적지는 스탬프 6곳(교촌마을/황리단길/계림/월정교/경주읍성/첨성대)으로 고정한다.
  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const results = await Promise.all(
        GEOFENCE_ATTRACTIONS.map(async (a) => {
          if (!a.placeId) return null;
          const detail = await getPlaceDetail(a.placeId, token).catch(() => null);
          // 카드에는 실제 상호명(예: "샬로우커피 황리단길점") 대신 관광지 이름 자체를 보여준다.
          return detail ? { ...toMapPlace(detail), name: a.name } : null;
        })
      );
      setPlaces(results.filter((r): r is NonNullable<typeof r> => r !== null));
    })();
  }, []);

  const dogName = dog?.name ?? '반려견';
  const daytime = isDaytime(new Date().getHours());

  if (showRecommendedRoute) {
    return <RecommendedRouteView dogName={dogName} onBack={() => setShowRecommendedRoute(false)} />;
  }

  // 구분선이 위/아래 블록 높이 차이와 상관없이 카드 안에서 항상 정중앙에 오도록,
  // 두 블록의 실측 높이 차이만큼 구분선 위/아래 여백을 반대로 보정한다.
  // 카드 상/하단 padding에서 뺀 만큼(20*2)을 구분선 위/아래 여백으로 그대로 옮겨서,
  // 카드 전체 높이는 그대로 두고 위 블록은 위로, 아래 블록은 아래로 이동시킨다.
  const DIVIDER_MARGIN_TOTAL = Spacing.md * 2 + 20;
  const dividerReady = profileTopHeight > 0 && profileBottomHeight > 0;
  const dividerMarginTop = dividerReady
    ? Math.max(
        0,
        DIVIDER_MARGIN_TOTAL / 2 + (profileBottomHeight - profileTopHeight) / 2
      )
    : Spacing.md;
  const dividerMarginBottom = dividerReady
    ? Math.max(0, DIVIDER_MARGIN_TOTAL - dividerMarginTop)
    : Spacing.md;

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
                <BellIcon width={15} height={18} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.profileCard}>
            <View
              style={styles.profileRow}
              onLayout={(e: LayoutChangeEvent) => setProfileTopHeight(e.nativeEvent.layout.height)}
            >
              {dog?.photoUri ? (
                <Image source={{ uri: dog.photoUri }} style={styles.avatar} />
              ) : (
                <DogPhotoBlank width={64} height={64} />
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
                <Image source={require('@/assets/home/trophy.png')} style={styles.trophyIcon} resizeMode="contain" />
              </View>
            </View>

            <View style={{ marginTop: dividerMarginTop, marginBottom: dividerMarginBottom }}>
              <View style={styles.divider} />
            </View>

            <View
              style={styles.footprintStampRow}
              onLayout={(e: LayoutChangeEvent) => setProfileBottomHeight(e.nativeEvent.layout.height)}
            >
              <View style={styles.footprintCol}>
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

              <View style={styles.verticalDivider} />

              <TouchableOpacity
                style={styles.stampCol}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/(tabs)/mypage', params: { openStampGallery: '1' } })}
              >
                <Text style={styles.stampPreviewLabel} numberOfLines={1} adjustsFontSizeToFit>
                  현재 스탬프는 <Text style={styles.stampPreviewCount}>{earnedStampIndices.size}개</Text>를 받았어요!
                </Text>
                <View style={styles.stampPreviewRow}>
                  {Array.from({ length: HOME_STAMP_PREVIEW_SLOTS }).map((_, i) => {
                    const earned = earnedStampIndices.has(i);
                    const StampIcon = earned ? STAMP_ICONS[i] : STAMP_LOCKED_ICON;
                    return (
                      <View key={i} style={styles.stampPreviewIcon}>
                        <StampIcon width="100%" height="100%" />
                      </View>
                    );
                  })}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.ctaRow}
            activeOpacity={0.85}
            onPress={() => setShowRecommendedRoute(true)}
          >
            <WalkingDogIcon width={22} height={24} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>추천 경로 시작하기</Text>
              <Text style={styles.ctaSubtitle}>{dogName}를 위한 경로를 추천해드려요</Text>
            </View>
            <Text style={styles.ctaArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.sectionHeader}>
            <Image source={require('@/assets/home/tourist-spot.png')} style={styles.sectionIcon} resizeMode="contain" />
            <Text style={styles.sectionTitle}>관광지 살펴보기</Text>
          </View>

          {places.map((place, i) => {
            const attraction = GEOFENCE_ATTRACTIONS.find((a) => a.name === place.name);
            return (
              <TouchableOpacity
                key={place.id}
                style={styles.placeCard}
                activeOpacity={0.85}
                onPress={() =>
                  attraction?.isProxyLocation
                    ? router.push({
                        pathname: '/(tabs)/map',
                        params: {
                          focusLat: String(place.latitude),
                          focusLng: String(place.longitude),
                          focusLabel: place.name,
                        },
                      })
                    : router.push({ pathname: '/(tabs)/map', params: { placeId: place.id } })
                }
              >
                <PlaceThumbnail uri={place.imageUri} style={styles.placeThumb} />
                <View style={styles.placeInfo}>
                  <View style={styles.placeBadgeRow}>
                    {i === 0 && <Badge label="BEST" variant="best" />}
                    <Badge
                      label={place.category}
                      variant="outline"
                      tone="sage"
                      leading={<FilterTourIcon width={13} height={13} color={BADGE_TONE_COLORS.sage.text} />}
                    />
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

      <CelebrationToast
        visible={showStampCelebration}
        icon={
          <Image
            source={require('@/assets/mypage/dog-name-paw.png')}
            style={{ width: 22, height: 22 }}
            resizeMode="contain"
          />
        }
        title="축하해요!"
        subtitle="새로운 스탬프를 획득했어요."
        top={insets.top + 12}
        onHide={() => setShowStampCelebration(false)}
      />
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
  body: { paddingHorizontal: Spacing.xl, marginTop: -CARD_OVERLAP },
  profileCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.xl,
    paddingTop: Spacing.lg + 10,
    paddingBottom: Spacing.lg + 10,
    paddingHorizontal: Spacing.lg + 8,
    shadowColor: '#3A3330',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 64, height: 64, borderRadius: Radius.full },
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
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A3330',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  trophyIcon: { width: 24, height: 24 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  footprintStampRow: { flexDirection: 'row' },
  footprintCol: { flex: 1 },
  footprintLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  footprintPawIcon: { width: 16, height: 16 },
  footprintLabel: { fontSize: 13, color: Colors.textBody2 },
  footprintCount: { fontSize: 26, fontWeight: '800', color: Colors.coral, marginTop: 8 },
  footprintUnit: { fontSize: 15, fontWeight: '600', color: Colors.textBody2 },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  stampCol: { flex: 1 },
  stampPreviewLabel: { fontSize: 13, color: Colors.textBody2, marginBottom: 10 },
  stampPreviewCount: { color: Colors.coral, fontWeight: '700' },
  stampPreviewRow: { flexDirection: 'row', gap: 8 },
  stampPreviewIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#7F9E8526',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  ctaTitle: { fontSize: 15, fontWeight: '700', color: Colors.textBody1 },
  ctaSubtitle: { fontSize: 12, color: Colors.textBody2, marginTop: 2 },
  ctaArrow: { fontSize: 18, color: Colors.secondary },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  sectionIcon: { width: 18, height: 18 },
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
