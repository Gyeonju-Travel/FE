import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  Modal,
  Dimensions,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView as EdgeSafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Radius, Spacing } from '@/constants/theme';
import SwipeBackScreen from '@/components/ui/SwipeBackScreen';
import EditProfileIcon from '@/assets/icons/edit-profile.svg';
import WithdrawIcon from '@/assets/icons/withdraw.svg';
import RecordPlaceIcon from '@/assets/icons/record-place.svg';
import RecordTimeIcon from '@/assets/icons/record-time.svg';
import RecordArrowIcon from '@/assets/icons/record-arrow.svg';
import PencilIcon from '@/assets/icons/pencil.svg';
import MenuDiaryIcon from '@/assets/icons/menu-diary.svg';
import MenuReportIcon from '@/assets/icons/menu-report.svg';
import MenuSettingsIcon from '@/assets/icons/menu-settings.svg';
import ReportSearchIcon from '@/assets/icons/report-search.svg';
import SettingAlarmIcon from '@/assets/icons/setting-alarm.svg';
import SettingInquiryIcon from '@/assets/icons/setting-inquiry.svg';
import SettingTermsIcon from '@/assets/icons/setting-terms.svg';
import SettingPrivacyIcon from '@/assets/icons/setting-privacy.svg';
import SettingLogoutIcon from '@/assets/icons/setting-logout.svg';
import SettingLocationTermsIcon from '@/assets/icons/map-mylocation.svg';
import EditCameraIcon from '@/assets/icons/edit-camera.svg';
import EditSizeIcon from '@/assets/icons/edit-size.svg';
import EmailFieldIcon from '@/assets/login/field-email.svg';
import PasswordFieldIcon from '@/assets/login/field-password.svg';
import PasswordEyeIcon from '@/assets/login/field-password-eye.svg';
import CodeFieldIcon from '@/assets/login/field-code.svg';
import SettingPasswordIcon from '@/assets/icons/setting-password.svg';
import ToastPasswordIcon from '@/assets/icons/toast/password-changed.svg';
import StampProgressIllustration from '@/assets/mypage/stamp-progress.svg';
import ReportHeroLandscape from '@/assets/mypage/report-hero-landscape.svg';
import {
  STAMP_ICONS,
  STAMP_LOCKED_ICON,
  TOTAL_STAMP_COUNT,
  GEOFENCE_ATTRACTIONS,
  STAMP_HINTS,
  getDisplayStampIndices,
  getRecentStampIndices,
  stampIndexFromBackendName,
  clearLocalStampData,
} from '@/constants/stamps';
import StampHintCarousel from '@/components/mypage/StampHintCarousel';
import { formatWalkDuration } from '@/utils/distance';
import { DogProfile } from '@/types/mypage';
import { ScrapData, RouteStop } from '@/types/stampAlbum';
import StampAlbumScreen from '@/components/mypage/StampAlbumView';
import {
  logout as logoutApi,
  withdraw as withdrawApi,
  getMyPets,
  changeRepresentativePet,
  getPetDetail,
  registerPet,
  updatePetProfile,
  createPlaceReport,
  PetPolicy,
  createInquiry,
  getTravelRecords,
  TravelRecordsResponse,
  TravelRecordItemResponse,
  getStampAlbum,
  getSchedulesByDate,
  sendPasswordResetVerificationCode,
  verifyPasswordResetCode,
  resetPassword,
  ApiError,
} from '@/utils/api';
import { getAccessToken, clearTokens, getAccountEmail } from '@/utils/authStorage';
import { unregisterPushToken, clearLocalPushPreference } from '@/utils/notifications';
import { clearRecentSearches } from '@/utils/recentSearches';
import FormField, { EyeToggle, InlineActionButton } from '@/components/auth/FormField';
import { getPersonalityComboLabel } from '@/constants/personalityCombo';
import { onTabReset } from '@/utils/tabReset';
import {
  toDogSummary,
  toDogFromRepresentative,
  toDogDetail,
  sizeToApi,
  genderToApi,
  personalityToApi,
} from '@/utils/petMappers';
import Toast from '@/components/ui/Toast';
import Toggle from '@/components/ui/Toggle';
import ChevronRightIcon from '@/assets/icons/chevron-right.svg';
import AlertCard from '@/components/ui/AlertCard';
import { showAlert } from '@/components/ui/AppAlert';
import ModalWarningIcon from '@/assets/icons/modal-warning.svg';
import ModalCheckIcon from '@/assets/icons/modal-check.svg';
import ModalPawIcon from '@/assets/icons/modal-paw.svg';
import ToastInquiryIcon from '@/assets/icons/toast/inquiry-received.svg';
import ToastPlaceReportIcon from '@/assets/icons/toast/place-report.svg';
import PhotoPermissionModal from '@/components/ui/PhotoPermissionModal';
import AddressSearchModal from '@/components/ui/AddressSearchModal';
import DogPhotoBlank from '@/assets/mypage/dog-photo-blank.svg';
import PlaceThumbnail from '@/components/ui/PlaceThumbnail';
import {
  isPushEnabled,
  setPushEnabled as savePushEnabled,
  getArrivedPlaceIds,
  clearLocalTrackingData,
} from '@/utils/locationTracking';
import { searchPlaceByName } from '@/utils/scheduleMappers';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PROFILE_TOP_LANDSCAPE_HEIGHT = (SCREEN_WIDTH * 350) / 390;
// 이미지 상단 여백을 당겨서 첨성대 탑 전체(꼭대기~받침대)가 카드에 가리지 않고 보이게 한다.
const PROFILE_TOP_LANDSCAPE_OFFSET = -PROFILE_TOP_LANDSCAPE_HEIGHT * 0.32;
const PROFILE_BOTTOM_LANDSCAPE_HEIGHT = (SCREEN_WIDTH * 90) / 390;
// 탭 바(마이페이지에서만 화면 위에 떠있음)의 둥근 위쪽 모서리(반지름 20)만큼만 이미지 아래쪽이
// 탭 바 뒤로 살짝 들어가게 띄운다. 이미지를 늘리지 않고 원래 비율 그대로 유지하면서, 탭 바
// 몸통 전체에 가려지지 않고 대부분 그 위로 보이게 하기 위함.
const TAB_BAR_CORNER_RADIUS = 20;
const REPORT_HERO_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;
const REPORT_HERO_LANDSCAPE_HEIGHT = (REPORT_HERO_WIDTH * 71) / 365;

const STAMP_SLOTS = 5;
const REPORT_CONDITIONS = ['전 구역', '야외만', '이동장 필수', '목줄 필수'];
const REPORT_CONDITION_POLICIES: PetPolicy[] = [
  'PET_FRIENDLY',
  'OUTDOOR_ONLY',
  'CARRIER_REQUIRED',
  'LEASH_REQUIRED',
];
const DANGER_COLOR = '#C9564D';
const DANGER_BG = '#FBEAE9';
const ICON_DARK_GRAY = '#4B4844';

/** 로그아웃/회원탈퇴 시 호출한다. 인증 토큰뿐 아니라, 계정과 무관하게 기기에 남아 다음
 * 로그인(다른 계정, 재가입 등)에 이전 계정의 상태가 그대로 섞여 보이게 하는 로컬 캐시
 * (스탬프, 진행 중이던 일정, 최근 검색어, 알림 설정)도 전부 정리한다. */
async function clearAccountLocalData(): Promise<void> {
  await clearTokens();
  await Promise.all([
    clearLocalStampData(),
    clearLocalTrackingData(),
    clearRecentSearches(),
    clearLocalPushPreference(),
  ]);
}

interface MenuRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress?: () => void;
  isLast?: boolean;
}

function MenuRow({ icon, title, subtitle, onPress, isLast }: MenuRowProps) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, isLast && styles.menuRowLast]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.menuIconBox}>{icon}</View>
      <View style={styles.menuTextCol}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRightIcon width={7} height={13} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── SettingsRow ───────────────────────────────────────────────────────────
interface SettingsRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  grouped?: boolean;
  isLast?: boolean;
  /** 정보 수정 화면처럼 카드에 테두리를 둘러야 할 때 */
  bordered?: boolean;
  /** 코랄 톤 대신 무채색(회색) 아이콘 박스를 써야 할 때 (정보 수정 화면의 이메일·비밀번호 행) */
  mutedIcon?: boolean;
  hideChevron?: boolean;
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
  grouped,
  isLast,
  bordered,
  mutedIcon,
  hideChevron,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[
        grouped ? st.rowGrouped : st.row,
        grouped && !isLast && st.rowGroupedDivider,
        danger && st.rowDanger,
        bordered && (danger ? st.rowBorderedDanger : st.rowBordered),
      ]}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[st.rowIconBox, danger && st.rowIconBoxDanger, mutedIcon && st.rowIconBoxMuted]}>{icon}</View>
      <View style={st.rowTextCol}>
        <Text style={[st.rowTitle, danger && st.rowTitleDanger]}>{title}</Text>
        {!!subtitle && <Text style={st.rowSubtitle}>{subtitle}</Text>}
      </View>
      {right ?? (hideChevron ? null : <ChevronRightIcon width={7} height={13} color={Colors.textMuted} />)}
    </TouchableOpacity>
  );
}

