import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import UpdateNewsView from '@/components/home/UpdateNewsView';
import TodayScrapView from '@/components/home/TodayScrapView';
import PlaceThumbnail from '@/components/ui/PlaceThumbnail';
import Badge, { BADGE_TONE_COLORS } from '@/components/ui/Badge';
import Toast from '@/components/ui/Toast';
import CelebrationToast from '@/components/ui/CelebrationToast';
import FilterTourIcon from '@/assets/icons/filter-tour.svg';
import ChevronRightIcon from '@/assets/icons/chevron-right.svg';
import WalkingDogIcon from '@/assets/home/walking-dog.svg';
import BellIcon from '@/assets/home/bell.svg';
import BellActiveIcon from '@/assets/home/bell-active.svg';
import ToastScheduleEndedIcon from '@/assets/icons/toast/schedule-ended.svg';
import DogPhotoBlank from '@/assets/mypage/dog-photo-blank.svg';
import {
  STAMP_ICONS,
  STAMP_LOCKED_ICON,
  STAMP_NAMES,
  getDisplayStampIndices,
  getRecentStampIndices,
  popPendingStampToast,
} from '@/constants/stamps';
import { getPendingScrapSchedule, TodaysScrapSchedule } from '@/utils/locationTracking';
import { hasUnreadUpdateNews } from '@/constants/updateNews';
import { getPersonalityComboLabel } from '@/constants/personalityCombo';
import { getHome, getStampAlbum, getTravelRecords } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { onTabReset } from '@/utils/tabReset';
import { personalityToLabel } from '@/utils/petMappers';
import { isDaytime } from '@/utils/timeOfDay';
import { fetchGyeongjuWeather, GyeongjuWeather, SkyCondition } from '@/utils/weather';
import { MapPlace } from '@/types/map';

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

// "관광지 살펴보기"에 노출할 장소 6곳. 이름에 포함만 되면 매칭한다(예: "경주 첨성대"도 "첨성대"로 매칭).
const MAIN_ATTRACTION_NAMES = ['교촌마을', '황리단길', '계림', '월정교', '경주읍성', '첨성대'];
function isMainAttraction(name: string): boolean {
  return MAIN_ATTRACTION_NAMES.some((n) => name.includes(n));
}

