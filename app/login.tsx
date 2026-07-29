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
import { login, ApiError } from '@/utils/api';
import { saveTokens } from '@/utils/authStorage';
import { showAlert } from '@/components/ui/AppAlert';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('로그인', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      const result = await login({ email, password });
      await saveTokens(result.accessToken, result.refreshToken);
      router.replace('/(tabs)');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '로그인에 실패했어요. 잠시 후 다시 시도해주세요.';
      showAlert('로그인 실패', message);
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
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <FormField
            Icon={PasswordIcon}
            placeholder="비밀번호"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="oneTimeCode"
            trailing={<EyeToggle visible={showPassword} onPress={() => setShowPassword((v) => !v)} Icon={EyeIcon} />}
          />

          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>로그인</Text>}
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <TouchableOpacity onPress={() => router.push('/signup')}>
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
