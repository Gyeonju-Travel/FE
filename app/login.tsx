import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import FormField, { EyeToggle } from '@/components/auth/FormField';
import LoginIllustration from '@/assets/login/login-illustration.svg';
import EmailIcon from '@/assets/login/field-email.svg';
import PasswordIcon from '@/assets/login/field-password.svg';
import EyeIcon from '@/assets/login/field-password-eye.svg';
import { login } from '@/utils/api';
import { saveTokens } from '@/utils/authStorage';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loginApiError, setLoginApiError] = useState<string | null>(null);

  const emailError = email.length > 0 && !EMAIL_REGEX.test(email)
    ? '이메일 주소 형식으로 입력해 주세요'
    : submitted && !email
    ? '이메일을 입력해 주세요.'
    : null;
  const passwordError = submitted && !password ? '비밀번호를 입력해 주세요.' : loginApiError;

  const handleLogin = async () => {
    setSubmitted(true);
    if (!email || !password || emailError) {
      return;
    }
    setLoading(true);
    console.log('[로그인] 시도:', email);
    try {
      const result = await login({ email, password });
      console.log('[로그인] 성공. memberId:', result.memberId, 'onboardingCompleted:', result.onboardingCompleted);
      await saveTokens(result.accessToken, result.refreshToken);
      router.replace(result.onboardingCompleted ? '/(tabs)' : '/signup-complete');
    } catch (e) {
      console.error('[로그인] 실패:', e);
      setLoginApiError('이메일 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.hero}>
            <LoginIllustration width={200} height={160} />
            <Text style={styles.subtitle}>반려견과 동행하는 경주 여행</Text>
          </View>

          <FormField
            Icon={EmailIcon}
            placeholder="이메일"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setLoginApiError(null);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            error={emailError}
          />
          <FormField
            Icon={PasswordIcon}
            placeholder="비밀번호"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setLoginApiError(null);
            }}
            secureTextEntry={!showPassword}
            textContentType="oneTimeCode"
            trailing={<EyeToggle visible={showPassword} onPress={() => setShowPassword((v) => !v)} Icon={EyeIcon} />}
            error={passwordError}
          />

          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>로그인</Text>}
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <TouchableOpacity onPress={() => router.push('/signup-terms')}>
              <Text style={styles.linkText}>회원가입</Text>
            </TouchableOpacity>
            <Text style={styles.linkDivider}>|</Text>
            <TouchableOpacity onPress={() => router.push('/forgot-password')}>
              <Text style={styles.linkText}>비밀번호 찾기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.xl, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: Spacing.xxl * 1.5 },
  subtitle: { fontSize: 14, color: Colors.textBody2, marginTop: Spacing.md },
  primaryBtn: {
    backgroundColor: Colors.coral,
    borderRadius: Radius.lg,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    shadowColor: Colors.coral,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  linkText: { fontSize: 13, color: Colors.textBody2 },
  linkDivider: { fontSize: 13, color: Colors.border },
});
