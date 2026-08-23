import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import SwipeBackScreen from '@/components/ui/SwipeBackScreen';
import LoginIllustration from '@/assets/login/login-illustration.svg';
import TabScheduleIcon from '@/assets/icons/tab-schedule.svg';
import UpdateNewsCategoryBadge from '@/components/home/UpdateNewsCategoryBadge';
import { UPDATE_NEWS, getReadUpdateNewsIds, markUpdateNewsRead } from '@/constants/updateNews';

export default function UpdateNewsView({
  onBack,
  underlay,
}: {
  onBack: () => void;
  underlay?: React.ReactNode;
}) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getReadUpdateNewsIds().then(setReadIds);
  }, []);

  const handlePress = async (id: string) => {
    if (readIds.has(id)) return;
    await markUpdateNewsRead(id);
    setReadIds((prev) => new Set(prev).add(id));
  };

  return (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>업데이트 소식</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          <View style={s.heroCard}>
            <View style={s.heroTextCol}>
              <Text style={s.heroTitle}>안녕하세요.{'\n'}견주여행입니다!</Text>
              <Text style={s.heroSubtitle}>사랑하는 반려견과 함께 경주를{'\n'}여행하며 추억을 쌓아가요~</Text>
            </View>
            <LoginIllustration width={205} height={164} style={s.heroIllustration} />
          </View>

          {UPDATE_NEWS.map((item) => {
            const unread = !readIds.has(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={s.card}
                activeOpacity={0.85}
                onPress={() => handlePress(item.id)}
              >
                {unread && <View style={s.unreadDot} />}
                <UpdateNewsCategoryBadge category={item.category} />
                <View style={s.cardTextCol}>
                  <Text style={s.cardTitle}>{item.title}</Text>
                  <Text style={s.cardDescription}>{item.description}</Text>
                  <View style={s.dateRow}>
                    <TabScheduleIcon width={12} height={12} color={Colors.textMuted} />
                    <Text style={s.dateText}>{item.date}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={s.footer}>
            <Text style={s.footerTitle}>업데이트 소식을 모두 확인했어요</Text>
            <Text style={s.footerSubtitle}>새로운 업데이트 소식을 기다려 주세요.</Text>
          </View>
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
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.bgWarm,
    height: 181,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
    opacity: 1,
    // 화면 콘텐츠 좌우 여백(scrollContent)이 20px라, 여기서 16px만 남도록 4px씩 파고든다.
    marginHorizontal: -(Spacing.xl - Spacing.lg),
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  heroTextCol: { flex: 1 },
  heroTitle: { fontSize: 18, fontWeight: '600', color: '#6B6260', lineHeight: 25 },
  heroSubtitle: { fontSize: 13, fontWeight: '300', color: '#6B6260', marginTop: Spacing.sm, lineHeight: 19 },
  heroIllustration: { alignSelf: 'center', marginLeft: Spacing.xs, marginRight: -Spacing.lg },
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
    gap: Spacing.md,
    shadowColor: '#3A3330',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#6B6260' },
  cardDescription: { fontSize: 13, color: Colors.textBody2, lineHeight: 19 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, color: Colors.textMuted },
  footer: { alignItems: 'center', marginTop: Spacing.xxl * 1.5 },
  footerTitle: { fontSize: 14, fontWeight: '600', color: '#6B6260' },
  footerSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 6 },
});
