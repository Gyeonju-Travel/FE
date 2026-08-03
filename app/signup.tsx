import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import FormField, { EyeToggle } from '@/components/auth/FormField';
import WheelPicker from '@/components/schedule/WheelPicker';
import EmailIcon from '@/assets/login/field-email.svg';
import PasswordIcon from '@/assets/login/field-password.svg';
import EyeIcon from '@/assets/login/field-password-eye.svg';
import NameIcon from '@/assets/login/field-name.svg';
import PhoneIcon from '@/assets/login/field-phone.svg';
import GenderMaleIcon from '@/assets/login/field-gender-male.svg';
import GenderFemaleIcon from '@/assets/login/field-gender-female.svg';
import { signUp, ApiError } from '@/utils/api';
import { saveTokens } from '@/utils/authStorage';
import { showAlert } from '@/components/ui/AppAlert';

type Gender = '여성' | '남성';

const BIRTH_YEAR_BASE = 1940;
const MIN_SIGNUP_AGE = 14;
const today = new Date();
// 만 14세가 되는 가장 최근 생일 = 오늘로부터 14년 전 같은 날짜. 이보다 늦은 생년월일은 선택할 수 없다.
const MAX_BIRTH_YEAR = today.getFullYear() - MIN_SIGNUP_AGE;
const MAX_BIRTH_MONTH_IDX = today.getMonth();
const MAX_BIRTH_DAY = today.getDate();

const BIRTH_YEARS = Array.from({ length: MAX_BIRTH_YEAR - BIRTH_YEAR_BASE + 1 }, (_, i) => `${BIRTH_YEAR_BASE + i}년`);
const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
const getMonthsArr = (yearIdx: number) => {
  const maxMonthIdx = BIRTH_YEAR_BASE + yearIdx === MAX_BIRTH_YEAR ? MAX_BIRTH_MONTH_IDX : 11;
  return MONTHS.slice(0, maxMonthIdx + 1);
};
const getDaysCount = (yearIdx: number, monthIdx: number) => new Date(BIRTH_YEAR_BASE + yearIdx, monthIdx + 1, 0).getDate();
const getDaysArr = (yearIdx: number, monthIdx: number) => {
  const daysInMonth = getDaysCount(yearIdx, monthIdx);
  const maxDay =
    BIRTH_YEAR_BASE + yearIdx === MAX_BIRTH_YEAR && monthIdx === MAX_BIRTH_MONTH_IDX
      ? Math.min(daysInMonth, MAX_BIRTH_DAY)
      : daysInMonth;
  return Array.from({ length: maxDay }, (_, i) => `${i + 1}일`);
};

const DEFAULT_YEAR_IDX = Math.max(0, new Date().getFullYear() - 25 - BIRTH_YEAR_BASE);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^01[016789]-\d{3,4}-\d{4}$/;

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length < 11) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function DateSelect({ label, filled, onPress }: { label: string; filled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.dateSelect} activeOpacity={0.8} onPress={onPress}>
      <Text style={[styles.dateSelectText, filled && styles.dateSelectTextFilled]}>{label}</Text>
      <Text style={styles.chevron}>⌄</Text>
    </TouchableOpacity>
  );
}

