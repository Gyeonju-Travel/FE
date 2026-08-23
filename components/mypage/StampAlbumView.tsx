import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  Linking,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { STAMP_ICONS, STAMP_LOCKED_ICON } from '@/constants/stamps';
import { ScrapData, RouteStop } from '@/types/stampAlbum';
import { calculateFootprintCount } from '@/utils/footprintCalculator';
import { haversineMeters } from '@/utils/distance';
import { fetchPedestrianRoute, LatLng, PedestrianRouteResult } from '@/utils/pedestrianRoute';
import { getBreadcrumbPath } from '@/utils/locationTracking';
import { saveStampAlbumPhotos, ApiError } from '@/utils/api';
import { useScrapCapture } from '@/hooks/useScrapCapture';
import KakaoMap from '@/components/map/KakaoMap';
import Toast from '@/components/ui/Toast';
import PhotoPermissionModal from '@/components/ui/PhotoPermissionModal';
import DogPhotoBlank from '@/assets/mypage/dog-photo-blank.svg';
import ToastDailyRecordIcon from '@/assets/icons/toast/daily-record.svg';
import SwipeBackScreen from '@/components/ui/SwipeBackScreen';
import SplashLandscape from '@/assets/splash/splash-landscape.svg';
import PawIcon from '@/assets/icons/step-paw.svg';

const MAP_CARD_HEIGHT = 200;
const SCRAP_WIDTH = Dimensions.get('window').width;
const LANDSCAPE_ASPECT = 390 / 218;

/** 방문지 목록을 Tmap 보행자 경로 API로 이어서, 경로보기와 동일한 실제 도보 경로/거리를 구한다.
 * 키가 없거나 특정 구간 요청이 실패하면 그 구간만 두 지점 간 직선(Haversine)으로 대체한다. */
/** 실제로 오늘 기록된 발자취(breadcrumb)가 남아있으면 그걸 그대로 경로로 쓰고, 없으면(지난
 * 날짜 기록 등) 저장된 장소들 사이를 Tmap 도보 경로로 이어 계산한 "예상 경로"로 대체한다.
 * 발자취는 실제로 어디를 걸었는지(계획에 없던 곳에 들렀어도) 그대로 보여주지만, 계산된 경로는
 * 저장된 지점 사이의 추천 길일 뿐이라는 차이가 있다. */
