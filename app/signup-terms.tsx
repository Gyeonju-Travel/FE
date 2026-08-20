import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import Toast from '@/components/ui/Toast';
import { agreeToTerms, ApiError } from '@/utils/api';

interface TermItem {
  key: 'service' | 'privacy' | 'location' | 'age';
  label: string;
}

const TERMS: TermItem[] = [
  { key: 'service', label: '이용 약관 동의' },
  { key: 'privacy', label: '개인정보 수집 및 이용 동의' },
  { key: 'location', label: '위치기반 서비스 이용 동의' },
  { key: 'age', label: '만 14세 이상 사용자' },
];

export default function SignupTermsScreen() {
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allAgreed = TERMS.every((t) => agreed[t.key]);

  const handleNext = async () => {
    setSubmitting(true);
    try {
      const result = await agreeToTerms({
        termsOfServiceAgreed: !!agreed.service,
        privacyPolicyAgreed: !!agreed.privacy,
        locationServiceAgreed: !!agreed.location,
        ageOverFourteenAgreed: !!agreed.age,
      });
      router.push({ pathname: '/signup', params: { termsAgreementToken: result.agreementToken } });
    } catch (e) {
      setToastMsg(e instanceof ApiError ? e.message : '약관 동의 처리에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAll = () => {
    const next = !allAgreed;
    setAgreed(Object.fromEntries(TERMS.map((t) => [t.key, next])));
  };

  const toggleOne = (key: string) => {
    setAgreed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>회원 가입</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.greeting}>
          안녕하세요.{'\n'}견주여행입니다!
        </Text>
        <Text style={styles.subtitle}>서비스 이용을 위한 약관 동의가 필요해요</Text>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.allAgreeRow} activeOpacity={0.8} onPress={toggleAll}>
          <View style={[styles.checkbox, allAgreed && styles.checkboxSelected]}>
            {allAgreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.allAgreeText}>약관 전체동의</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {TERMS.map((term) => {
          const checked = !!agreed[term.key];
          return (
            <View key={term.key} style={styles.termRow}>
              <TouchableOpacity
                style={styles.termRowMain}
                activeOpacity={0.8}
                onPress={() => toggleOne(term.key)}
              >
                <View style={[styles.checkbox, checked && styles.checkboxSelected]}>
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termLabel}>
                  <Text style={styles.requiredTag}>[필수]</Text> {term.label}
                </Text>
              </TouchableOpacity>
              {term.key !== 'age' && (
                <TouchableOpacity
                  style={styles.viewBtn}
                  activeOpacity={0.7}
                  onPress={() => router.push({ pathname: '/terms-detail', params: { type: term.key } })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.viewBtnText}>보기</Text>
                  <Text style={styles.viewBtnChevron}>›</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.primaryBtn, (!allAgreed || submitting) && styles.primaryBtnDisabled]}
          activeOpacity={0.85}
          disabled={!allAgreed || submitting}
          onPress={handleNext}
        >
          {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>다음</Text>}
        </TouchableOpacity>
      </View>

      <Toast message={toastMsg} onHide={() => setToastMsg(null)} bottom={120} />
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textBody1 },
  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl },
  greeting: { fontSize: 24, fontWeight: '700', color: Colors.textBody1, lineHeight: 32 },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginTop: Spacing.sm },
  bottomSection: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  allAgreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  allAgreeText: { fontSize: 15, fontWeight: '600', color: Colors.textBody1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: Spacing.sm },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 2,
  },
  termRowMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  termLabel: { fontSize: 14, color: Colors.textBody1, flexShrink: 1 },
  requiredTag: { color: Colors.secondary, fontWeight: '600' },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewBtnText: { fontSize: 13, color: Colors.textMuted },
  viewBtnChevron: { fontSize: 15, color: Colors.textMuted },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: Colors.checkboxActive,
    borderColor: Colors.checkboxActive,
  },
  checkmark: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  bottomBar: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  primaryBtn: {
    backgroundColor: Colors.coral,
    borderRadius: Radius.lg,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
