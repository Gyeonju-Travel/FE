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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { STAMP_ICONS, STAMP_LOCKED_ICON } from '@/constants/stamps';
import { ScrapData, RouteStop } from '@/types/stampAlbum';
import { calculateFootprintCount } from '@/utils/footprintCalculator';
import { haversineMeters } from '@/utils/distance';
import { fetchPedestrianRoute, LatLng, PedestrianRouteResult } from '@/utils/pedestrianRoute';
import { saveStampAlbumPhotos, ApiError } from '@/utils/api';
import { useScrapCapture } from '@/hooks/useScrapCapture';
import KakaoMap from '@/components/map/KakaoMap';
import Toast from '@/components/ui/Toast';
import PhotoPermissionModal from '@/components/ui/PhotoPermissionModal';
import DogPhotoBlank from '@/assets/mypage/dog-photo-blank.svg';
import ToastDailyRecordIcon from '@/assets/icons/toast/daily-record.svg';

/** 방문지 목록을 Tmap 보행자 경로 API로 이어서, 경로보기와 동일한 실제 도보 경로/거리를 구한다.
 * 키가 없거나 특정 구간 요청이 실패하면 그 구간만 두 지점 간 직선(Haversine)으로 대체한다. */
function useScrapRoute(stops: RouteStop[]) {
  const stopLatLngs = useMemo<LatLng[]>(
    () => stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
    [stops]
  );
  const [segments, setSegments] = useState<(PedestrianRouteResult | null)[]>([]);

  React.useEffect(() => {
    if (stopLatLngs.length < 2) {
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
  }, [stopLatLngs]);

  const routePath = useMemo<LatLng[]>(
    () =>
      stopLatLngs.slice(0, -1).flatMap((from, i) => segments[i]?.path ?? [from, stopLatLngs[i + 1]]),
    [stopLatLngs, segments]
  );

  const distanceMeters = useMemo(
    () =>
      stopLatLngs.slice(0, -1).reduce((sum, from, i) => {
        const segment = segments[i];
        if (segment) return sum + segment.distanceMeters;
        return sum + haversineMeters(from.lat, from.lng, stopLatLngs[i + 1].lat, stopLatLngs[i + 1].lng);
      }, 0),
    [stopLatLngs, segments]
  );

  return { routePath, distanceMeters };
}

function PolaroidPhoto({
  uri,
  rotate,
  showTape,
  onPress,
  style,
}: {
  uri?: string;
  rotate: string;
  showTape?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[s.polaroid, { transform: [{ rotate }] }, style]}
    >
      {showTape && <View style={s.tape} />}
      {uri ? (
        <Image source={{ uri }} style={s.polaroidPhoto} resizeMode="cover" />
      ) : (
        <View style={[s.polaroidPhoto, s.polaroidPlaceholder]}>
          <Text style={s.polaroidPlaceholderText}>사진 추가</Text>
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
        <DogPhotoBlank width={64} height={64} />
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
    <View style={s.footprintCard}>
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
  );
}

/** 방문한 관광지 중 서버가 무작위로 선정한 스탬프. stampIndex가 없으면 표시하지 않는다. */
function TravelBadge({ stampIndex }: { stampIndex?: number }) {
  const StampIcon = stampIndex !== undefined ? STAMP_ICONS[stampIndex] ?? STAMP_LOCKED_ICON : null;
  if (!StampIcon) return null;
  return (
    <View style={s.badgeWrap}>
      <StampIcon width={40} height={40} />
    </View>
  );
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
        <KakaoMap routePlaces={routePlaces} routePath={routePath} onMapReady={onMapReady} />
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
  /** 제공되면 "저장하기" 버튼이 나타나 선택한 사진을 서버(오늘 일정의 스크랩 앨범)에 업로드한다. */
  serverSave?: {
    scheduleId: number;
    accessToken: string;
    onSaved?: () => void;
  };
}

export default function StampAlbumScreen({ scrap, onBack, serverSave }: StampAlbumScreenProps) {
  const scrapAreaRef = useRef<View>(null);
  const [photoUris, setPhotoUris] = useState<(string | undefined)[]>([
    scrap.selectedPhotoUris[0],
    scrap.selectedPhotoUris[1],
  ]);
  // 저장된 경로가 없으면 기다릴 지도가 없으니 바로 준비된 것으로 본다.
  const [isMapReady, setIsMapReady] = useState(scrap.stops.length === 0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showPhotoPermissionModal, setShowPhotoPermissionModal] = useState(false);
  const [isServerSaving, setIsServerSaving] = useState(false);
  const { isSaving, isSharing, saveToGallery, shareImage } = useScrapCapture(scrapAreaRef, () => {
    setToastMsg('하루 기록이 저장됐어요!');
  });

  const { routePath, distanceMeters } = useScrapRoute(scrap.stops);
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
    const uri = result.assets[0].uri;
    setPhotoUris((prev) => {
      const next = [...prev];
      next[index] = uri;
      return next;
    });
  };

  const selectedPhotoUris = photoUris.filter((uri): uri is string => !!uri);

  const handleServerSave = async () => {
    if (!serverSave || isServerSaving || selectedPhotoUris.length === 0) return;
    setIsServerSaving(true);
    try {
      await saveStampAlbumPhotos(serverSave.scheduleId, selectedPhotoUris, serverSave.accessToken);
      setToastMsg('하루 기록이 저장됐어요!');
      serverSave.onSaved?.();
    } catch (e) {
      setToastMsg(e instanceof ApiError ? e.message : '저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsServerSaving(false);
    }
  };

  const isBusy = isSaving || isSharing;
  const actionsDisabled = isBusy || !isMapReady;

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>스탬프 앨범</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {/* 캡처/공유 대상 영역: 헤더와 하단 버튼은 여기 포함되지 않는다 */}
        <View ref={scrapAreaRef} collapsable={false} style={s.captureArea}>
          <Text style={s.dateText}>{scrap.travelDate}</Text>
          <Text style={s.titleText} numberOfLines={1} ellipsizeMode="tail">
            {scrap.title}
          </Text>
          <Text style={s.subtitleText} numberOfLines={1} ellipsizeMode="tail">
            {scrap.dogName}와 함께한 하루
          </Text>

          <View style={s.photoArea}>
            <PolaroidPhoto
              uri={photoUris[0]}
              rotate="-6deg"
              showTape
              onPress={() => pickPhoto(0)}
              style={s.photoBack}
            />
            <PolaroidPhoto
              uri={photoUris[1]}
              rotate="5deg"
              showTape
              onPress={() => pickPhoto(1)}
              style={s.photoFront}
            />
            <View style={s.dogProfileOverlay}>
              <DogProfileImage uri={scrap.dogProfileImageUri} />
            </View>
          </View>

          <FootprintSummaryCard dogName={scrap.dogName} footprintCount={footprintCount} />

          <RouteSnapshotCard
            stops={scrap.stops}
            routePath={routePath}
            stampIndex={scrap.stampIndex}
            onMapReady={() => setIsMapReady(true)}
          />
        </View>
      </ScrollView>

      {serverSave && (
        <View style={s.serverSaveRow}>
          <TouchableOpacity
            style={[s.serverSaveBtn, (isServerSaving || selectedPhotoUris.length === 0) && s.actionBtnDisabled]}
            activeOpacity={0.85}
            disabled={isServerSaving || selectedPhotoUris.length === 0}
            onPress={handleServerSave}
          >
            {isServerSaving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={s.serverSaveBtnText}>저장하기</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={s.actionRow}>
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
        subtitle={toastMsg === '하루 기록이 저장됐어요!' ? '마이페이지 > 방문한 장소 배너 클릭 후 확인' : undefined}
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
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1, lineHeight: 28 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  scrollContent: { paddingBottom: 24 },
  captureArea: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
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
    height: 260,
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
  photoBack: { position: 'absolute', left: '4%', top: 0, zIndex: 1 },
  photoFront: { position: 'absolute', right: '4%', top: 28, zIndex: 2 },
  polaroidPhoto: {
    // 가로 4 : 세로 3 비율
    width: 192,
    height: 144,
    borderRadius: 2,
    backgroundColor: Colors.bgWarm,
  },
  polaroidPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  polaroidPlaceholderText: { fontSize: 12, color: Colors.textMuted },
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
  dogProfileOverlay: { position: 'absolute', right: 4, bottom: 24, zIndex: 3 },
  dogProfileWrap: {
    width: 64,
    height: 64,
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
  footprintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  footprintTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textBody1, marginRight: Spacing.sm },
  footprintCountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footprintCount: { fontSize: 22, fontWeight: '700', color: Colors.coral },
  footprintPawIcon: { width: 20, height: 20 },
  mapCard: {
    height: 200,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.bgWarm,
    position: 'relative',
  },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapPlaceholderText: { fontSize: 13, color: Colors.textMuted },
  // 방문한 관광지 중 무작위로 선정된 스탬프 — 지도 왼쪽 하단에 배치.
  mapBadgeOverlay: { position: 'absolute', left: 12, bottom: 12 },
  badgeWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A3330',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  serverSaveRow: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, backgroundColor: Colors.background },
  serverSaveBtn: {
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverSaveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
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
  actionBtnFilled: { backgroundColor: Colors.bgWarm },
  actionBtnFilledText: { color: Colors.textBody1, fontSize: 15, fontWeight: '600' },
  actionBtnDisabled: { opacity: 0.5 },
});
