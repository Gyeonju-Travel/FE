import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { stampIndexFromBackendName } from '@/constants/stamps';
import { TodaysScrapSchedule, markScheduleScrapped, getArrivedPlaceIds } from '@/utils/locationTracking';
import { getStampAlbum, ApiError } from '@/utils/api';
import { ScrapData } from '@/types/stampAlbum';
import StampAlbumScreen from '@/components/mypage/StampAlbumView';
import SwipeBackScreen from '@/components/ui/SwipeBackScreen';

function formatTravelDate(isoDate: string): string {
  return isoDate.replace(/-/g, ' · ');
}

export default function TodayScrapView({
  pending,
  dogName,
  dogProfileImageUri,
  accessToken,
  onBack,
  underlay,
}: {
  pending: TodaysScrapSchedule;
  dogName: string;
  dogProfileImageUri?: string;
  accessToken: string;
  onBack: () => void;
  underlay?: React.ReactNode;
}) {
  const [scrap, setScrap] = useState<ScrapData | null>(null);
  // 방문한 곳이 한 곳도 없는 일정(예: 경주 밖에서 시작해 바로 자동 종료된 경우)은 서버에
  // 스탬프 앨범 자체가 안 만들어져 getStampAlbum이 실패한다. 실패 에러 코드를 추측해서
  // 매칭하는 대신, 이미 로컬에 있는 방문 기록을 먼저 확인해 0곳이면 서버 호출 자체를
  // 건너뛰고 바로 "다녀온 곳이 없다"고 안내한다.
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const arrivedIds = await getArrivedPlaceIds(pending.scheduleId);
      if (cancelled) return;
      if (arrivedIds.length === 0) {
        setLoadError('이 일정은 다녀온 곳이 없어서 기록할 내용이 없어요.');
        return;
      }
      try {
        const album = await getStampAlbum(Number(pending.scheduleId), accessToken);
        if (cancelled) return;
        // 목적지로 저장은 해놨지만 실제로 안 간 곳은 경로/스크랩에서 뺀다 — 출발지는 항상
        // 실제로 거쳤으니 예외.
        const visitedPlaces = pending.places.filter((p) => arrivedIds.includes(p.id));
        setScrap({
          id: pending.scheduleId,
          title: '오늘의 경주',
          travelDate: formatTravelDate(album.date),
          dogName,
          dogProfileImageUri,
          selectedPhotoUris: album.photoUrls,
          // 경로보기(RouteView)와 동일하게 출발지를 첫 지점으로 포함해야 경로/핀 번호가 맞게 표시된다.
          stops: [
            ...(pending.departure
              ? [{ id: 'departure', name: pending.departure.name, latitude: pending.departure.lat, longitude: pending.departure.lng }]
              : []),
            ...visitedPlaces.map((p) => ({ id: p.id, name: p.name, latitude: p.lat, longitude: p.lng })),
          ],
          totalDistanceInMeters: album.totalDistanceMeters,
          stampIndex: stampIndexFromBackendName(album.stampName),
        });
      } catch (e) {
        if (cancelled) return;
        setLoadError(
          e instanceof ApiError && e.code === 'STAMP_400_7'
            ? '이 일정은 다녀온 곳이 없어서 기록할 내용이 없어요.'
            : '스크랩 정보를 불러오지 못했어요.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, dogName, dogProfileImageUri, accessToken]);

  if (loadError) {
    return (
      <SwipeBackScreen onBack={onBack} underlay={underlay}>
        <SafeAreaView style={s.loading}>
          <Text style={s.errorText}>{loadError}</Text>
          <TouchableOpacity style={s.retryBtn} activeOpacity={0.85} onPress={onBack}>
            <Text style={s.retryBtnText}>닫기</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </SwipeBackScreen>
    );
  }

  if (!scrap) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={Colors.coral} />
      </View>
    );
  }

  return (
    <StampAlbumScreen
      scrap={scrap}
      onBack={onBack}
      underlay={underlay}
      serverSave={{
        scheduleId: Number(pending.scheduleId),
        accessToken,
        onSaved: () => markScheduleScrapped(pending.scheduleId),
      }}
    />
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  errorText: { fontSize: 14, color: Colors.textBody2 },
  retryBtn: {
    height: 44,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textBody1 },
});
