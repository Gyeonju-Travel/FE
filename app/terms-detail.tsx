import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing } from '@/constants/theme';
import { TERMS_CONTENT, TermsKey } from '@/constants/termsContent';

// "## "=조항 제목, "### "=하위 소제목, "- "=목록 항목, 그 외=본문 문단으로 렌더링한다.
function renderBody(body: string) {
  return body.split('\n').map((line, i) => {
    if (!line.trim()) return null;
    if (line.startsWith('## ')) {
      return (
        <Text key={i} style={styles.heading}>
          {line.slice(3)}
        </Text>
      );
    }
    if (line.startsWith('### ')) {
      return (
        <Text key={i} style={styles.subHeading}>
          {line.slice(4)}
        </Text>
      );
    }
    if (line.startsWith('- ')) {
      return (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{line.slice(2)}</Text>
        </View>
      );
    }
    return (
      <Text key={i} style={styles.paragraph}>
        {line}
      </Text>
    );
  });
}

export default function TermsDetailScreen() {
  const { type } = useLocalSearchParams<{ type: TermsKey }>();
  const doc = TERMS_CONTENT[type];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{doc.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {renderBody(doc.body)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textBody1, flexShrink: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textBody1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textBody1,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
    paddingLeft: Spacing.xs,
  },
  bulletDot: { fontSize: 13, lineHeight: 20, color: Colors.textMuted, marginRight: 6 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20, color: Colors.textMuted },
});