// ─── 회원탈퇴 확인/완료 모달 ───────────────────────────────────────────────────
function WithdrawConfirmModal({
  visible,
  loading,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={wd.backdrop}>
        <AlertCard
          icon={<ModalWarningIcon width={64} height={64} />}
          iconStandalone
          title="정말 탈퇴하시겠어요?"
          subtitle={'탈퇴 버튼 선택 시 계정이 삭제되며\n복구되지 않습니다.'}
          buttons={[
            { label: '계속 이용하기', onPress: onCancel, variant: 'outline' },
            { label: '탈퇴하기', onPress: onConfirm, tone: 'coral', loading },
          ]}
        />
      </View>
    </Modal>
  );
}

function WithdrawSuccessModal({ visible, onConfirm }: { visible: boolean; onConfirm: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onConfirm}>
      <View style={wd.backdrop}>
        <AlertCard
          icon={<ModalCheckIcon width={64} height={64} />}
          iconStandalone
          title="정상적으로 탈퇴되었습니다."
          subtitle={'그동안 견주여행을\n이용해주셔서 감사했어요 🐾'}
          buttons={[{ label: '확인', onPress: onConfirm, tone: 'sage' }]}
        />
      </View>
    </Modal>
  );
}

// ─── InquiryView (문의하기) ───────────────────────────────────────────────────
function InquiryView({ onBack, underlay }: { onBack: () => void; underlay?: React.ReactNode }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastSubtitle, setToastSubtitle] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setToastMsg('제목을 입력해주세요.');
      setToastSubtitle(undefined);
      return;
    }
    if (!content.trim()) {
      setToastMsg('문의 내용을 입력해주세요.');
      setToastSubtitle(undefined);
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setToastMsg('로그인 정보가 없어요. 다시 로그인해주세요.');
      setToastSubtitle(undefined);
      return;
    }
    setSubmitting(true);
    try {
      await createInquiry({ title: title.trim(), content: content.trim() }, token);
      setToastMsg('접수되었습니다!');
      setToastSubtitle('문의 검토 후 빠른 시일 내로 연락 드릴게요.');
      setTimeout(onBack, 900);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '문의 접수에 실패했어요. 잠시 후 다시 시도해주세요.';
      setToastMsg(message);
      setToastSubtitle(undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
      <SafeAreaView style={iq.safeArea}>
        <View style={iq.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={iq.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={iq.headerTitle}>문의하기</Text>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={iq.scrollContent}>
          <Text style={iq.label}>제목</Text>
          <TextInput
            style={iq.input}
            placeholder="장소 이름 입력"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={iq.label}>문의 내용</Text>
          <TextInput
            style={[iq.input, iq.contentInput]}
            placeholder="문의사항을 입력해주세요."
            placeholderTextColor={Colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={iq.bottomBar}>
          <TouchableOpacity style={iq.submitBtn} activeOpacity={0.85} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={iq.submitBtnText}>제출하기</Text>}
          </TouchableOpacity>
        </View>

        <Toast
          message={toastMsg}
          subtitle={toastSubtitle}
          onHide={() => {
            setToastMsg(null);
            setToastSubtitle(undefined);
          }}
          icon={toastMsg === '접수되었습니다!' ? <ToastInquiryIcon width={20} height={22} /> : undefined}
        />
      </SafeAreaView>
    </SwipeBackScreen>
  );
}

// ─── SettingsView (설정 화면) ─────────────────────────────────────────────────
function SettingsView({
  onBack,
  onAccountInfo,
  underlay,
}: {
  onBack: () => void;
  onAccountInfo: () => void;
  underlay?: React.ReactNode;
}) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [showInquiry, setShowInquiry] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    isPushEnabled().then(setPushEnabled);
  }, []);

  const handleTogglePush = (value: boolean) => {
    setPushEnabled(value);
    savePushEnabled(value);
  };

  const handleLogout = async () => {
    const token = await getAccessToken();
    if (token) {
      await unregisterPushToken(token);
      try {
        await logoutApi(token);
      } catch (e) {
        // 서버 로그아웃이 실패해도 로컬 토큰은 지우고 로그인 화면으로 보낸다.
      }
    }
    await clearAccountLocalData();
    router.replace('/login');
  };

  const settingsMain = (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
      <SafeAreaView style={st.safeArea}>
        <View style={st.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={st.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={st.headerTitle}>설정</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent}>
        <Text style={st.groupLabel}>알림 설정</Text>
        <SettingsRow
          icon={<SettingAlarmIcon width={20} height={20} color={'#6B6260'} />}
          title="푸시 알림 설정"
          subtitle="여행 알림·스탬프 알림"
          right={<Toggle value={pushEnabled} onValueChange={handleTogglePush} />}
        />

        <Text style={st.groupLabel}>서비스</Text>
        <View style={st.groupCard}>
          <SettingsRow
            icon={<SettingInquiryIcon width={20} height={20} color={'#6B6260'} />}
            title="문의하기"
            subtitle="불편사항·개선 제안"
            grouped
            onPress={() => setShowInquiry(true)}
          />
          <SettingsRow
            icon={<SettingTermsIcon width={20} height={20} color={'#6B6260'} />}
            title="이용약관"
            subtitle=""
            grouped
            onPress={() => router.push({ pathname: '/terms-detail', params: { type: 'service' } })}
          />
          <SettingsRow
            icon={<SettingPrivacyIcon width={20} height={20} color={'#6B6260'} />}
            title="개인정보 처리방침"
            subtitle=""
            grouped
            onPress={() => router.push({ pathname: '/terms-detail', params: { type: 'privacy' } })}
          />
          <SettingsRow
            icon={<SettingLocationTermsIcon width={20} height={20} color={'#6B6260'} />}
            title="위치기반 서비스 이용약관"
            subtitle=""
            grouped
            isLast
            onPress={() => router.push({ pathname: '/terms-detail', params: { type: 'location' } })}
          />
        </View>

        <Text style={st.groupLabel}>계정 관리</Text>
        <View style={st.groupCard}>
          <SettingsRow
            icon={<EditProfileIcon width={20} height={20} color={'#6B6260'} />}
            title="정보 수정"
            subtitle=""
            grouped
            isLast
            onPress={onAccountInfo}
          />
        </View>
        <View style={[st.groupCard, { marginTop: Spacing.md }]}>
          <SettingsRow
            icon={<SettingLogoutIcon width={20} height={20} color={'#6B6260'} />}
            title="로그아웃"
            subtitle=""
            grouped
            isLast
            onPress={() => setShowLogoutConfirm(true)}
          />
        </View>

        <Text style={st.versionText}>견주여행 v1.0.0</Text>
      </ScrollView>

      <Modal visible={showLogoutConfirm} transparent animationType="fade" onRequestClose={() => setShowLogoutConfirm(false)}>
        <View style={wd.backdrop}>
          <AlertCard
            title="로그아웃 하시겠어요?"
            buttons={[
              { label: '아니요', onPress: () => setShowLogoutConfirm(false), variant: 'outline' },
              {
                label: '네',
                onPress: () => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                },
                tone: 'sage',
              },
            ]}
          />
        </View>
      </Modal>
      </SafeAreaView>
    </SwipeBackScreen>
  );

  if (showInquiry) {
    return <InquiryView onBack={() => setShowInquiry(false)} underlay={settingsMain} />;
  }

  return settingsMain;
}