function BirthDatePickerModal({
  visible,
  yearIdx,
  monthIdx,
  dayIdx,
  onChange,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  yearIdx: number;
  monthIdx: number;
  dayIdx: number;
  onChange: (next: { yearIdx?: number; monthIdx?: number; dayIdx?: number }) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const monthsArr = getMonthsArr(yearIdx);
  const clampedMonthIdx = Math.min(monthIdx, monthsArr.length - 1);
  const daysArr = getDaysArr(yearIdx, clampedMonthIdx);
  const clampedDayIdx = Math.min(dayIdx, daysArr.length - 1);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>생년월일</Text>
        <View style={styles.sheetPickerRow}>
          <WheelPicker
            data={BIRTH_YEARS}
            selectedIdx={yearIdx}
            flex={1}
            onSelect={(i) => {
              const nextMonths = getMonthsArr(i);
              const nextMonthIdx = Math.min(monthIdx, nextMonths.length - 1);
              const nextDays = getDaysArr(i, nextMonthIdx);
              const nextDayIdx = Math.min(dayIdx, nextDays.length - 1);
              onChange({ yearIdx: i, monthIdx: nextMonthIdx, dayIdx: nextDayIdx });
            }}
          />
          <WheelPicker
            key={`month-${yearIdx}`}
            data={monthsArr}
            selectedIdx={clampedMonthIdx}
            flex={1}
            onSelect={(i) => {
              const nextDays = getDaysArr(yearIdx, i);
              const nextDayIdx = Math.min(dayIdx, nextDays.length - 1);
              onChange({ monthIdx: i, dayIdx: nextDayIdx });
            }}
          />
          <WheelPicker
            key={`day-${yearIdx}-${clampedMonthIdx}`}
            data={daysArr}
            selectedIdx={clampedDayIdx}
            flex={1}
            onSelect={(i) => onChange({ dayIdx: i })}
          />
        </View>
        <TouchableOpacity style={styles.sheetConfirmBtn} activeOpacity={0.85} onPress={onConfirm}>
          <Text style={styles.sheetConfirmText}>확인</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailApiError, setEmailApiError] = useState<string | null>(null);

  const [birthYearIdx, setBirthYearIdx] = useState(DEFAULT_YEAR_IDX);
  const [birthMonthIdx, setBirthMonthIdx] = useState(0);
  const [birthDayIdx, setBirthDayIdx] = useState(0);
  const [birthDateConfirmed, setBirthDateConfirmed] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const birthDateLabel = birthDateConfirmed
    ? `${BIRTH_YEAR_BASE + birthYearIdx}년 ${birthMonthIdx + 1}월 ${birthDayIdx + 1}일`
    : null;

  const emailError = email.length > 0 && !EMAIL_REGEX.test(email)
    ? '올바른 이메일 형식이 아니에요'
    : submitted && !email
    ? '이메일을 입력해 주세요.'
    : emailApiError;
  const passwordError = password.length > 0 && password.length < 8
    ? '비밀번호는 8자 이상 입력해주세요'
    : submitted && !password
    ? '비밀번호를 입력해 주세요.'
    : null;
  const passwordConfirmError = passwordConfirm.length > 0 && passwordConfirm !== password
    ? '비밀번호가 일치하지 않습니다.'
    : submitted && !passwordConfirm
    ? '비밀번호 재확인을 입력해 주세요.'
    : null;
  const phoneError = phone.length > 0 && !PHONE_REGEX.test(phone)
    ? '올바른 전화번호 형식이 아니에요 (예: 010-1234-5678)'
    : submitted && !phone
    ? '전화번호를 입력해 주세요.'
    : null;
  const nameError = submitted && !name ? '이름을 입력해 주세요.' : null;
  const birthDateError = submitted && !birthDateConfirmed ? '생년월일을 입력해 주세요.' : null;
  const genderError = submitted && !gender ? '성별을 선택해주세요.' : null;

  const handleSignUp = async () => {
    setSubmitted(true);
    if (
      !email ||
      !password ||
      !passwordConfirm ||
      !name ||
      !phone ||
      !birthDateConfirmed ||
      !gender ||
      emailError ||
      passwordError ||
      passwordConfirmError ||
      phoneError
    ) {
      return;
    }
    setLoading(true);
    try {
      const birthDate = `${BIRTH_YEAR_BASE + birthYearIdx}-${String(birthMonthIdx + 1).padStart(2, '0')}-${String(
        birthDayIdx + 1
      ).padStart(2, '0')}`;
      const result = await signUp({
        email,
        password,
        passwordConfirmation: passwordConfirm,
        name,
        birthDate,
        gender: gender === '여성' ? 'FEMALE' : 'MALE',
        phoneNumber: phone,
      });
      await saveTokens(result.accessToken);
      router.replace('/signup-complete');
    } catch (e) {
      if (e instanceof ApiError) {
        setEmailApiError(e.message);
      } else {
        showAlert('회원가입 실패', '회원가입에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>회원 가입</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <FormField
          label="이메일"
          Icon={EmailIcon}
          placeholder="이메일"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setEmailApiError(null);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          error={emailError}
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
          error={passwordError}
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
          error={passwordConfirmError}
        />
        <FormField
          label="이름"
          Icon={NameIcon}
          placeholder="이름"
          value={name}
          onChangeText={setName}
          error={nameError}
        />

        <Text style={styles.label}>생년월일</Text>
        <View style={styles.dateRow}>
          <DateSelect
            label={birthDateConfirmed ? `${BIRTH_YEAR_BASE + birthYearIdx}년` : '년도'}
            filled={birthDateConfirmed}
            onPress={() => setDatePickerVisible(true)}
          />
          <DateSelect
            label={birthDateConfirmed ? `${birthMonthIdx + 1}월` : '월'}
            filled={birthDateConfirmed}
            onPress={() => setDatePickerVisible(true)}
          />
          <DateSelect
            label={birthDateConfirmed ? `${birthDayIdx + 1}일` : '일'}
            filled={birthDateConfirmed}
            onPress={() => setDatePickerVisible(true)}
          />
        </View>
        {birthDateError && <Text style={styles.inlineErrorText}>{birthDateError}</Text>}

        <Text style={styles.label}>성별</Text>
        <View style={styles.genderRow}>
          {(['여성', '남성'] as Gender[]).map((g) => {
            const selected = gender === g;
            const Icon = g === '여성' ? GenderFemaleIcon : GenderMaleIcon;
            return (
              <TouchableOpacity
                key={g}
                style={[styles.genderBtn, selected && styles.genderBtnSelected]}
                activeOpacity={0.8}
                onPress={() => setGender(g)}
              >
                <Icon width={9} height={12} color={selected ? Colors.white : Colors.textMuted} />
                <Text style={[styles.genderBtnText, selected && styles.genderBtnTextSelected]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {genderError && <Text style={styles.inlineErrorText}>{genderError}</Text>}

        <FormField
          label="전화번호"
          Icon={PhoneIcon}
          placeholder="전화번호"
          value={phone}
          onChangeText={(text) => setPhone(formatPhoneNumber(text))}
          keyboardType="phone-pad"
          maxLength={13}
          error={phoneError}
        />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleSignUp} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>가입하기</Text>}
        </TouchableOpacity>
      </View>

      <BirthDatePickerModal
        visible={datePickerVisible}
        yearIdx={birthYearIdx}
        monthIdx={birthMonthIdx}
        dayIdx={birthDayIdx}
        onChange={(next) => {
          if (next.yearIdx !== undefined) setBirthYearIdx(next.yearIdx);
          if (next.monthIdx !== undefined) setBirthMonthIdx(next.monthIdx);
          if (next.dayIdx !== undefined) setBirthDayIdx(next.dayIdx);
        }}
        onClose={() => setDatePickerVisible(false)}
        onConfirm={() => {
          setBirthDateConfirmed(true);
          setDatePickerVisible(false);
        }}
      />
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
  label: { fontSize: 14, fontWeight: '600', color: Colors.textBody1, marginBottom: 8 },
  inlineErrorText: { fontSize: 12, color: '#D14343', marginTop: -8, marginBottom: Spacing.sm },
  dateRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  dateSelect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  dateSelectText: { fontSize: 14, color: Colors.textMuted },
  dateSelectTextFilled: { color: Colors.textBody1, fontWeight: '600' },
  chevron: { fontSize: 14, color: Colors.textMuted },
  genderRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  genderBtnSelected: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  genderBtnText: { fontSize: 14, color: Colors.textMuted },
  genderBtnTextSelected: { color: Colors.white, fontWeight: '600' },
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
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(58,51,48,0.4)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.textBody1, textAlign: 'center', marginBottom: Spacing.md },
  sheetPickerRow: { flexDirection: 'row' },
  sheetConfirmBtn: {
    backgroundColor: Colors.coral,
    borderRadius: Radius.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  sheetConfirmText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
});
