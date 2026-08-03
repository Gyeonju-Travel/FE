import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import FormField, { EyeToggle, InlineActionButton } from '@/components/auth/FormField';
import EmailIcon from '@/assets/login/field-email.svg';
import PasswordIcon from '@/assets/login/field-password.svg';
import EyeIcon from '@/assets/login/field-password-eye.svg';
import { sendPasswordResetVerificationCode, verifyPasswordResetCode, resetPassword, ApiError } from '@/utils/api';
import Toast from '@/components/ui/Toast';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const [codeSent, setCodeSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const codeVerified = resetToken !== null;

  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const passwordConfirmError =
    passwordConfirm.length > 0 && passwordConfirm !== password ? '비밀번호가 일치하지 않습니다.' : null;

  const handleSendCode = async () => {
    if (!email.trim()) {
      setEmailError('이메일을 입력해주세요.');
      return;
    }
    setEmailError(null);
    setSendingCode(true);
    try {
      await sendPasswordResetVerificationCode(email.trim());
      setCodeSent(true);
      setResetToken(null);
      setCode('');
      setCodeError(null);
      setToastMsg('인증번호를 보냈어요. 이메일을 확인해주세요.');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '인증번호 발송에 실패했어요. 잠시 후 다시 시도해주세요.';
      setEmailError(message);
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.trim().length !== 6) {
      setCodeError('인증번호 6자리를 입력해주세요.');
      return;
    }
    setCodeError(null);
    setVerifyingCode(true);
    try {
      const result = await verifyPasswordResetCode(email.trim(), code.trim());
      setResetToken(result.resetToken);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '인증번호가 일치하지 않습니다.';
      setCodeError(message);
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSubmit = async () => {
    if (!resetToken) return;
    if (password.length < 8) {
      setPasswordError('비밀번호는 8자 이상이어야 해요.');
      return;
    }
    if (password !== passwordConfirm) {
      return;
    }
    setPasswordError(null);
    setResetting(true);
    try {
      await resetPassword({
        email: email.trim(),
        resetToken,
        newPassword: password,
        newPasswordConfirmation: passwordConfirm,
      });
      setToastMsg('비밀번호가 변경 되었습니다.');
      setTimeout(() => router.replace('/login'), 900);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '비밀번호 재설정에 실패했어요. 잠시 후 다시 시도해주세요.';
      setPasswordError(message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>비밀번호 찾기</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <FormField
          label="이메일"
          Icon={EmailIcon}
          placeholder="이메일"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setEmailError(null);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!codeSent}
          error={emailError}
          trailing={
            <InlineActionButton
              label={sendingCode ? '발송 중' : codeSent ? '재발송' : '인증번호 발송'}
              disabled={!email.trim() || sendingCode}
              onPress={handleSendCode}
            />
          }
        />
        <FormField
          label="인증번호 입력"
          placeholder="인증 번호 입력"
          value={code}
          onChangeText={(t) => {
            setCode(t);
            setCodeError(null);
          }}
          editable={codeSent && !codeVerified}
          keyboardType="number-pad"
          maxLength={6}
          error={codeError}
          trailing={
            <InlineActionButton
              label={verifyingCode ? '확인 중' : codeVerified ? '확인됨' : '확인'}
              disabled={!codeSent || codeVerified || code.trim().length !== 6 || verifyingCode}
              onPress={handleVerifyCode}
            />
          }
        />
        <FormField
          label="비밀번호"
          Icon={PasswordIcon}
          placeholder="새 비밀번호 (8자 이상)"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setPasswordError(null);
          }}
          secureTextEntry={!showPassword}
          textContentType="oneTimeCode"
          maxLength={30}
          editable={codeVerified}
          error={passwordError}
          trailing={<EyeToggle visible={showPassword} onPress={() => setShowPassword((v) => !v)} Icon={EyeIcon} />}
        />
        <FormField
          Icon={PasswordIcon}
          placeholder="비밀번호 재확인"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry={!showPasswordConfirm}
          textContentType="oneTimeCode"
          maxLength={30}
          editable={codeVerified}
          error={passwordConfirmError}
          trailing={
            <EyeToggle visible={showPasswordConfirm} onPress={() => setShowPasswordConfirm((v) => !v)} Icon={EyeIcon} />
          }
        />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={!codeVerified || resetting}
        >
          {resetting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>완료</Text>}
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
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  bottomBar: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  primaryBtn: {
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
  primaryBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