// ─── AccountInfoView (정보 수정 화면) ─────────────────────────────────────────
function AccountInfoView({
  onBack,
  onChangePassword,
  underlay,
}: {
  onBack: () => void;
  onChangePassword: () => void;
  underlay?: React.ReactNode;
}) {
  const [email, setEmail] = useState<string | null>(null);
  const [withdrawStep, setWithdrawStep] = useState<'confirm' | 'success' | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    getAccountEmail().then(setEmail);
  }, []);

  const handleWithdrawConfirm = async () => {
    const token = await getAccessToken();
    if (!token) {
      showAlert('회원탈퇴', '로그인 정보가 없어요. 다시 로그인해주세요.');
      setWithdrawStep(null);
      router.replace('/login');
      return;
    }
    setWithdrawing(true);
    try {
      await withdrawApi(token);
      await clearAccountLocalData();
      setWithdrawStep('success');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '탈퇴에 실패했어요. 잠시 후 다시 시도해주세요.';
      showAlert('회원탈퇴 실패', message);
      setWithdrawStep(null);
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
      <SafeAreaView style={st.safeArea}>
        <View style={st.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={st.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={st.headerTitle}>정보 수정</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent}>
        <Text style={st.groupLabel}>계정 정보</Text>
        <View style={[st.row, st.rowBordered]}>
          <View style={[st.rowIconBox, st.rowIconBoxMuted]}>
            <EmailFieldIcon width={20} height={20} color={Colors.textMuted} />
          </View>
          <View style={st.rowTextCol}>
            <Text style={ai.emailLabel}>이메일</Text>
            <Text style={ai.emailText}>{email ?? ''}</Text>
          </View>
        </View>

        <Text style={st.groupLabel}>보안 설정</Text>
        <SettingsRow
          icon={<SettingPasswordIcon width={20} height={20} color={ICON_DARK_GRAY} />}
          title="비밀번호 변경"
          subtitle="새 비밀번호로 변경할 수 있어요"
          bordered
          mutedIcon
          onPress={onChangePassword}
        />

        <Text style={st.groupLabel}>회원 탈퇴</Text>
        <SettingsRow
          icon={<WithdrawIcon width={20} height={20} color={DANGER_COLOR} />}
          title="회원탈퇴"
          subtitle="탈퇴 시 모든 데이터가 삭제돼요"
          danger
          bordered
          onPress={() => setWithdrawStep('confirm')}
        />
      </ScrollView>

      <WithdrawConfirmModal
        visible={withdrawStep === 'confirm'}
        loading={withdrawing}
        onCancel={() => setWithdrawStep(null)}
        onConfirm={handleWithdrawConfirm}
      />
      <WithdrawSuccessModal
        visible={withdrawStep === 'success'}
        onConfirm={() => {
          setWithdrawStep(null);
          router.replace('/login');
        }}
      />
      </SafeAreaView>
    </SwipeBackScreen>
  );
}

// ─── PasswordChangeView (비밀번호 변경 화면) ──────────────────────────────────
function PasswordChangeView({ onBack, underlay }: { onBack: () => void; underlay?: React.ReactNode }) {
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
  const [changing, setChanging] = useState(false);
  const codeVerified = resetToken !== null;

  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    getAccountEmail().then((stored) => setEmail(stored ?? ''));
  }, []);

  const passwordConfirmError =
    passwordConfirm.length > 0 && passwordConfirm !== password ? '비밀번호가 일치하지 않습니다.' : null;

  const handleSendCode = async () => {
    if (!email) return;
    setSendingCode(true);
    try {
      await sendPasswordResetVerificationCode(email);
      setCodeSent(true);
      setResetToken(null);
      setCode('');
      setCodeError(null);
      setToastMsg('인증번호를 보냈어요. 이메일을 확인해주세요.');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '인증번호 발송에 실패했어요. 잠시 후 다시 시도해주세요.';
      setCodeError(message);
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
      const result = await verifyPasswordResetCode(email, code.trim());
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
    setChanging(true);
    try {
      await resetPassword({
        email,
        resetToken,
        newPassword: password,
        newPasswordConfirmation: passwordConfirm,
      });
      setToastMsg('비밀번호가 변경됐어요.');
      setTimeout(onBack, 900);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '비밀번호 변경에 실패했어요. 잠시 후 다시 시도해주세요.';
      setPasswordError(message);
    } finally {
      setChanging(false);
    }
  };

  return (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
      <SafeAreaView style={st.safeArea}>
        <View style={st.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={st.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={st.headerTitle}>비밀번호 변경</Text>
        </View>

        <ScrollView contentContainerStyle={ai.scrollContent} showsVerticalScrollIndicator={false}>
        <FormField
          label="이메일"
          Icon={EmailFieldIcon}
          value={email}
          editable={false}
          trailing={
            <InlineActionButton
              label={sendingCode ? '발송 중' : codeSent ? '재발송' : '인증번호 발송'}
              disabled={!email || sendingCode}
              onPress={handleSendCode}
            />
          }
        />
        <FormField
          label="인증번호 입력"
          Icon={CodeFieldIcon}
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
          label="새 비밀번호"
          Icon={PasswordFieldIcon}
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
          trailing={<EyeToggle visible={showPassword} onPress={() => setShowPassword((v) => !v)} Icon={PasswordEyeIcon} />}
        />
        <FormField
          Icon={PasswordFieldIcon}
          placeholder="비밀번호 재확인"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry={!showPasswordConfirm}
          textContentType="oneTimeCode"
          maxLength={30}
          editable={codeVerified}
          error={passwordConfirmError}
          trailing={
            <EyeToggle
              visible={showPasswordConfirm}
              onPress={() => setShowPasswordConfirm((v) => !v)}
              Icon={PasswordEyeIcon}
            />
          }
        />
      </ScrollView>

      <View style={iq.bottomBar}>
        <TouchableOpacity
          style={iq.submitBtn}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={!codeVerified || changing}
        >
          {changing ? <ActivityIndicator color={Colors.white} /> : <Text style={iq.submitBtnText}>변경하기</Text>}
        </TouchableOpacity>
      </View>

      <Toast
        message={toastMsg}
        onHide={() => setToastMsg(null)}
        icon={toastMsg === '비밀번호가 변경됐어요.' ? <ToastPasswordIcon width={18} height={21} /> : undefined}
        iconTone={toastMsg === '비밀번호가 변경됐어요.' ? 'sage' : 'coral'}
      />
      </SafeAreaView>
    </SwipeBackScreen>
  );
}

// ─── ReportPlaceView (장소 제보) ──────────────────────────────────────────────
function ReportPlaceView({ onBack, underlay }: { onBack: () => void; underlay?: React.ReactNode }) {
  const [placeName, setPlaceName] = useState('');
  const [address, setAddress] = useState('');
  const [conditionIndices, setConditionIndices] = useState<number[]>([]);
  const [reason, setReason] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showPhotoPermissionModal, setShowPhotoPermissionModal] = useState(false);
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastSubtitle, setToastSubtitle] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setShowPhotoPermissionModal(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPhotoUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!placeName.trim()) {
      setToastMsg('장소 이름을 입력해주세요.');
      setToastSubtitle(undefined);
      return;
    }
    if (!address.trim()) {
      setToastMsg('주소를 입력해주세요.');
      setToastSubtitle(undefined);
      return;
    }
    if (conditionIndices.length === 0) {
      setToastMsg('반려동물 입장 조건을 선택해주세요.');
      setToastSubtitle(undefined);
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setToastMsg('로그인 정보가 없어요. 다시 로그인해주세요.');
      setToastSubtitle(undefined);
      return;
    }
    setSubmitting(true);
    try {
      await createPlaceReport(
        {
          placeName: placeName.trim(),
          address: address.trim(),
          petPolicies: conditionIndices.map((i) => REPORT_CONDITION_POLICIES[i]),
          recommendationReason: reason.trim() || undefined,
        },
        token,
        photoUri
      );
      setToastMsg('접수되었습니다!');
      setToastSubtitle('검토 후 반영할게요.');
      setTimeout(onBack, 900);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '제보 접수에 실패했어요. 잠시 후 다시 시도해주세요.';
      setToastMsg(message);
      setToastSubtitle(undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
      <SafeAreaView style={rp.safeArea}>
        <View style={rp.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={rp.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={rp.headerTitle}>장소 제보</Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={rp.scrollContent}>
        <View style={rp.heroBanner}>
          <ReportHeroLandscape
            width={REPORT_HERO_WIDTH}
            height={REPORT_HERO_LANDSCAPE_HEIGHT}
            style={rp.heroLandscape}
          />
          <Text style={rp.heroText}>반려견 동반이{'\n'}가능한 장소를 공유해주세요!</Text>
        </View>

        <Text style={rp.label}>장소명</Text>
        <TextInput
          style={rp.input}
          placeholder="장소 이름 입력"
          placeholderTextColor={Colors.textMuted}
          value={placeName}
          onChangeText={setPlaceName}
        />

        <Text style={rp.label}>주소</Text>
        <TouchableOpacity style={rp.searchInputRow} activeOpacity={0.8} onPress={() => setShowAddressSearch(true)}>
          <ReportSearchIcon width={16} height={16} color={Colors.textMuted} />
          <Text style={[rp.searchInputText, !address && rp.searchInputPlaceholder]} numberOfLines={1}>
            {address || '주소 검색'}
          </Text>
        </TouchableOpacity>

        <Text style={rp.label}>반려동물 입장 조건</Text>
        <View style={rp.conditionRow}>
          {REPORT_CONDITIONS.map((cond, i) => {
            const selected = conditionIndices.includes(i);
            return (
              <TouchableOpacity
                key={cond}
                style={[rp.conditionChip, selected && rp.conditionChipSelected]}
                activeOpacity={0.8}
                onPress={() =>
                  setConditionIndices((prev) =>
                    prev.includes(i) ? prev.filter((idx) => idx !== i) : [...prev, i]
                  )
                }
              >
                {selected && <Text style={rp.conditionCheck}>✓</Text>}
                <Text style={[rp.conditionText, selected && rp.conditionTextSelected]}>{cond}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={rp.label}>
          사진 첨부 <Text style={rp.optionalText}>(선택)</Text>
        </Text>
        <TouchableOpacity style={rp.photoAddBox} activeOpacity={0.8} onPress={pickPhoto}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={rp.photoPreview} resizeMode="cover" />
          ) : (
            <Text style={rp.photoAddPlus}>+</Text>
          )}
        </TouchableOpacity>

        <Text style={rp.label}>
          추천 이유 <Text style={rp.optionalText}>(선택)</Text>
        </Text>
        <TextInput
          style={[rp.input, rp.reasonInput]}
          placeholder="이 장소의 장점을 알려주세요!"
          placeholderTextColor={Colors.textMuted}
          value={reason}
          onChangeText={setReason}
          multiline
        />
      </ScrollView>

      <View style={rp.bottomBar}>
        <TouchableOpacity
          style={rp.submitBtn}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={rp.submitBtnText}>제보 제출하기</Text>
          )}
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>

      <Toast
        message={toastMsg}
        subtitle={toastSubtitle}
        onHide={() => {
          setToastMsg(null);
          setToastSubtitle(undefined);
        }}
        icon={toastMsg === '접수되었습니다!' ? <ToastPlaceReportIcon width={22} height={22} /> : undefined}
      />

      <PhotoPermissionModal
        visible={showPhotoPermissionModal}
        onCancel={() => setShowPhotoPermissionModal(false)}
        onOpenSettings={() => {
          setShowPhotoPermissionModal(false);
          Linking.openSettings();
        }}
      />

      <AddressSearchModal
        visible={showAddressSearch}
        onClose={() => setShowAddressSearch(false)}
        onSelect={(selected) => {
          setAddress(selected);
          setShowAddressSearch(false);
        }}
      />
      </SafeAreaView>
    </SwipeBackScreen>
  );
}

// 백엔드가 "출발지 -> 도착지" 형태의 문자열로 내려주는 제목(TravelRecordItemResponse.titleOf())을
// " -> " 기준으로 나눠서, 텍스트 화살표 대신 아이콘으로 표시한다.
function TravelRecordTitle({ title }: { title: string }) {
  const parts = title.split(' -> ');
  if (parts.length !== 2) {
    return (
      <Text style={th.cardTitle} numberOfLines={1}>
        {title}
      </Text>
    );
  }
  return (
    <View style={th.cardTitleRow}>
      <Text style={th.cardTitle} numberOfLines={1}>
        {parts[0]}
      </Text>
      <RecordArrowIcon width={10} height={10} color={Colors.textBody1} style={th.cardTitleArrow} />
      <Text style={th.cardTitle} numberOfLines={1}>
        {parts[1]}
      </Text>
    </View>
  );
}

// ─── TravelHistoryView (여행 기록) ────────────────────────────────────────────
function TravelHistoryView({
  dog,
  onBack,
  underlay,
}: {
  dog: DogProfile;
  onBack: () => void;
  underlay?: React.ReactNode;
}) {
  const [travelRecords, setTravelRecords] = useState<TravelRecordsResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [viewingScrap, setViewingScrap] = useState<ScrapData | null>(null);
  const [viewingScrapSave, setViewingScrapSave] = useState<{ scheduleId: number; accessToken: string } | null>(
    null
  );
  const [openingScheduleId, setOpeningScheduleId] = useState<number | null>(null);
  const insets = useSafeAreaInsets();
  // 사진을 안 남긴 기록은 photoUrl이 없어서, 그 일정의 실제 출발 지점 사진으로 대신 보여준다.
  // (황리단길/금리단길 같은 4개 대분류가 아니라 detail.departure.name — 제목의 "OO -> 도착지"에
  // 쓰이는 바로 그 지점 이름으로 검색해야, 금리단길 권역이라도 실제 출발 지점(예: 경주읍성)
  // 사진을 찾을 수 있다.)
  const [fallbackImageByScheduleId, setFallbackImageByScheduleId] = useState<Record<number, string | undefined>>({});

  const fetchTravelRecords = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setListError('로그인 정보가 없어요.');
      return;
    }
    try {
      const result = await getTravelRecords(token);
      setTravelRecords(result);

      const missing = result.records.filter((r) => !r.photoUrl);
      if (missing.length > 0) {
        const entries = await Promise.all(
          missing.map(async (r) => {
            try {
              const dateSchedules = await getSchedulesByDate(r.date, token);
              const detail = dateSchedules.schedules.find((s) => s.scheduleId === r.scheduleId);
              if (!detail) return [r.scheduleId, undefined] as const;
              // 제목("첫 방문지 -> 마지막 방문지")과 짝을 맞춰, 첫 방문지 사진을 우선 쓴다.
              // 출발지(금리단길 등 4개 대분류)는 사진이 아예 등록 안 된 경우가 많아 이게 더 안정적이다.
              const firstPlaceImage = detail.places[0]?.imageUrl ?? undefined;
              const imageUri = firstPlaceImage ?? (await searchPlaceByName(detail.departure.name, token))?.imageUri ?? undefined;
              return [r.scheduleId, imageUri] as const;
            } catch (e) {
              return [r.scheduleId, undefined] as const;
            }
          })
        );
        setFallbackImageByScheduleId((prev) => {
          const next = { ...prev };
          for (const [scheduleId, imageUri] of entries) next[scheduleId] = imageUri;
          return next;
        });
      }
    } catch (e) {
      setListError(e instanceof ApiError ? e.message : '여행 기록을 불러오지 못했어요.');
    }
  }, []);

  useEffect(() => {
    fetchTravelRecords();
  }, [fetchTravelRecords]);

  const openRecord = async (record: TravelRecordItemResponse) => {
    if (openingScheduleId !== null) return;
    const token = await getAccessToken();
    if (!token) return;
    setOpeningScheduleId(record.scheduleId);
    try {
      const [album, dateSchedules, arrivedIds] = await Promise.all([
        getStampAlbum(record.scheduleId, token),
        getSchedulesByDate(record.date, token),
        getArrivedPlaceIds(String(record.scheduleId)),
      ]);
      const detail = dateSchedules.schedules.find((s) => s.scheduleId === record.scheduleId);
      // 경로보기(RouteView)와 동일하게 출발지를 첫 지점으로 포함해야 경로/핀 번호가 맞게 표시된다.
      // 목적지로 저장은 해놨지만 실제로 안 간 곳은 경로에서 뺀다 — 출발지는 항상 예외.
      const stops: RouteStop[] = detail
        ? [
            { id: 'departure', name: detail.departure.name, latitude: detail.departure.latitude, longitude: detail.departure.longitude },
            ...detail.places
              .filter((p) => arrivedIds.includes(String(p.placeId)))
              .map((p) => ({
                id: String(p.placeId),
                name: p.name,
                latitude: p.latitude,
                longitude: p.longitude,
              })),
          ]
        : [];
      setViewingScrap({
        id: String(record.scheduleId),
        title: '오늘의 경주',
        travelDate: album.date.replace(/-/g, ' · '),
        dogName: dog.name,
        dogProfileImageUri: dog.photoUri,
        selectedPhotoUris: album.photoUrls,
        stops,
        totalDistanceInMeters: album.totalDistanceMeters,
        stampIndex: stampIndexFromBackendName(album.stampName),
      });
      setViewingScrapSave({ scheduleId: record.scheduleId, accessToken: token });
    } catch (e) {
      setListError(e instanceof ApiError ? e.message : '기록을 불러오지 못했어요.');
    } finally {
      setOpeningScheduleId(null);
    }
  };

  const listScreen = (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
      <SafeAreaView style={th.safeArea}>
        <View style={th.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={th.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={th.headerTitle}>여행 기록</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={th.scrollContent}>
        <View style={th.statsCard}>
          <View style={th.statItem}>
            <Text style={th.statValue}>
              {travelRecords?.totalTravelCount ?? 0}
              <Text style={th.statUnit}>회</Text>
            </Text>
            <Text style={th.statLabel}>총 여행</Text>
          </View>
          <View style={th.statDivider} />
          <View style={th.statItem}>
            <Text style={th.statValue}>
              {travelRecords?.totalVisitedPlaceCount ?? 0}
              <Text style={th.statUnit}>곳</Text>
            </Text>
            <Text style={th.statLabel}>총 방문 장소</Text>
          </View>
          <View style={th.statDivider} />
          <View style={th.statItem}>
            <Text style={th.statValue}>
              {travelRecords?.totalStampCount ?? dog.stampCount}
              <Text style={th.statUnit}>개</Text>
            </Text>
            <Text style={th.statLabel}>획득 스탬프</Text>
          </View>
        </View>

        {!travelRecords && !listError && (
          <View style={th.loadingCenter}>
            <ActivityIndicator color={Colors.coral} />
          </View>
        )}
        {listError && <Text style={th.errorText}>{listError}</Text>}
        {travelRecords?.records.length === 0 && <Text style={th.errorText}>아직 기록된 여행이 없어요.</Text>}

        {travelRecords?.records.map((item, i) => {
          const isFirst = i === 0;
          const isOpening = openingScheduleId === item.scheduleId;
          return (
            <View key={item.scheduleId} style={th.row}>
              <View style={th.railCol}>
                <View style={[th.dot, isFirst && th.dotFirst]} />
                <View style={th.railLine} />
              </View>
              <View style={th.entryCol}>
                <Text style={th.dateText}>{item.date.replace(/-/g, '.')}</Text>
                <TouchableOpacity
                  style={th.card}
                  activeOpacity={0.85}
                  disabled={openingScheduleId !== null}
                  onPress={() => openRecord(item)}
                >
                  {(() => {
                    const fallbackUri = fallbackImageByScheduleId[item.scheduleId];
                    const displayUri = item.photoUrl ?? fallbackUri;
                    return <PlaceThumbnail uri={displayUri} style={th.cardImage} illustrationScale={2.25} />;
                  })()}
                  <View style={th.cardBody}>
                    <TravelRecordTitle title={item.title ?? '오늘의 경주'} />
                    <View style={th.cardMetaRow}>
                      <RecordPlaceIcon width={14} height={14} color={Colors.textBody2} />
                      <Text style={th.metaText}>{item.totalPlaceCount}곳 방문</Text>
                      <RecordTimeIcon width={14} height={14} color={Colors.textBody2} style={{ marginLeft: Spacing.md }} />
                      <Text style={th.metaText}>
                        {formatWalkDuration(Math.round(item.totalWalkingDurationSeconds / 60))}
                      </Text>
                    </View>
                  </View>
                  {isOpening && (
                    <View style={th.cardLoadingOverlay}>
                      <ActivityIndicator color={Colors.coral} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
      </SafeAreaView>
    </SwipeBackScreen>
  );

  if (viewingScrap && viewingScrapSave) {
    return (
      <StampAlbumScreen
        scrap={viewingScrap}
        onBack={() => {
          setViewingScrap(null);
          fetchTravelRecords();
        }}
        underlay={listScreen}
        serverSave={{ ...viewingScrapSave, onSaved: fetchTravelRecords }}
        extraBottomInset={66 + insets.bottom}
      />
    );
  }

  return listScreen;
}

// ─── EditProfileView (프로필 편집) ────────────────────────────────────────────
const DOG_SIZE_OPTIONS: { value: string; label: string; iconSize: number }[] = [
  { value: '소형견', label: '소형', iconSize: 26 },
  { value: '중형견', label: '중형', iconSize: 38 },
  { value: '대형견', label: '대형', iconSize: 50 },
];
const PERSONALITY_OPTIONS = ['낯가림', '느긋함', '친화력 좋음', '예민함', '호기심', '활동적'];
// 백엔드 PetRegistrationRequest/PetProfileUpdateRequest의 @Min(0)/@Max(50)과 동일한 범위.
// 범위를 벗어나면 서버가 400으로 거부하는데("잘못된 요청"으로만 보임), 여기서 미리 막아서
// 인라인으로 바로 알려준다.
const DOG_AGE_MIN = 0;
const DOG_AGE_MAX = 50;

function EditProfileView({
  dog,
  onBack,
  onSave,
  underlay,
}: {
  dog?: DogProfile;
  onBack: () => void;
  onSave: (saved: DogProfile) => void;
  underlay?: React.ReactNode;
}) {
  const isNew = !dog;
  const [name, setName] = useState(dog?.name ?? '');
  const [breed, setBreed] = useState(dog?.breed ?? '');
  const [sizeType, setSizeType] = useState(dog?.sizeType ?? DOG_SIZE_OPTIONS[1].value);
  const [age, setAge] = useState(dog?.age != null ? String(dog.age) : '');
  const [ageError, setAgeError] = useState<string | null>(null);
  const [gender, setGender] = useState<DogProfile['gender']>(dog?.gender ?? '남아');
  const [personalities, setPersonalities] = useState<string[]>(
    dog?.personalityTags.filter((tag) => PERSONALITY_OPTIONS.includes(tag)) ?? []
  );
  const togglePersonality = (tag: string) => {
    setPersonalities((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 2) return prev;
      return [...prev, tag];
    });
  };
  const [saving, setSaving] = useState(false);
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [showPhotoPermissionModal, setShowPhotoPermissionModal] = useState(false);
  const displayPhotoUri = localPhotoUri ?? dog?.photoUri;

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setShowPhotoPermissionModal(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setLocalPhotoUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!name.trim() || !breed.trim() || !age) {
      showAlert('반려견 프로필', '이름, 견종, 나이를 입력해주세요.');
      return;
    }
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum < DOG_AGE_MIN || ageNum > DOG_AGE_MAX) {
      setAgeError(`나이는 ${DOG_AGE_MIN}~${DOG_AGE_MAX} 사이로 입력해주세요.`);
      return;
    }
    if (personalities.length !== 2) {
      showAlert('반려견 프로필', '강아지의 성향은 두 가지를 선택해주세요.');
      return;
    }
    const token = await getAccessToken();
    if (!token) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        breed: breed.trim(),
        size: sizeToApi(sizeType),
        age: ageNum,
        gender: genderToApi(gender),
        personality: personalities.map(personalityToApi),
      };
      const result = isNew
        ? await registerPet(body, token, localPhotoUri)
        : await updatePetProfile(Number(dog!.id), body, token, localPhotoUri);
      onSave(toDogDetail(result, dog?.isPrimary ?? false));
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '저장에 실패했어요. 잠시 후 다시 시도해주세요.';
      showAlert('반려견 프로필', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
      <SafeAreaView style={ep.safeArea}>
        <View style={ep.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={ep.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={ep.headerTitle}>{isNew ? '프로필 추가' : '프로필 편집'}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ep.scrollContent}>
        <View style={ep.avatarRow}>
          <View style={ep.avatarWrap}>
            {displayPhotoUri ? (
              <Image source={{ uri: displayPhotoUri }} style={ep.avatar} resizeMode="cover" />
            ) : (
              <DogPhotoBlank width={116} height={116} />
            )}
            <TouchableOpacity style={ep.cameraBtn} activeOpacity={0.8} onPress={pickPhoto}>
              <EditCameraIcon width={16} height={14} color={Colors.textBody2} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={ep.label}>강아지 이름</Text>
        <TextInput
          style={ep.input}
          placeholder="이름을 입력해 주세요"
          placeholderTextColor={Colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={ep.label}>견종</Text>
        <TextInput
          style={ep.input}
          placeholder="견종을 선택해주세요"
          placeholderTextColor={Colors.textMuted}
          value={breed}
          onChangeText={setBreed}
        />

        <Text style={ep.label}>크기</Text>
        <View style={ep.sizeRow}>
          {DOG_SIZE_OPTIONS.map((opt) => {
            const selected = sizeType === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[ep.sizeBox, selected && ep.sizeBoxSelected]}
                activeOpacity={0.8}
                onPress={() => setSizeType(opt.value)}
              >
                <EditSizeIcon
                  width={opt.iconSize}
                  height={opt.iconSize}
                  color={selected ? Colors.white : Colors.textMuted}
                />
                <Text style={[ep.sizeLabel, selected && ep.sizeLabelSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={ep.label}>나이</Text>
        <TextInput
          style={[ep.input, ageError && ep.inputError]}
          placeholder="나이를 입력해 주세요"
          placeholderTextColor={Colors.textMuted}
          value={age}
          onChangeText={(t) => {
            setAge(t);
            setAgeError(null);
          }}
          keyboardType="number-pad"
          maxLength={2}
        />
        {ageError && <Text style={ep.errorText}>{ageError}</Text>}

        <Text style={ep.label}>성별</Text>
        <View style={ep.genderRow}>
          <TouchableOpacity
            style={[ep.genderBtn, gender === '남아' && ep.genderBtnSelectedMale]}
            activeOpacity={0.8}
            onPress={() => setGender('남아')}
          >
            <Text style={[ep.genderBtnText, gender === '남아' && ep.genderBtnTextSelectedMale]}>♂ 남아</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ep.genderBtn, gender === '여아' && ep.genderBtnSelectedFemale]}
            activeOpacity={0.8}
            onPress={() => setGender('여아')}
          >
            <Text style={[ep.genderBtnText, gender === '여아' && ep.genderBtnTextSelectedFemale]}>♀ 여아</Text>
          </TouchableOpacity>
        </View>

        <Text style={ep.label}>성향 (2개 선택)</Text>
        <View style={ep.tagRow}>
          {PERSONALITY_OPTIONS.map((tag) => {
            const selected = personalities.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[ep.tagChip, selected && ep.tagChipSelected]}
                activeOpacity={0.8}
                onPress={() => togglePersonality(tag)}
              >
                <Text style={[ep.tagChipText, selected && ep.tagChipTextSelected]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={ep.bottomBar}>
        <TouchableOpacity style={ep.saveBtn} activeOpacity={0.85} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={ep.saveBtnText}>저장하기</Text>}
        </TouchableOpacity>
      </View>

      <PhotoPermissionModal
        visible={showPhotoPermissionModal}
        onCancel={() => setShowPhotoPermissionModal(false)}
        onOpenSettings={() => {
          setShowPhotoPermissionModal(false);
          Linking.openSettings();
        }}
      />
      </SafeAreaView>
    </SwipeBackScreen>
  );
}

// ─── StampGalleryScreen (스탬프 앨범) ──────────────────────────────────────────
function StampGalleryScreen({ onBack, underlay }: { onBack: () => void; underlay?: React.ReactNode }) {
  const [earnedStampIndices, setEarnedStampIndices] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    getDisplayStampIndices().then(setEarnedStampIndices);
  }, []);

  const progressRatio = earnedStampIndices.size / TOTAL_STAMP_COUNT;
  const hintTexts = GEOFENCE_ATTRACTIONS.filter((a) => !earnedStampIndices.has(a.stampIndex))
    .slice(0, 3)
    .map((a) => STAMP_HINTS[a.stampIndex])
    .filter((h): h is string => !!h);

  return (
    <SwipeBackScreen onBack={onBack} underlay={underlay}>
      <SafeAreaView style={sg.safeArea}>
        <View style={sg.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={sg.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={sg.headerTitle}>스탬프 앨범</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sg.scrollContent}>
        <View style={sg.progressCard}>
          <View style={sg.progressCardRow}>
            <View style={sg.progressCardText}>
              <Text style={sg.progressLabel}>진행률</Text>
              <View style={sg.progressValueRow}>
                <Text style={sg.progressEarned}>{earnedStampIndices.size}</Text>
                <Text style={sg.progressTotal}>/ {TOTAL_STAMP_COUNT}</Text>
                <Text style={sg.progressUnit}>개</Text>
              </View>
              <View style={sg.progressTrack}>
                <View style={[sg.progressFill, { width: `${progressRatio * 100}%` }]} />
              </View>
            </View>
            <StampProgressIllustration width={110} height={108} />
          </View>
        </View>

        <View style={sg.sectionHeaderRow}>
          <Text style={sg.sectionTitle}>스탬프 현황</Text>
        </View>

        <View style={sg.stampGrid}>
          {STAMP_ICONS.map((Icon, i) => {
            const earned = earnedStampIndices.has(i);
            const StampIcon = earned ? Icon : STAMP_LOCKED_ICON;
            return (
              <View key={i} style={sg.stampCircle}>
                <StampIcon width="100%" height="100%" />
              </View>
            );
          })}
        </View>
      </ScrollView>

      <StampHintCarousel hints={hintTexts} />
      </SafeAreaView>
    </SwipeBackScreen>
  );
}

export default function MyPageScreen() {
  const insets = useSafeAreaInsets();
  const { openStampGallery, openReportPlace } = useLocalSearchParams<{
    openStampGallery?: string;
    openReportPlace?: string;
  }>();
  const [dogProfiles, setDogProfiles] = useState<DogProfile[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [loadingPets, setLoadingPets] = useState(true);
  const [petsError, setPetsError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showReportPlace, setShowReportPlace] = useState(false);
  const [showTravelHistory, setShowTravelHistory] = useState(false);
  const [showStampGallery, setShowStampGallery] = useState(false);
  const [profileEditorMode, setProfileEditorMode] = useState<'edit' | 'add' | null>(null);
  const [pendingPrimaryDog, setPendingPrimaryDog] = useState<DogProfile | null>(null);
  const [primarySwitchSuccess, setPrimarySwitchSuccess] = useState(false);
  const [earnedStampIndices, setEarnedStampIndices] = useState<Set<number>>(new Set([0]));
  // 스탬프 미리보기 칸(STAMP_SLOTS)에 "0~N번 인덱스가 땄는지"가 아니라 실제로 딴 스탬프부터
  // 최신순으로 채워 보여준다 — 홈 화면 미리보기와 동일한 방식.
  const [recentStampIndices, setRecentStampIndices] = useState<number[]>([0]);
  const dog = dogProfiles.find((d) => d.id === selectedDogId) ?? dogProfiles[0];
  const personalityComboLabel = dog
    ? ((dog.personalityTags.length === 2
        ? getPersonalityComboLabel(dog.personalityTags.map(personalityToApi))
        : null) ?? (dog.personalityTags.join(' · ') || null))
    : null;

  // 다른 탭에 있는 동안 관광지 도착(지오펜싱)으로 스탬프가 늘었을 수 있어, 마이 탭에 올 때마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      getDisplayStampIndices().then(setEarnedStampIndices);
      getRecentStampIndices(STAMP_SLOTS).then(setRecentStampIndices);
    }, [])
  );

  // 마이 탭 아이콘을 다시 누르면 설정/문의/기록 등 하위 화면을 닫고 첫 화면으로 되돌아간다.
  useEffect(
    () =>
      onTabReset('mypage', () => {
        setShowSettings(false);
        setShowReportPlace(false);
        setShowTravelHistory(false);
        setShowStampGallery(false);
        setProfileEditorMode(null);
      }),
    []
  );

  // 홈 화면의 스탬프 미리보기를 눌러 들어온 경우, 스탬프 앨범을 바로 연다.
  useEffect(() => {
    if (openStampGallery !== '1') return;
    setShowStampGallery(true);
    router.setParams({ openStampGallery: undefined });
  }, [openStampGallery]);

  // 지도 검색 결과가 없을 때 "장소 제보하러 가기"를 눌러 들어온 경우, 장소 제보를 바로 연다.
  useEffect(() => {
    if (openReportPlace !== '1') return;
    setShowReportPlace(true);
    router.setParams({ openReportPlace: undefined });
  }, [openReportPlace]);

  const handleConfirmPrimarySwitch = async () => {
    if (!pendingPrimaryDog) return;
    const newPrimaryId = pendingPrimaryDog.id;
    setPendingPrimaryDog(null);
    const token = await getAccessToken();
    if (!token) return;
    try {
      const list = await changeRepresentativePet(Number(newPrimaryId), token);
      const summaries: DogProfile[] = [];
      if (list.representativePet) summaries.push(toDogFromRepresentative(list.representativePet));
      list.otherPets.forEach((p) => summaries.push(toDogSummary(p, false)));
      setDogProfiles(summaries);
      setSelectedDogId(newPrimaryId);
      setPrimarySwitchSuccess(true);
    } catch (e) {
      setPetsError(e instanceof ApiError ? e.message : '대표 반려견 변경에 실패했어요.');
    }
  };

  const loadPets = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setLoadingPets(false);
      return;
    }
    setLoadingPets(true);
    try {
      const list = await getMyPets(token);
      const summaries: DogProfile[] = [];
      let primaryId: string | null = null;
      if (list.representativePet) {
        summaries.push(toDogFromRepresentative(list.representativePet));
        primaryId = String(list.representativePet.petId);
      }
      list.otherPets.forEach((p) => summaries.push(toDogSummary(p, false)));
      setDogProfiles(summaries);
      setSelectedDogId((prev) =>
        prev && summaries.some((d) => d.id === prev) ? prev : primaryId ?? summaries[0]?.id ?? null
      );
    } catch (e) {
      setPetsError(e instanceof ApiError ? e.message : '반려견 정보를 불러오지 못했어요.');
    } finally {
      setLoadingPets(false);
    }
  }, []);

  useEffect(() => {
    loadPets();
  }, [loadPets]);

  useEffect(() => {
    if (!selectedDogId) return;
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const detail = await getPetDetail(Number(selectedDogId), token);
        setDogProfiles((prev) =>
          prev.map((d) => (d.id === selectedDogId ? toDogDetail(detail, d.isPrimary) : d))
        );
      } catch (e) {
        // 상세 조회 실패는 조용히 무시 — 목록의 기본 정보는 이미 표시돼 있음
      }
    })();
  }, [selectedDogId]);

  if (loadingPets && dogProfiles.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={Colors.coral} />
        </View>
      </SafeAreaView>
    );
  }

  // 스와이프 뒤로가기 중 뒤에 깔아 보여줄 마이페이지 기본 화면 (강아지 유무에 따라 둘 중 하나).
  // 아래 여러 early-return 분기(설정, 계정정보, 비밀번호 변경, 신고, 여행기록, 스탬프, 프로필 편집)는
  // 모두 이 화면에서 곧장 열리고 곧장 이 화면으로 돌아오므로 전부 같은 underlay를 쓴다.
  const baseScreen = !dog ? (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.loadingCenter}>
        <Text style={styles.emptyDogTitle}>등록된 반려견이 없어요</Text>
        <TouchableOpacity
          style={styles.emptyDogBtn}
          activeOpacity={0.85}
          onPress={() => setProfileEditorMode('add')}
        >
          <Text style={styles.emptyDogBtnText}>반려견 등록하기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  ) : (
    // 마이페이지 탭 바만 화면 위에 떠있는 구조(app/(tabs)/_layout.tsx)라, 아래쪽 배경 일러스트가
    // 탭 바의 둥근 모서리 뒤까지 자연스럽게 이어지려면 이 화면이 안전영역 하단 여백 없이 진짜
    // 화면 끝까지 그려져야 한다. 기본 SafeAreaView(react-native)는 하단 인셋을 자동으로 패딩으로
    // 넣어버려서 이미지가 그 안쪽에서 멈췄었다 — edges로 위쪽만 안전영역을 적용한다.
    <EdgeSafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 스크롤 없이 한 화면에 다 보이도록 화면 하단에 고정한다. 아래 ScrollView 콘텐츠보다 먼저
          그려서 뒤쪽에 깔리게 하고(겹치는 글씨가 안 가려지게), 터치도 이 이미지를 그냥 통과한다. */}
      <Image
        source={require('@/assets/mypage/profile-bottom-landscape.png')}
        style={[
          styles.profileBottomLandscape,
          {
            width: SCREEN_WIDTH,
            height: PROFILE_BOTTOM_LANDSCAPE_HEIGHT,
            bottom: 66 + insets.bottom - TAB_BAR_CORNER_RADIUS,
          },
        ]}
        resizeMode="stretch"
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* 타이틀 + 프로필 카드 + 함께 하는 강아지 (배경에 경주 랜드마크 일러스트) */}
        <View style={styles.profileSection}>
          <Image
            source={require('@/assets/mypage/profile-top-landscape.png')}
            style={[
              styles.profileTopLandscape,
              { width: SCREEN_WIDTH, height: PROFILE_TOP_LANDSCAPE_HEIGHT, top: PROFILE_TOP_LANDSCAPE_OFFSET },
            ]}
            resizeMode="stretch"
          />

          {/* 타이틀 */}
          <View style={styles.headerBg}>
            <Text style={styles.pageTitle}>마이페이지</Text>
          </View>

          {/* 프로필 카드 */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              {dog.photoUri ? (
                <Image source={{ uri: dog.photoUri }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={styles.avatarPlaceholderRing}>
                  <DogPhotoBlank width={88} height={88} />
                </View>
              )}
              {dog.isPrimary && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>대표</Text>
                </View>
              )}
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.dogName}>{dog.name}</Text>
                <Image
                  source={require('@/assets/mypage/dog-name-paw.png')}
                  style={styles.pawIcon}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.dogMeta}>
                  {dog.breed} · {dog.sizeType}
                  {dog.age != null ? ` · ${dog.age}살` : ''}
                </Text>
                <TouchableOpacity onPress={() => setProfileEditorMode('edit')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <PencilIcon width={14} height={14} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              {personalityComboLabel && (
                <View style={styles.personalityChip}>
                  <Image
                    source={require('@/assets/mypage/personality-tag-icon.png')}
                    style={styles.personalityChipIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.personalityChipText}>{personalityComboLabel}</Text>
                </View>
              )}
            </View>
          </View>

          {/* 함께 하는 강아지 */}
          <View style={[styles.section, styles.sectionBordered]}>
            <Text style={styles.sectionTitle}>함께 하는 강아지</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dogListRow}>
              {dogProfiles.map((d) => {
                const selected = d.id === selectedDogId;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={styles.dogItem}
                    activeOpacity={0.8}
                    onPress={() => (d.isPrimary ? setSelectedDogId(d.id) : setPendingPrimaryDog(d))}
                  >
                    {d.photoUri ? (
                      <Image
                        source={{ uri: d.photoUri }}
                        style={[styles.dogItemAvatar, selected && styles.dogItemAvatarSelected]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.dogItemAvatar,
                          styles.dogItemAvatarPlaceholder,
                          selected && styles.dogItemAvatarSelected,
                        ]}
                      >
                        <DogPhotoBlank width={60} height={60} />
                      </View>
                    )}
                    <Text style={[styles.dogItemName, selected && styles.dogItemNameSelected]}>{d.name}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.dogItem}
                activeOpacity={0.8}
                onPress={() => setProfileEditorMode('add')}
              >
                <View style={styles.addDogCircle}>
                  <Text style={styles.addDogPlus}>+</Text>
                </View>
                <Text style={styles.dogItemName}>추가하기</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

        {/* 스탬프 */}
        <View style={[styles.section, styles.stampSection]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{dog.name}의 스탬프</Text>
            <TouchableOpacity style={styles.sectionMoreRow} onPress={() => setShowStampGallery(true)}>
              <Text style={styles.sectionMoreText}>전체보기</Text>
              <ChevronRightIcon width={5} height={9} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.stampRow}>
            {Array.from({ length: STAMP_SLOTS }).map((_, i) => {
              const stampIndex = recentStampIndices[i];
              const StampIcon = stampIndex !== undefined ? STAMP_ICONS[stampIndex] : STAMP_LOCKED_ICON;
              return (
                <View key={i} style={styles.stampCircle}>
                  <StampIcon width="100%" height="100%" />
                </View>
              );
            })}
          </View>
        </View>

        {/* 메뉴 */}
        <View style={styles.menuList}>
          <MenuRow
            icon={<MenuDiaryIcon width={20} height={20} color={Colors.coral} />}
            title="여행 기록"
            subtitle="함께한 여행을 돌아보세요"
            onPress={() => dog && setShowTravelHistory(true)}
          />
          <MenuRow
            icon={<MenuReportIcon width={20} height={20} color={Colors.coral} />}
            title="장소 제보"
            subtitle="함께 갈 수 있는 곳을 공유해요"
            onPress={() => setShowReportPlace(true)}
          />
          <MenuRow
            icon={<MenuSettingsIcon width={20} height={20} color={Colors.coral} />}
            title="설정"
            subtitle="알림, 계정 및 앱 설정을 관리해요"
            onPress={() => setShowSettings(true)}
            isLast
          />
        </View>
      </ScrollView>

      <Toast message={petsError} onHide={() => setPetsError(null)} />

      <Modal
        visible={!!pendingPrimaryDog}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingPrimaryDog(null)}
      >
        <View style={wd.backdrop}>
          <AlertCard
            icon={<ModalPawIcon width={26} height={24} />}
            iconTone="sage"
            title="대표 강아지를 변경할까요?"
            subtitle="선택한 강아지가 메인 프로필에 표시 됩니다."
            buttons={[
              { label: '취소', onPress: () => setPendingPrimaryDog(null), variant: 'outline' },
              { label: '변경하기', onPress: handleConfirmPrimarySwitch, tone: 'sage' },
            ]}
          />
        </View>
      </Modal>

      <Modal
        visible={primarySwitchSuccess}
        transparent
        animationType="fade"
        onRequestClose={() => setPrimarySwitchSuccess(false)}
      >
        <View style={wd.backdrop}>
          <AlertCard
            icon={
              <View>
                <ModalPawIcon width={26} height={24} />
                <View style={mp.pawCheckBadge}>
                  <Text style={mp.pawCheckMark}>✓</Text>
                </View>
              </View>
            }
            iconTone="sage"
            title="대표 강아지를 변경했어요!"
            subtitle="선택한 강아지가 메인 프로필에 표시 됩니다."
            buttons={[{ label: '확인', onPress: () => setPrimarySwitchSuccess(false), tone: 'sage' }]}
          />
        </View>
      </Modal>
    </EdgeSafeAreaView>
  );

  if (showSettings) {
    return (
      <SettingsView
        onBack={() => setShowSettings(false)}
        onAccountInfo={() => {
          setShowSettings(false);
          setShowAccountInfo(true);
        }}
        underlay={baseScreen}
      />
    );
  }

  if (showAccountInfo) {
    return (
      <AccountInfoView
        onBack={() => setShowAccountInfo(false)}
        onChangePassword={() => {
          setShowAccountInfo(false);
          setShowPasswordChange(true);
        }}
        underlay={baseScreen}
      />
    );
  }

  if (showPasswordChange) {
    return <PasswordChangeView onBack={() => setShowPasswordChange(false)} underlay={baseScreen} />;
  }

  if (showReportPlace) {
    return <ReportPlaceView onBack={() => setShowReportPlace(false)} underlay={baseScreen} />;
  }

  if (showTravelHistory && dog) {
    return <TravelHistoryView dog={dog} onBack={() => setShowTravelHistory(false)} underlay={baseScreen} />;
  }

  if (showStampGallery) {
    return <StampGalleryScreen onBack={() => setShowStampGallery(false)} underlay={baseScreen} />;
  }

  if (profileEditorMode) {
    return (
      <EditProfileView
        dog={profileEditorMode === 'edit' ? dog : undefined}
        onBack={() => setProfileEditorMode(null)}
        onSave={(saved) => {
          setDogProfiles((prev) =>
            profileEditorMode === 'edit'
              ? prev.map((d) => (d.id === saved.id ? saved : d))
              : [...prev, saved]
          );
          // 새로 추가한 강아지로 화면 포커스(=상단 프로필 카드에 보여줄 강아지)를 자동으로
          // 옮기지 않는다 — 대표는 사용자가 직접 "함께 하는 강아지" 목록에서 눌러 바꿀 때만
          // 바뀌어야 한다.
          setProfileEditorMode(null);
        }}
        underlay={baseScreen}
      />
    );
  }

  return baseScreen;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.lg },
  emptyDogTitle: { fontSize: 16, fontWeight: '600', color: Colors.textBody1 },
  emptyDogBtn: {
    backgroundColor: Colors.coral,
    borderRadius: Radius.lg,
    height: 48,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDogBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
  headerBg: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  pageTitle: { fontSize: 22, fontWeight: '700', color: Colors.textBody1 },
  profileSection: { position: 'relative' },
  profileTopLandscape: { position: 'absolute', left: 0, right: 0, top: 0 },
  profileBottomLandscape: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  profileCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    borderWidth: 3,
    borderColor: Colors.background,
    backgroundColor: Colors.bgWarm,
  },
  avatarPlaceholderRing: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    borderWidth: 3,
    borderColor: Colors.background,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    right: -2,
    bottom: -6,
    height: 20,
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
  },
  primaryBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.white },
  profileInfo: { flex: 1, justifyContent: 'center', gap: 6, paddingTop: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dogName: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  pawIcon: { width: 16, height: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dogMeta: { fontSize: 13, color: Colors.textBody2 },
  personalityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.secondaryTint,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  personalityChipIcon: { width: 10, height: 14 },
  personalityChipText: { fontSize: 12, fontWeight: '600', color: Colors.secondaryDark },
  section: {
    marginTop: Spacing.xl + Spacing.lg + Spacing.md,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  stampSection: { marginTop: Spacing.xs },
  sectionBordered: {
    borderWidth: 0.5,
    borderColor: '#EDE8E3',
    shadowColor: '#3A3330',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textBody1, marginBottom: Spacing.md },
  sectionMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sectionMoreText: { fontSize: 13, color: Colors.textMuted },
  dogListRow: { gap: Spacing.lg },
  dogItem: { alignItems: 'center', gap: 6, width: 64 },
  dogItemAvatar: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgWarm,
  },
  dogItemAvatarSelected: {
    borderWidth: 2,
    borderColor: Colors.coral,
  },
  dogItemAvatarPlaceholder: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  dogItemName: { fontSize: 12, color: Colors.textBody2 },
  dogItemNameSelected: { color: Colors.coral, fontWeight: '600' },
  addDogCircle: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDogPlus: { fontSize: 22, color: Colors.textMuted, fontWeight: '300' },
  stampRow: { flexDirection: 'row', gap: Spacing.md },
  stampCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuList: {
    marginTop: Spacing.xs,
    marginHorizontal: Spacing.lg,
    backgroundColor: 'transparent',
    borderRadius: Radius.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0EDE8',
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuIconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextCol: { flex: 1, gap: 2 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: Colors.textBody1 },
  menuSubtitle: { fontSize: 12, color: Colors.textMuted },
});

// ─── 설정 화면 스타일 (st) ────────────────────────────────────────────────────
const st = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bgWarm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: 12,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1, lineHeight: 28 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },
  groupLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  rowDanger: { backgroundColor: DANGER_BG },
  rowBordered: { borderWidth: 1, borderColor: Colors.border },
  rowBorderedDanger: { borderWidth: 1, borderColor: '#F0D3D0' },
  groupCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  rowGrouped: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  rowGroupedDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0EDE8',
  },
  rowIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconBoxDanger: { backgroundColor: DANGER_BG },
  rowIconBoxMuted: { backgroundColor: Colors.bgWarm },
  rowTextCol: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.textBody1 },
  rowTitleDanger: { color: DANGER_COLOR },
  rowSubtitle: { fontSize: 11, color: Colors.textMuted },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.xxl * 2,
  },
});