function useScrapRoute(scrapId: string, stops: RouteStop[]) {
  const stopLatLngs = useMemo<LatLng[]>(
    () => stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
    [stops]
  );
  const [segments, setSegments] = useState<(PedestrianRouteResult | null)[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<LatLng[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getBreadcrumbPath(scrapId).then((path) => {
      if (!cancelled) setBreadcrumb(path.length >= 2 ? path : null);
    });
    return () => {
      cancelled = true;
    };
  }, [scrapId]);

  React.useEffect(() => {
    if (breadcrumb || stopLatLngs.length < 2) {
      setSegments([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      stopLatLngs.slice(0, -1).map((from, i) => fetchPedestrianRoute(from, stopLatLngs[i + 1]))
    ).then((results) => {
      if (!cancelled) setSegments(results);
    });
    return () => {
      cancelled = true;
    };
  }, [breadcrumb, stopLatLngs]);

  const routePath = useMemo<LatLng[]>(() => {
    if (breadcrumb) return breadcrumb;
    return stopLatLngs.slice(0, -1).flatMap((from, i) => segments[i]?.path ?? [from, stopLatLngs[i + 1]]);
  }, [breadcrumb, stopLatLngs, segments]);

  const distanceMeters = useMemo(() => {
    if (breadcrumb) {
      return breadcrumb.slice(0, -1).reduce((sum, from, i) => {
        const to = breadcrumb[i + 1];
        return sum + haversineMeters(from.lat, from.lng, to.lat, to.lng);
      }, 0);
    }
    return stopLatLngs.slice(0, -1).reduce((sum, from, i) => {
      const segment = segments[i];
      if (segment) return sum + segment.distanceMeters;
      return sum + haversineMeters(from.lat, from.lng, stopLatLngs[i + 1].lat, stopLatLngs[i + 1].lng);
    }, 0);
  }, [breadcrumb, stopLatLngs, segments]);

  return { routePath, distanceMeters };
}

function PolaroidPhoto({
  uri,
  rotate,
  showTape,
  onPress,
  saving,
  onLoadEnd,
  style,
}: {
  uri?: string;
  rotate: string;
  showTape?: boolean;
  onPress: () => void;
  saving?: boolean;
  onLoadEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={saving}
      style={[s.polaroid, { transform: [{ rotate }] }, style]}
    >
      {showTape && <View style={s.tape} />}
      {uri ? (
        <Image source={{ uri }} style={s.polaroidPhoto} resizeMode="cover" onLoadEnd={onLoadEnd} />
      ) : (
        <View style={[s.polaroidPhoto, s.polaroidPlaceholder]}>
          <Text style={s.polaroidPlaceholderText}>사진 추가</Text>
        </View>
      )}
      {saving && (
        <View style={s.polaroidSavingOverlay}>
          <ActivityIndicator color={Colors.white} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function DogProfileImage({ uri }: { uri?: string }) {
  return (
    <View style={s.dogProfileWrap}>
      {uri ? (
        <Image source={{ uri }} style={s.dogProfileImage} resizeMode="cover" />
      ) : (
        <DogPhotoBlank width={76} height={76} />
      )}
    </View>
  );
}

function FootprintSummaryCard({
  dogName,
  footprintCount,
}: {
  dogName: string;
  footprintCount: number;
}) {
  return (
    <View style={s.footprintHeader}>
      <View style={s.footprintHeaderRow}>
        <Text style={s.footprintTitle} numberOfLines={1} ellipsizeMode="tail">
          {dogName}의 발자국 지도
        </Text>
        <View style={s.footprintCountRow}>
          <Text style={s.footprintCount}>{footprintCount}</Text>
          <Image
            source={require('@/assets/icons/pets.png')}
            style={[s.footprintPawIcon, { tintColor: Colors.coral }]}
            resizeMode="contain"
          />
        </View>
      </View>
      <Text style={s.footprintSubtitle} numberOfLines={1} ellipsizeMode="tail">
        여행지에 {dogName}의 발자국을 가득 찍었어요!
      </Text>
    </View>
  );
}

/** 방문한 관광지 중 서버가 무작위로 선정한 스탬프. stampIndex가 없으면 표시하지 않는다. */
function TravelBadge({ stampIndex }: { stampIndex?: number }) {
  const StampIcon = stampIndex !== undefined ? STAMP_ICONS[stampIndex] ?? STAMP_LOCKED_ICON : null;
  if (!StampIcon) return null;
  return <StampIcon width={72} height={72} />;
}

function RouteSnapshotCard({
  stops,
  routePath,
  stampIndex,
  onMapReady,
}: {
  stops: RouteStop[];
  routePath: LatLng[];
  stampIndex?: number;
  onMapReady: () => void;
}) {
  const routePlaces = useMemo(
    () => stops.map((stop) => ({ id: stop.id, lat: stop.latitude, lng: stop.longitude })),
    [stops]
  );

  return (
    <View style={s.mapCard}>
      {stops.length > 0 ? (
        <KakaoMap
          routePlaces={routePlaces}
          routePath={routePath}
          routeLineStyle="paw"
          routeBoundsPadding={24}
          onMapReady={onMapReady}
        />
      ) : (
        <View style={s.mapPlaceholder}>
          <Text style={s.mapPlaceholderText}>저장된 경로가 없어요</Text>
        </View>
      )}
      <View style={s.mapBadgeOverlay}>
        <TravelBadge stampIndex={stampIndex} />
      </View>
    </View>
  );
}

interface StampAlbumScreenProps {
  scrap: ScrapData;
  onBack: () => void;
  underlay?: React.ReactNode;
  /** 제공되면 사진을 고를 때마다 자동으로 서버(해당 일정의 스탬프 앨범)에 저장한다. */
  serverSave?: {
    scheduleId: number;
    accessToken: string;
    onSaved?: () => void;
  };
  /**
   * 마이페이지 탭은 탭바가 화면 위에 절대 위치로 떠 있어서(하단 배경 일러스트 노출용),
   * 이 화면이 마이페이지 탭 안에서 열릴 때는 하단 버튼이 그 탭바에 가려진다. 그 탭바 높이만큼
   * 호출부에서 넘겨주면 버튼이 가려지지 않게 그만큼 아래쪽에 여유를 둔다.
   */
  extraBottomInset?: number;
}

export default function StampAlbumScreen({
  scrap,
  onBack,
  underlay,
  serverSave,
  extraBottomInset = 0,
}: StampAlbumScreenProps) {
  const scrapAreaRef = useRef<View>(null);
  const [photoUris, setPhotoUris] = useState<(string | undefined)[]>([
    scrap.selectedPhotoUris[0],
    scrap.selectedPhotoUris[1],
  ]);
  // 저장된 경로가 없으면 기다릴 지도가 없으니 바로 준비된 것으로 본다.
  const [isMapReady, setIsMapReady] = useState(scrap.stops.length === 0);
  // 원격 이미지가 다 로드되기 전에 캡처하면 사진 자리가 빈 채로 저장된다 — 로드 완료된 URI만 추적한다.
  const [loadedPhotoUris, setLoadedPhotoUris] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showPhotoPermissionModal, setShowPhotoPermissionModal] = useState(false);
  const [isServerSaving, setIsServerSaving] = useState(false);
  const { isSaving, isSharing, saveToGallery, shareImage } = useScrapCapture(scrapAreaRef, () => {
    setToastMsg('이미지가 저장됐어요!');
  });

  const { routePath, distanceMeters } = useScrapRoute(scrap.id, scrap.stops);
  const totalDistanceInMeters = scrap.totalDistanceInMeters ?? distanceMeters;
  const footprintCount = useMemo(
    () => calculateFootprintCount(totalDistanceInMeters),
    [totalDistanceInMeters]
  );

  const pickPhoto = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setShowPhotoPermissionModal(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    // 아이폰 갤러리는 HEIC 원본을 그대로 돌려줄 수 있는데, 그걸 확장자만 .jpg로 붙여 올리면
    // 네이티브(OS가 HEIC를 직접 디코딩)에서는 보이지만 웹 브라우저는 HEIC를 디코딩 못 해서
    // 사진이 안 보인다. 무조건 실제 JPEG로 다시 인코딩해서 올린다 (용량도 같이 줄어든다).
    const manipulated = await ImageManipulator.manipulate(result.assets[0].uri)
      .resize({ width: 1600 })
      .renderAsync();
    const saved = await manipulated.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    const uri = saved.uri;
    const next = [...photoUris];
    next[index] = uri;
    setPhotoUris(next);

    if (!serverSave) return;
    const toSave = next.filter((u): u is string => !!u);
    setIsServerSaving(true);
    try {
      await saveStampAlbumPhotos(serverSave.scheduleId, toSave, serverSave.accessToken);
      setToastMsg('사진이 저장됐어요!');
      serverSave.onSaved?.();
    } catch (e) {
      // 사진을 한 장만 골랐을 때 서버가 "두 장 다 골라주세요" 식으로 거부하더라도, 사용자에게는
      // 그 요구를 그대로 들이밀지 않는다 — 대신 한 장 더 고르면 저장된다고 부드럽게 안내한다.
      if (toSave.length < 2) {
        setToastMsg('사진은 총 두 장을 선택해주세요.');
      } else {
        setToastMsg(e instanceof ApiError ? e.message : '저장하지 못했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsServerSaving(false);
    }
  };

  const selectedPhotoUris = photoUris.filter((uri): uri is string => !!uri);
  const photosReady = photoUris.every((uri) => !uri || loadedPhotoUris.has(uri));

  const isBusy = isSaving || isSharing;
  const actionsDisabled = isBusy || !isMapReady || !photosReady;

  return (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>스탬프 앨범</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={s.scrollContent}
      >
        {/* 캡처/공유 대상 영역: 헤더와 하단 버튼은 여기 포함되지 않는다 */}
        <View ref={scrapAreaRef} collapsable={false} style={s.captureArea}>
          {/* captureRef는 이 View의 자손만 캡처한다 — 예전엔 이게 형제 노드로 화면 뒤에만 깔려 있어서
              화면엔 보이지만 저장/공유한 이미지엔 안 보이고(투명 배경이 검은색으로 나옴) 빠졌었다. */}
          <View style={s.bottomThirdBg} pointerEvents="none" />
          <Text style={s.dateText}>{scrap.travelDate}</Text>
          <Text style={s.titleText} numberOfLines={1} ellipsizeMode="tail">
            {scrap.title}
          </Text>
          <Text style={s.subtitleText} numberOfLines={1} ellipsizeMode="tail">
            {scrap.dogName}와 함께한 하루
          </Text>

          <PawIcon width={29} height={27} color={Colors.coralBorder} style={s.pawTopRight1} />
          <PawIcon width={25} height={22} color={Colors.coralBorder} style={s.pawTopRight2} />
          <PawIcon width={33} height={31} color={Colors.coralBorder} style={s.pawTopRight3} />

          {/* 발자국 3개보다 나중에 그려야(=JSX 순서상 뒤) 로고/글자가 발자국에 안 가리고 앞에 온다. */}
          <View style={s.brandMark} pointerEvents="none">
            <Image source={require('@/assets/splash/logo.png')} style={s.brandLogo} resizeMode="contain" />
          </View>
          <Text style={s.brandText} pointerEvents="none">
            견주여행
          </Text>

          <View style={s.photoArea}>
            <View style={s.landscapeBg} pointerEvents="none">
              <SplashLandscape width={SCRAP_WIDTH} height={SCRAP_WIDTH / LANDSCAPE_ASPECT} />
            </View>
            <PolaroidPhoto
              uri={photoUris[0]}
              rotate="-6deg"
              showTape
              onPress={() => pickPhoto(0)}
              saving={isServerSaving}
              onLoadEnd={() => {
                const uri = photoUris[0];
                if (uri) setLoadedPhotoUris((prev) => new Set(prev).add(uri));
              }}
              style={s.photoBack}
            />
            <PolaroidPhoto
              uri={photoUris[1]}
              rotate="5deg"
              showTape
              onPress={() => pickPhoto(1)}
              saving={isServerSaving}
              onLoadEnd={() => {
                const uri = photoUris[1];
                if (uri) setLoadedPhotoUris((prev) => new Set(prev).add(uri));
              }}
              style={s.photoFront}
            />
            <View style={s.dogProfileOverlay}>
              <DogProfileImage uri={scrap.dogProfileImageUri} />
            </View>
          </View>

          <View style={s.footprintGroupCard}>
            <FootprintSummaryCard dogName={scrap.dogName} footprintCount={footprintCount} />

            <RouteSnapshotCard
              stops={scrap.stops}
              routePath={routePath}
              stampIndex={scrap.stampIndex}
              onMapReady={() => setIsMapReady(true)}
            />
          </View>
        </View>
      </ScrollView>

      <View style={[s.actionRow, extraBottomInset > 0 && { paddingBottom: Spacing.md + extraBottomInset }]}>
        <TouchableOpacity
          style={[s.actionBtn, s.actionBtnOutline, actionsDisabled && s.actionBtnDisabled]}
          activeOpacity={0.85}
          disabled={actionsDisabled}
          onPress={saveToGallery}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.coral} />
          ) : (
            <Text style={s.actionBtnOutlineText}>이미지로 저장</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, s.actionBtnFilled, actionsDisabled && s.actionBtnDisabled]}
          activeOpacity={0.85}
          disabled={actionsDisabled}
          onPress={shareImage}
        >
          {isSharing ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={s.actionBtnFilledText}>SNS 공유</Text>
          )}
        </TouchableOpacity>
      </View>

      <Toast
        message={toastMsg}
        onHide={() => setToastMsg(null)}
        icon={<ToastDailyRecordIcon width={18} height={20} />}
      />

      <PhotoPermissionModal
        visible={showPhotoPermissionModal}
        onCancel={() => setShowPhotoPermissionModal(false)}
        onOpenSettings={() => {
          setShowPhotoPermissionModal(false);
          Linking.openSettings();
        }}
      />
    </SafeAreaView>
    </SwipeBackScreen>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  bottomThirdBg: {
    // height를 %로 고정하면 captureArea 실제 콘텐츠 높이보다 짧게 계산될 수 있어(사진 위치에 따라
    // 카드 전체 높이가 달라짐) 스크롤 맨 아래에 흰 여백이 남았다. top만 %로 두고 bottom은 0으로
    // 고정해서, 카드 실제 끝까지 항상 꽉 차게 늘어나도록 한다.
    position: 'absolute',
    left: 0,
    right: 0,
    top: '60%',
    bottom: 0,
    backgroundColor: '#D4D7BB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1, lineHeight: 28 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  scrollContent: { paddingBottom: 0 },
  captureArea: {
    // bottomThirdBg(하단 배경색)가 이 위에 덧그려진다. 캡처 이미지에는 이 View의 자손만
    // 담기므로, 배경도 (뒤의 SafeAreaView색 말고) 여기 직접 칠해둬야 저장/공유했을 때 나온다.
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  pawTopRight1: {
    position: 'absolute',
    top: 6,
    right: 54,
    transform: [{ rotate: '-8deg' }],
  },
  pawTopRight2: {
    position: 'absolute',
    top: 40,
    right: 76,
    transform: [{ rotate: '12deg' }],
  },
  pawTopRight3: {
    position: 'absolute',
    top: 75,
    right: 58,
    transform: [{ rotate: '-14deg' }],
  },
  brandMark: {
    position: 'absolute',
    top: 20,
    right: 8,
    alignItems: 'center',
  },
  brandLogo: { width: 68, height: 68 },
  brandText: {
    position: 'absolute',
    top: 90,
    right: 20,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'left',
    letterSpacing: 1,
    marginLeft: 16,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textBody1,
    textAlign: 'left',
    marginTop: 4,
    marginLeft: 16,
  },
  subtitleText: {
    fontSize: 14,
    color: Colors.textBody2,
    textAlign: 'left',
    marginTop: 4,
    marginLeft: 16,
  },
  photoArea: {
    height: 220,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  polaroid: {
    backgroundColor: Colors.white,
    padding: 8,
    paddingBottom: 28,
    borderRadius: 4,
    shadowColor: '#3A3330',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  // 0%(photoArea 가장자리에 딱 붙임)로 둬야 화면 밖으로 넘치지 않는다 — 음수 인셋을 쓰면
  // 화면 폭이 좁은 기기에서 사진이 화면 밖으로 잘릴 수 있다.
  photoBack: { position: 'absolute', left: 0, top: 0, zIndex: 1 },
  photoFront: { position: 'absolute', right: 0, top: 28, zIndex: 2 },
  polaroidPhoto: {
    // 가로 4 : 세로 3 비율
    width: 168,
    height: 126,
    borderRadius: 2,
    backgroundColor: Colors.bgWarm,
  },
  polaroidPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  polaroidPlaceholderText: { fontSize: 12, color: Colors.textMuted },
  polaroidSavingOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 28,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tape: {
    position: 'absolute',
    top: -14,
    left: '50%',
    marginLeft: -28,
    width: 56,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    transform: [{ rotate: '-3deg' }],
    zIndex: 5,
  },
  dogProfileOverlay: {
    position: 'absolute',
    top: 118,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  // photoArea 박스 안에서만 배경으로 깔린다 — 별도 공간을 차지하지 않아서 발자국 카드 위치엔
  // 영향을 안 준다. photoArea(260)보다 이미지 자체 높이가 낮아서 넘치지 않는다.
  landscapeBg: {
    position: 'absolute',
    left: -Spacing.xl,
    right: -Spacing.xl,
    bottom: -140,
    zIndex: 0,
  },
  dogProfileWrap: {
    width: 76,
    height: 76,
    borderRadius: Radius.full,
    borderWidth: 3,
    borderColor: Colors.background,
    backgroundColor: Colors.bgWarm,
    overflow: 'hidden',
    shadowColor: '#3A3330',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  dogProfileImage: { width: '100%', height: '100%' },
  // 발자국 지도 카드와 지도를 하나로 묶는 바깥 카드 — 흰 배경/모서리/그림자를 여기서 한 번만 준다.
  footprintGroupCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    shadowColor: '#3A3330',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  footprintHeader: { marginBottom: Spacing.md },
  footprintHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footprintTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textBody1, marginRight: Spacing.sm },
  footprintSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  footprintCountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footprintCount: { fontSize: 22, fontWeight: '700', color: Colors.coral },
  footprintPawIcon: { width: 20, height: 20 },
  mapCard: {
    height: MAP_CARD_HEIGHT,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bgWarm,
    position: 'relative',
  },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapPlaceholderText: { fontSize: 13, color: Colors.textMuted },
  // 방문한 관광지 중 무작위로 선정된 스탬프 — 지도 오른쪽 하단에 배치.
  mapBadgeOverlay: { position: 'absolute', right: 12, bottom: 12 },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: '#D4D7BB',
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnOutline: { backgroundColor: Colors.bgWarm },
  actionBtnOutlineText: { color: Colors.textBody1, fontSize: 15, fontWeight: '600' },
  actionBtnFilled: { backgroundColor: Colors.coral },
  actionBtnFilledText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  actionBtnDisabled: { opacity: 0.5 },
});
