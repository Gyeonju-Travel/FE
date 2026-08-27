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
      try {
        // 로컬 도착 기록(arrivedIds)이 0개여도 "정말 아무 데도 안 간 것"과 "도착할 때마다
        // 서버(visitPlace)엔 남았는데 로그아웃/탈퇴/재가입 등으로 이 기기의 로컬 기록만
        // 지워진 것"을 구분할 수 없다. 로컬이 비어있다고 서버 확인도 없이 바로 "기록 없음"
        // 처리하면 후자의 경우 실제로 있는 기록을 사용자에게 영영 못 보여주게 되므로,
        // 로컬이 비어있어도 일단 서버에 물어보고 진짜 내용이 있을 때만 보여준다.
        // (GET stamp-album은 앨범이 없으면 빈 앨범을 새로 만들어서 응답하는 API라 — 즉
        // "정말 아무 기록도 없는" 경우에도 이 호출 자체는 실패하지 않고 0으로 채워진 앨범이
        // 온다 — 실패 여부가 아니라 응답 내용(거리/사진/로컬 도착기록)으로 판단해야 한다.)
        const album = await getStampAlbum(Number(pending.scheduleId), accessToken);
        if (cancelled) return;

        const hasRecord = arrivedIds.length > 0 || album.totalDistanceMeters > 0 || album.photoUrls.length > 0;
        if (!hasRecord) {
          setLoadError('이 일정은 다녀온 곳이 없어서 기록할 내용이 없어요.');
          return;
        }

        // 목적지로 저장은 해놨지만 실제로 안 간 곳은 경로/스크랩에서 뺀다 — 출발지는 항상
        // 실제로 거쳤으니 예외. 로컬 도착 기록이 없는데도 서버엔 기록(거리/사진)이 있다면
        // (위 주석 상황), 어느 장소를 들렀는지 서버 응답만으로는 알 수 없으니 계획했던 장소
        // 전체를 대신 보여준다(개별 장소 구분은 못 해도 기록 자체는 볼 수 있게).
        const visitedPlaces = arrivedIds.length > 0
          ? pending.places.filter((p) => arrivedIds.includes(p.id))
          : pending.places;
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