// ─── 회원탈퇴 모달 스타일 (wd) ─────────────────────────────────────────────────
const wd = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(58,51,48,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
});

const mp = StyleSheet.create({
  pawCheckBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondary,
    borderWidth: 2,
    borderColor: Colors.secondaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pawCheckMark: { fontSize: 9, fontWeight: '700', color: Colors.white, lineHeight: 11 },
});

// ─── 문의하기 화면 스타일 (iq) ─────────────────────────────────────────────────
// ─── 정보 수정 / 비밀번호 변경 화면 스타일 (ai) ───────────────────────────────
const ai = StyleSheet.create({
  emailLabel: { fontSize: 13, color: Colors.textMuted },
  emailText: { fontSize: 16, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: 24 },
});

const iq = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1, lineHeight: 28 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textBody1, marginBottom: 8, marginTop: Spacing.lg },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 50,
    fontSize: 14,
    color: Colors.textBody1,
  },
  contentInput: {
    flex: 1,
    height: undefined,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  submitBtn: {
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
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});

// ─── 장소 제보 화면 스타일 (rp) ────────────────────────────────────────────────
const rp = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: 12,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1, lineHeight: 28 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: 24 },
  heroBanner: {
    height: 120,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.bgWarm,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  heroLandscape: { position: 'absolute', left: 0, bottom: 0, zIndex: 0 },
  heroText: {
    color: '#3A3330',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    marginTop: Spacing.md,
    marginLeft: Spacing.md,
    zIndex: 1,
  },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textBody1, marginBottom: 8, marginTop: Spacing.lg },
  optionalText: { fontSize: 12, fontWeight: '400', color: Colors.textMuted },
  input: {
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 50,
    fontSize: 14,
    color: Colors.textBody1,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 50,
  },
  searchInputText: { flex: 1, fontSize: 14, color: Colors.textBody1, padding: 0 },
  searchInputPlaceholder: { color: Colors.textMuted },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  conditionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  conditionChipSelected: { backgroundColor: Colors.secondaryTint, borderColor: Colors.secondary },
  conditionCheck: { fontSize: 12, color: Colors.secondary, fontWeight: '700' },
  conditionText: { fontSize: 13, color: Colors.textBody2 },
  conditionTextSelected: { color: Colors.secondaryDark, fontWeight: '600' },
  photoAddBox: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  photoAddPlus: { fontSize: 24, color: Colors.textMuted, fontWeight: '300' },
  photoPreview: { width: '100%', height: '100%', borderRadius: Radius.md },
  reasonInput: { height: 90, paddingTop: Spacing.md, textAlignVertical: 'top' },
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  submitBtn: {
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
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});

