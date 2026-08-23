import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import SwipeBackScreen from '@/components/ui/SwipeBackScreen';
import LoginIllustration from '@/assets/login/login-illustration.svg';
import BellIcon from '@/assets/home/bell.svg';
import { getNotifications, markNotificationRead, NotificationListItemResponse } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';

// 지금 서버가 실제로 만드는 알림은 "스탬프 앨범 준비" 하나뿐이라 그 문구를 그대로 쓴다.
// GET /api/notifications 응답(NotificationListItemResponse)엔 title/body/type이 안 내려오기
// 때문에(백엔드 확인 필요), 알림 종류별로 다른 문구를 보여줄 방법이 아직 없다 — 새 알림 종류가
// 생기면 이 하드코딩은 더 이상 안 맞으므로, 그때는 꼭 백엔드 응답에서 받아오도록 바꿔야 한다.
const FALLBACK_TITLE = '일정이 종료됐나요?';
const FALLBACK_BODY = '스크랩으로 오늘 하루를 기록해보세요.';

export default function NotificationListView({
  onBack,
  underlay,
}: {
  onBack: () => void;
  underlay?: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationListItemResponse[]>([]);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const result = await getNotifications(token);
        setNotifications(result.notifications);
      } catch {
        // 조회 실패 시 빈 목록으로 보여준다.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePress = async (item: NotificationListItemResponse) => {
    if (item.read) return;
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === item.notificationId ? { ...n, read: true } : n))
    );
    const token = await getAccessToken();
    if (!token) return;
    try {
      await markNotificationRead(item.notificationId, token);
    } catch {
      // 읽음 처리 실패는 무시 — 다음에 목록을 다시 열면 서버 상태로 맞춰진다.
    }
  };

  return (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>알림</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          <View style={s.heroCard}>
            <View style={s.heroTextCol}>
              <Text style={s.heroTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
                안녕하세요.{'\n'}견주여행입니다!
              </Text>
              <Text style={s.heroSubtitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
                사랑하는 반려견과 함께 경주를{'\n'}여행하며 추억을 쌓아가요~
              </Text>
            </View>
            <LoginIllustration width={195} height={156} style={s.heroIllustration} />
          </View>

          {loading ? (
            <View style={s.centerFill}>
              <ActivityIndicator color={Colors.coral} />
            </View>
          ) : notifications.length === 0 ? (
            <View style={s.centerFill}>
              <BellIcon width={28} height={34} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>받은 알림이 없어요</Text>
            </View>
          ) : (
            notifications.map((item) => (
              <TouchableOpacity
                key={item.notificationId}
                style={s.card}
                activeOpacity={0.85}
                onPress={() => handlePress(item)}
              >
                {!item.read && <View style={s.unreadDot} />}
                <View style={s.cardTextCol}>
                  <Text style={s.cardTitle}>{FALLBACK_TITLE}</Text>
                  <Text style={s.cardDescription}>{FALLBACK_BODY}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </SwipeBackScreen>
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
  centerFill: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingTop: Spacing.xxl * 1.5 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  heroTextCol: { flex: 1 },
  heroTitle: { fontSize: 18, fontWeight: '700', color: Colors.textBody1, lineHeight: 25 },
  heroSubtitle: { fontSize: 13, color: Colors.textBody2, marginTop: Spacing.sm, lineHeight: 19 },
  heroIllustration: { marginLeft: Spacing.xs, marginRight: -Spacing.lg, marginVertical: -Spacing.md },
  card: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  unreadDot: {
    position: 'absolute',
    top: -4,
    left: Spacing.lg - 4,
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.coral,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  cardTextCol: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textBody1 },
  cardDescription: { fontSize: 13, color: Colors.textBody2, lineHeight: 19 },
});
