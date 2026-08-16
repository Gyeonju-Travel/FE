import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { stampIndexFromBackendName } from '@/constants/stamps';
import { TodaysScrapSchedule, markScheduleScrapped } from '@/utils/locationTracking';
import { getStampAlbum } from '@/utils/api';
import { ScrapData } from '@/types/stampAlbum';
import StampAlbumScreen from '@/components/mypage/StampAlbumView';

function formatTravelDate(isoDate: string): string {
  return isoDate.replace(/-/g, ' · ');
}

function titleFromPlaces(places: TodaysScrapSchedule['places']): string {
  if (places.length === 0) return '오늘의 경주';
  const first = places[0].name;
  const last = places[places.length - 1].name;
  return first === last ? first : `${first} → ${last}`;
}

export default function TodayScrapView({
  pending,
  dogName,
  dogProfileImageUri,
  accessToken,
  onBack,
}: {
  pending: TodaysScrapSchedule;
  dogName: string;
  dogProfileImageUri?: string;
  accessToken: string;
  onBack: () => void;
}) {
  const [scrap, setScrap] = useState<ScrapData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStampAlbum(Number(pending.scheduleId), accessToken)
      .then((album) => {
        if (cancelled) return;
        setScrap({
          id: pending.scheduleId,
          title: titleFromPlaces(pending.places),
          travelDate: formatTravelDate(album.date),
          dogName,
          dogProfileImageUri,
          selectedPhotoUris: album.photoUrls,
          stops: pending.places.map((p) => ({ id: p.id, name: p.name, latitude: p.lat, longitude: p.lng })),
          totalDistanceInMeters: album.totalDistanceMeters,
          stampIndex: stampIndexFromBackendName(album.stampName),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pending, dogName, dogProfileImageUri, accessToken]);

  if (loadFailed) {
    return (
      <SafeAreaView style={s.loading}>
        <Text style={s.errorText}>스크랩 정보를 불러오지 못했어요.</Text>
        <TouchableOpacity style={s.retryBtn} activeOpacity={0.85} onPress={onBack}>
          <Text style={s.retryBtnText}>닫기</Text>
        </TouchableOpacity>
      </SafeAreaView>
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