// ─── 여행 기록 스타일 (th) ─────────────────────────────────────────────────────
const th = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1, lineHeight: 28 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: 24 },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: '#EDE8E3',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xxl,
    shadowColor: '#3A3330',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, color: Colors.secondaryDark },
  statUnit: { fontSize: 13, color: Colors.secondaryDark },
  statLabel: { fontSize: 12, color: Colors.textBody2 },
  statDivider: { width: 1, backgroundColor: Colors.border },
  row: { flexDirection: 'row' },
  railCol: { width: 20, alignItems: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
    marginTop: 6,
  },
  dotFirst: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: Colors.secondary,
    backgroundColor: Colors.background,
    marginTop: 3,
  },
  railLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.secondaryBorder,
    marginVertical: 4,
  },
  entryCol: { flex: 1, paddingLeft: Spacing.md, paddingBottom: Spacing.xxl },
  dateText: { fontSize: 14, color: Colors.textBody1, marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: '#EDE8E3',
    overflow: 'hidden',
    shadowColor: '#3A3330',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardImage: { width: '100%', height: 160, backgroundColor: Colors.bgWarm },
  cardBody: { padding: Spacing.lg, gap: 6 },
  cardTitle: { fontSize: 16, color: Colors.textBody1, flexShrink: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitleArrow: { marginHorizontal: 6, flexShrink: 0 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: Colors.textBody2, marginRight: Spacing.xs },
  cardLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCenter: { paddingTop: Spacing.xxl * 2, alignItems: 'center' },
  errorText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxl },
});