// 그 중에서도 BEST 뱃지를 붙이고 맨 위로 올릴 장소들.
const BEST_ATTRACTION_NAMES = ['첨성대', '교촌마을', '황리단길'];
function isBestAttraction(name: string): boolean {
  return BEST_ATTRACTION_NAMES.some((n) => name.includes(n));
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { justOnboarded } = useLocalSearchParams<{ justOnboarded?: string }>();
  const [dog, setDog] = useState<{ name: string; photoUri: string | null } | null>(null);
  const [personalityLabel, setPersonalityLabel] = useState<string | null>(null);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastSubtitle, setToastSubtitle] = useState<string | undefined>(undefined);
  const [celebrationStampIndex, setCelebrationStampIndex] = useState<number | null>(null);
  const [weather, setWeather] = useState<GyeongjuWeather | null>(null);
  const [profileTopHeight, setProfileTopHeight] = useState(0);
  const [profileBottomHeight, setProfileBottomHeight] = useState(0);
  const [showRecommendedRoute, setShowRecommendedRoute] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnreadNotification, setHasUnreadNotification] = useState(false);
  const [earnedStampIndices, setEarnedStampIndices] = useState<Set<number>>(new Set([0]));
  const [recentStampIndices, setRecentStampIndices] = useState<number[]>([0]);
  const [footprintCount, setFootprintCount] = useState(0);
  const [pendingScrap, setPendingScrap] = useState<TodaysScrapSchedule | null>(null);
  const [scrapAccessToken, setScrapAccessToken] = useState<string | null>(null);
  // 오후 9시~자정 사이, 오늘 시작한 일정 중 아직 스크랩 안 한 게 있으면 토스트로 알려준다.
  // 탭하면 그때 pendingScrap/scrapAccessToken을 채워서 스크랩 화면을 연다. 세션당 한 번만 띄운다.
  const scrapToastShownRef = useRef(false);
  const scrapToastCandidateRef = useRef<{ schedule: TodaysScrapSchedule; token: string } | null>(null);

  useEffect(() => {
    fetchGyeongjuWeather().then(setWeather);
  }, []);

  // 다른 탭에 있는 동안 백그라운드 위치 추적으로 스탬프/발자국이 늘었을 수 있어, 홈 탭에 올 때마다 다시 읽는다.
  // 온보딩(반려견 등록) 직후라면 웰컴 스탬프 토스트를, 아니라면 백그라운드에서 새로 지급된
  // 스탬프가 있는지 큐에서 하나 꺼내 토스트로 보여준다.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        setEarnedStampIndices(await getDisplayStampIndices());
        setRecentStampIndices(await getRecentStampIndices(HOME_STAMP_PREVIEW_SLOTS));

        const token = await getAccessToken();
        if (token) {
          try {
            const home = await getHome(token);
            setDog({ name: home.petName, photoUri: home.petProfileImageUrl });
            setPersonalityLabel(
              getPersonalityComboLabel(home.petPersonalities) ??
                home.petPersonalities.map(personalityToLabel).join(' · ')
            );
            const mappedPlaces = home.places
              .filter((p) => isMainAttraction(p.placeName))
              .map((p) => ({
                id: String(p.placeId),
                name: p.placeName,
                category: '관광지' as const,
                tags: [],
                imageUri: p.imageUrl,
                latitude: p.latitude,
                longitude: p.longitude,
                address: '',
                phone: '',
                hours: '',
              }));
            // BEST 장소(첨성대/핑크뮬리/황리단길)를 맨 위로 올린다 (안정 정렬이라 나머지 순서는 유지됨).
            mappedPlaces.sort((a, b) => Number(isBestAttraction(b.name)) - Number(isBestAttraction(a.name)));
            setPlaces(mappedPlaces);
          } catch (e) {
            // 인사말/카드는 기본값으로도 자연스럽게 보이므로 조용히 무시
          }

          // 발자국 수는 "오늘까지 모은" 전체 누적치라, home.footprintCount(단일 값) 하나만
          // 믿지 않고 여행 기록(완료된 일정) 전부의 스탬프 앨범 footprintCount를 직접 더한다.
          try {
            const travelRecords = await getTravelRecords(token);
            const albums = await Promise.all(
              travelRecords.records.map((r) => getStampAlbum(r.scheduleId, token).catch(() => null))
            );
            const total = albums.reduce((sum, album) => sum + (album?.footprintCount ?? 0), 0);
            setFootprintCount(total);
          } catch (e) {
            // 발자국 합계 집계 실패는 조용히 무시 — 이전에 표시된 값을 유지한다.
          }

          try {
            setHasUnreadNotification(await hasUnreadUpdateNews());
          } catch (e) {
            // 알림 미확인 개수 조회 실패는 무시 — 벨 아이콘은 이전 상태로 유지된다.
          }
        }

        if (justOnboarded === '1') {
          setCelebrationStampIndex(0);
          router.setParams({ justOnboarded: undefined });
          return;
        }
        const pendingToast = await popPendingStampToast();
        if (pendingToast !== null) setCelebrationStampIndex(pendingToast);

        // 오후 9시~자정 사이, 오늘 '시작'한 일정 중 아직 스크랩하지 않은 게 있으면 토스트로
        // 알려준다(세션당 한 번). 탭하면 그때 스크랩 화면을 연다.
        if (!scrapToastShownRef.current && new Date().getHours() >= 21) {
          const pendingSchedule = await getPendingScrapSchedule();
          if (pendingSchedule) {
            const token = await getAccessToken();
            if (token) {
              scrapToastShownRef.current = true;
              scrapToastCandidateRef.current = { schedule: pendingSchedule, token };
              setToastMsg('일정이 종료 됐나요?');
              setToastSubtitle('스크랩으로 오늘 하루를 기록해보세요');
            }
          }
        }
      })();
    }, [justOnboarded])
  );

  // 홈 탭 아이콘을 다시 누르면 첫 화면으로 되돌아간다.
  useEffect(() => onTabReset('home', () => setShowRecommendedRoute(false)), []);

  const dogName = dog?.name ?? '반려견';
  const daytime = isDaytime(new Date().getHours());

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

  // 스와이프 뒤로가기 중 뒤에 깔아 보여줄 홈 기본 화면. 아래 세 early-return 분기(오늘의 기록,
  // 추천 경로, 업데이트 소식)의 underlay로 재사용한다.
  const baseScreen = (
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
                onPress={() => setShowNotifications(true)}
              >
                {hasUnreadNotification ? (
                  <BellActiveIcon width={15} height={18} />
                ) : (
                  <BellIcon width={15} height={18} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.profileCard}>
            <TouchableOpacity
              style={styles.profileRow}
              activeOpacity={0.7}
              onPress={() => router.push('/mypage')}
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
                  <ChevronRightIcon width={7} height={13} color={Colors.textMuted} />
                </View>
                {personalityLabel && (
                  <View style={styles.tagChip}>
                    <Image
                      source={require('@/assets/mypage/personality-tag-icon.png')}
                      style={styles.tagIcon}
                      resizeMode="contain"
                    />
                    <Text style={styles.tagText}>{personalityLabel}</Text>
                  </View>
                )}
              </View>
              <View style={styles.trophyBadge}>
                <Image source={require('@/assets/home/trophy.png')} style={styles.trophyIcon} resizeMode="contain" />
              </View>
            </TouchableOpacity>

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
                  {footprintCount}
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
                    const stampIndex = recentStampIndices[i];
                    const StampIcon = stampIndex !== undefined ? STAMP_ICONS[stampIndex] : STAMP_LOCKED_ICON;
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

          {places.map((place) => {
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
                    {isBestAttraction(place.name) && <Badge label="BEST" variant="best" />}
                    <Badge
                      label={place.category}
                      variant="filled"
                      tone="coral"
                      leading={<FilterTourIcon width={13} height={13} color={BADGE_TONE_COLORS.coral.text} />}
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

      <Toast
        message={toastMsg}
        subtitle={toastSubtitle}
        onHide={() => setToastMsg(null)}
        onPress={
          toastMsg === '일정이 종료 됐나요?' && scrapToastCandidateRef.current
            ? () => {
                if (!scrapToastCandidateRef.current) return;
                setScrapAccessToken(scrapToastCandidateRef.current.token);
                setPendingScrap(scrapToastCandidateRef.current.schedule);
              }
            : undefined
        }
        duration={toastMsg === '일정이 종료 됐나요?' ? 4000 : 2000}
        bottom={toastMsg === '일정이 종료 됐나요?' ? 40 : 100}
        icon={toastMsg === '일정이 종료 됐나요?' ? <ToastScheduleEndedIcon width={21} height={21} /> : undefined}
      />

      <CelebrationToast
        visible={celebrationStampIndex !== null}
        icon={
          <Image
            source={require('@/assets/mypage/dog-name-paw.png')}
            style={{ width: 22, height: 22 }}
            resizeMode="contain"
          />
        }
        title="축하해요!"
        subtitle={celebrationStampIndex !== null ? `${STAMP_NAMES[celebrationStampIndex]} 스탬프를 획득했어요.` : ''}
        top={insets.top + 12}
        onHide={async () => {
          // 한 번에 스탬프를 여러 개 땄으면(예: 관광지 스탬프 + 경주마스터 동시 지급) 큐에
          // 남은 다음 스탬프를 이어서 보여준다.
          const next = await popPendingStampToast();
          setCelebrationStampIndex(next);
        }}
        onPress={() => {
          setCelebrationStampIndex(null);
          router.push({ pathname: '/(tabs)/mypage', params: { openStampGallery: '1' } });
        }}
      />
    </View>
  );

  if (pendingScrap && scrapAccessToken) {
    return (
      <TodayScrapView
        pending={pendingScrap}
        dogName={dogName}
        dogProfileImageUri={dog?.photoUri ?? undefined}
        accessToken={scrapAccessToken}
        onBack={() => setPendingScrap(null)}
        underlay={baseScreen}
      />
    );
  }

  if (showRecommendedRoute) {
    return (
      <RecommendedRouteView
        dogName={dogName}
        onBack={() => setShowRecommendedRoute(false)}
        underlay={baseScreen}
      />
    );
  }

  if (showNotifications) {
    return (
      <UpdateNewsView
        onBack={async () => {
          setShowNotifications(false);
          try {
            setHasUnreadNotification(await hasUnreadUpdateNews());
          } catch (e) {
            // 무시 — 이전 상태 유지
          }
        }}
        underlay={baseScreen}
      />
    );
  }

  return baseScreen;
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
    shadowColor: '#3A3330',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
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
    shadowColor: '#3A3330',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dogName: { fontSize: 17, fontWeight: '700', color: Colors.textBody1 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.secondaryTint,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagIcon: { width: 10, height: 14 },
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
    marginTop: Spacing.xxl,
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
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#9C908E',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  placeThumb: { width: 56, height: 56, borderRadius: Radius.sm },
  placeInfo: { flex: 1, gap: 6 },
  placeBadgeRow: { flexDirection: 'row', gap: 6 },
  placeName: { fontSize: 14, fontWeight: '600', color: Colors.textBody1 },
});
