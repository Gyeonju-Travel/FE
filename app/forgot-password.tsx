import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import FormField, { EyeToggle, InlineActionButton } from '@/components/auth/FormField';
import EmailIcon from '@/assets/login/field-email.svg';
import PasswordIcon from '@/assets/login/field-password.svg';
import EyeIcon from '@/assets/login/field-password-eye.svg';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

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
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          trailing={
            <InlineActionButton
              label="인증번호 발송"
              disabled={!email}
              onPress={() => setCodeSent(true)}
            />
          }
        />
        <FormField
          label="인증번호 입력"
          placeholder="인증 번호 입력"
          value={code}
          onChangeText={setCode}
          editable={codeSent}
          keyboardType="number-pad"
        />
        <FormField
          label="비밀번호"
          Icon={PasswordIcon}
          placeholder="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          textContentType="oneTimeCode"
          maxLength={30}
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
          trailing={
            <EyeToggle visible={showPasswordConfirm} onPress={() => setShowPasswordConfirm((v) => !v)} Icon={EyeIcon} />
          }
        />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={() => router.replace('/login')}>
          <Text style={styles.primaryBtnText}>완료</Text>
        </TouchableOpacity>
      </View>
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
