import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatDistance, formatWalkDuration } from '@/utils/distance';
import { parseTags, toMapPlace } from '@/utils/placeMappers';
import PlaceThumbnail from '@/components/ui/PlaceThumbnail';
import Badge, { BADGE_TONE_COLORS } from '@/components/ui/Badge';
import Toast from '@/components/ui/Toast';
import WalkingIcon from '@/assets/icons/walking.svg';
import { PLACE_TAG_STYLE, DEFAULT_PLACE_TAG_STYLE } from '@/constants/badgeConfig';
import {
  RecommendedRouteResultResponse,
  saveRecommendedRouteSchedule,
  saveBookmark,
  deleteBookmarks,
  getBookmarks,
  searchPlaces,
  ApiError,
} from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';

export default function RecommendedRouteResultView({
  result,
  onBack,
  onSaved,
}: {
  result: RecommendedRouteResultResponse;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [likedPlaceIds, setLikedPlaceIds] = useState<number[]>([]);
  const [departureImageUri, setDepartureImageUri] = useState<string | null>(null);

  const places = [...result.recommendedPlaces].sort((a, b) => a.visitOrder - b.visitOrder);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const bookmarks = await getBookmarks(undefined, token);
        const bookmarkedIds = new Set(bookmarks.map((b) => b.id));
        setLikedPlaceIds(places.filter((p) => bookmarkedIds.has(p.placeId)).map((p) => p.placeId));
      } catch (e) {
        // 저장 여부 표시는 부가 정보라 실패해도 조용히 무시
      }
    })();
  }, []);

  // 출발지(황리단길 등)는 응답에 사진이 없어서, DB에 등록된 동명 장소를 검색해 대표 사진을 대신 가져온다.
  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const found = await searchPlaces(
          { keyword: result.departure.name, categories: ['ATTRACTION'], size: 10 },
          token
        );
        const match = found.places.find((p) => p.name.includes(result.departure.name)) ?? found.places[0];
        if (match) setDepartureImageUri(toMapPlace(match).imageUri);
      } catch (e) {
        // 출발지 사진은 부가 정보라 실패해도 조용히 무시
      }
    })();
  }, [result.departure.name]);

  const toggleLike = async (placeId: number) => {
    const token = await getAccessToken();
    if (!token) return;
    const liked = likedPlaceIds.includes(placeId);
    try {
      if (liked) {
        await deleteBookmarks([placeId], token);
        setLikedPlaceIds((prev) => prev.filter((id) => id !== placeId));
      } else {
        await saveBookmark(placeId, token);
        setLikedPlaceIds((prev) => [...prev, placeId]);
      }
    } catch (e) {
      setToastMsg(e instanceof ApiError ? e.message : '요청에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleSave = async () => {
    if (saving) return;
    const token = await getAccessToken();
    if (!token) {
      setToastMsg('로그인 정보가 없어요. 다시 로그인해주세요.');
      return;
    }
    setSaving(true);
    try {
      await saveRecommendedRouteSchedule(result.recommendationId, token);
      setToastMsg('일정으로 저장했어요!');
      setTimeout(onSaved, 900);
    } catch (e) {
      setToastMsg(e instanceof ApiError ? e.message : '일정 저장에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>홈</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <View style={[s.placeCard, s.departureCard]}>
          <PlaceThumbnail uri={departureImageUri} style={s.placeImg} />
          <View style={s.placeInfo}>
            <Text style={s.placeName} numberOfLines={1}>
              {result.departure.name}
            </Text>
          </View>
        </View>

        {places.map((place, i) => {
          const tags = parseTags(place.petAccessType, place.petRequirements);
          const liked = likedPlaceIds.includes(place.placeId);
          return (
            <View key={place.placeId}>
              {i > 0 && (
                <View style={s.segmentPillRow}>
                  <View style={s.segmentPill}>
                    <WalkingIcon width={12} height={12} color={Colors.textMuted} />
                    <Text style={s.segmentText}>
                      도보 {formatWalkDuration(Math.round(place.walkingDurationSeconds / 60))} ·{' '}
                      {formatDistance(place.walkingDistanceMeters)}
                    </Text>
                  </View>
                </View>
              )}
              <View style={s.placeCard}>
                <PlaceThumbnail uri={place.imageUrl} style={s.placeImg} />
                <View style={s.placeInfo}>
                  <Text style={s.placeName} numberOfLines={1}>
                    {place.name}
                  </Text>
                  {tags.length > 0 && (
                    <View style={s.placeTags}>
                      {tags.map((tag) => {
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
                  )}
                </View>
                <TouchableOpacity
                  style={s.heartBtn}
                  activeOpacity={0.7}
                  onPress={() => toggleLike(place.placeId)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[s.heart, liked && s.heartActive]}>{liked ? '♥' : '♡'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={s.bottomBar}>
        <TouchableOpacity style={s.saveBtn} activeOpacity={0.85} disabled={saving} onPress={handleSave}>
          {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={s.saveBtnText}>일정 저장하기</Text>}
        </TouchableOpacity>
      </View>

      <Toast message={toastMsg} onHide={() => setToastMsg(null)} bottom={90} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  segmentPillRow: { alignItems: 'center', paddingVertical: Spacing.sm },
  segmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    height: 26,
  },
  segmentText: { fontSize: 11, color: Colors.textMuted },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  departureCard: { marginBottom: Spacing.lg },
  placeImg: { width: 56, height: 56, borderRadius: Radius.sm },
  placeInfo: { flex: 1, gap: 6 },
  placeName: { fontSize: 14, fontWeight: '600', color: Colors.textBody1 },
  placeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heartBtn: { padding: 2 },
  heart: { fontSize: 20, color: Colors.coral, opacity: 0.35 },
  heartActive: { opacity: 1 },
  bottomBar: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  saveBtn: {
    backgroundColor: Colors.coral,
    borderRadius: Radius.lg,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.coral,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