// ─── 프로필 편집 스타일 (ep) ───────────────────────────────────────────────────
const ep = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1, lineHeight: 28 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: 24 },
  avatarRow: { alignItems: 'center', marginBottom: Spacing.xxl },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 116,
    height: 116,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgWarm,
  },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#3A3330',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: { fontSize: 15, fontWeight: '600', color: Colors.textBody1, marginBottom: 10, marginTop: Spacing.xl },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
    fontSize: 14,
    color: Colors.textBody1,
  },
  inputError: { borderColor: '#D14343' },
  errorText: { fontSize: 12, color: '#D14343', marginTop: 6 },
  sizeRow: { flexDirection: 'row', gap: Spacing.sm },
  sizeBox: {
    flex: 1,
    height: 96,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sizeBoxSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  sizeLabel: { fontSize: 13, color: Colors.textMuted },
  sizeLabelSelected: { color: Colors.white, fontWeight: '600' },
  genderRow: { flexDirection: 'row', gap: Spacing.sm },
  genderBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnSelectedMale: {
    backgroundColor: Colors.secondaryTint,
    borderColor: Colors.secondaryBorder,
  },
  genderBtnSelectedFemale: {
    backgroundColor: Colors.primaryTint,
    borderColor: Colors.primaryBorder,
  },
  genderBtnText: { fontSize: 15, color: Colors.textBody2 },
  genderBtnTextSelectedMale: { color: Colors.secondaryDark, fontWeight: '600' },
  genderBtnTextSelectedFemale: { color: Colors.primaryDark, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tagChip: {
    width: '31%',
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChipSelected: {
    backgroundColor: Colors.secondaryTint,
    borderColor: Colors.secondary,
  },
  tagChipText: { fontSize: 13, color: Colors.textBody2 },
  tagChipTextSelected: { color: Colors.secondaryDark, fontWeight: '600' },
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
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

// ─── 스탬프 갤러리 스타일 (sg) ─────────────────────────────────────────────────
const sg = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  backArrow: { fontSize: 22, color: Colors.textBody1, lineHeight: 28 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textBody1 },
  scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: 24 },
  progressCard: {
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  progressCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  progressCardText: { flex: 1 },
  progressLabel: { fontSize: 14, fontWeight: '600', color: Colors.textBody1, marginBottom: Spacing.sm },
  progressValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: Spacing.md },
  progressEarned: { fontSize: 30, fontWeight: '700', color: Colors.secondary, lineHeight: 34 },
  progressTotal: { fontSize: 18, fontWeight: '600', color: Colors.textMuted, marginBottom: 3, marginLeft: 4 },
  progressUnit: { fontSize: 14, color: Colors.textMuted, marginLeft: 6, marginBottom: 4 },
  progressTrack: {
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.coral,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textBody1 },
  stampGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  stampCircle: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

