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
  Switch,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  Modal,
  Dimensions,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Radius, Spacing } from '@/constants/theme';
import EditProfileIcon from '@/assets/icons/edit-profile.svg';
import WithdrawIcon from '@/assets/icons/withdraw.svg';
import RecordPlaceIcon from '@/assets/icons/record-place.svg';
import RecordTimeIcon from '@/assets/icons/record-time.svg';
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
import EditCameraIcon from '@/assets/icons/edit-camera.svg';
import EditSizeIcon from '@/assets/icons/edit-size.svg';
import StampProgressIllustration from '@/assets/mypage/stamp-progress.svg';
import ProfileBottomLandscape from '@/assets/mypage/profile-bottom-landscape.svg';
import ReportHeroLandscape from '@/assets/mypage/report-hero-landscape.svg';
import { STAMP_ICONS, STAMP_LOCKED_ICON, TOTAL_STAMP_COUNT, getEarnedStampIndices } from '@/constants/stamps';
import { MOCK_TRAVEL_HISTORY } from '@/mock/travelHistory';
import { MOCK_SCRAP_DATA } from '@/mock/stampAlbum';
import { DogProfile } from '@/types/mypage';
import { ScrapData, RouteStop, TravelBadgeData } from '@/types/stampAlbum';
import { calculateFootprintCount } from '@/utils/footprintCalculator';
import { haversineMeters } from '@/utils/distance';
import { fetchPedestrianRoute, LatLng, PedestrianRouteResult } from '@/utils/pedestrianRoute';
import {
  logout as logoutApi,
  withdraw as withdrawApi,
  getMyPets,
  getPetDetail,
  registerPet,
  updatePetProfile,
  createPlaceReport,
  PetPolicy,
  createInquiry,
  ApiError,
} from '@/utils/api';
import { getAccessToken, clearTokens } from '@/utils/authStorage';
import { onTabReset } from '@/utils/tabReset';
import {
  toDogSummary,
  toDogFromRepresentative,
  toDogDetail,
  sizeToApi,
  genderToApi,
  personalityToApi,
} from '@/utils/petMappers';
import { useScrapCapture } from '@/hooks/useScrapCapture';
import KakaoMap from '@/components/map/KakaoMap';
import Badge from '@/components/ui/Badge';
import Toast from '@/components/ui/Toast';
import AlertCard from '@/components/ui/AlertCard';
import { showAlert } from '@/components/ui/AppAlert';
import ModalWarningIcon from '@/assets/icons/modal-warning.svg';
import ModalCheckIcon from '@/assets/icons/modal-check.svg';
import ModalPawIcon from '@/assets/icons/modal-paw.svg';
import ToastInquiryIcon from '@/assets/icons/toast/inquiry-received.svg';
import ToastPlaceReportIcon from '@/assets/icons/toast/place-report.svg';
import ToastDailyRecordIcon from '@/assets/icons/toast/daily-record.svg';
import PhotoPermissionModal from '@/components/ui/PhotoPermissionModal';
import AddressSearchModal from '@/components/ui/AddressSearchModal';
import DogPhotoBlank from '@/assets/mypage/dog-photo-blank.svg';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PROFILE_TOP_LANDSCAPE_HEIGHT = (SCREEN_WIDTH * 350) / 390;
// 이미지 상단 여백을 당겨서 첨성대 탑 전체(꼭대기~받침대)가 카드에 가리지 않고 보이게 한다.
const PROFILE_TOP_LANDSCAPE_OFFSET = -PROFILE_TOP_LANDSCAPE_HEIGHT * 0.32;
const PROFILE_BOTTOM_LANDSCAPE_HEIGHT = (SCREEN_WIDTH * 90) / 390;
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
      <Text style={styles.menuChevron}>›</Text>
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
}

function SettingsRow({ icon, title, subtitle, onPress, right, danger, grouped, isLast }: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[
        grouped ? st.rowGrouped : st.row,
        grouped && !isLast && st.rowGroupedDivider,
        danger && st.rowDanger,
      ]}
      activeOpacity={right ? 1 : 0.7}
      onPress={onPress}
    >
      <View style={[st.rowIconBox, danger && st.rowIconBoxDanger]}>{icon}</View>
      <View style={st.rowTextCol}>
        <Text style={[st.rowTitle, danger && st.rowTitleDanger]}>{title}</Text>
        {!!subtitle && <Text style={st.rowSubtitle}>{subtitle}</Text>}
      </View>
      {right ?? <Text style={st.rowChevron}>›</Text>}
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
function InquiryView({ onBack }: { onBack: () => void }) {
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
  );
}

// ─── SettingsView (설정 화면) ─────────────────────────────────────────────────
function SettingsView({ onBack, onEditProfile }: { onBack: () => void; onEditProfile: () => void }) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [withdrawStep, setWithdrawStep] = useState<'confirm' | 'success' | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showInquiry, setShowInquiry] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    const token = await getAccessToken();
    if (token) {
      try {
        await logoutApi(token);
      } catch (e) {
        // 서버 로그아웃이 실패해도 로컬 토큰은 지우고 로그인 화면으로 보낸다.
      }
    }
    await clearTokens();
    router.replace('/login');
  };

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
      await clearTokens();
      setWithdrawStep('success');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '탈퇴에 실패했어요. 잠시 후 다시 시도해주세요.';
      showAlert('회원탈퇴 실패', message);
      setWithdrawStep(null);
    } finally {
      setWithdrawing(false);
    }
  };

  if (showInquiry) {
    return <InquiryView onBack={() => setShowInquiry(false)} />;
  }

  return (
    <SafeAreaView style={st.safeArea}>
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={st.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>설정</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent}>
        <Text style={st.groupLabel}>계정 관리</Text>
        <SettingsRow
          icon={<EditProfileIcon width={20} height={20} color={Colors.coral} />}
          title="정보 수정"
          subtitle="사진·이름·종·크기·나이·성향 변경"
          onPress={onEditProfile}
        />

        <Text style={st.groupLabel}>알림 설정</Text>
        <SettingsRow
          icon={<SettingAlarmIcon width={20} height={20} color={Colors.coral} />}
          title="푸시 알림 설정"
          subtitle="여행 알림·스탬프 알림"
          right={
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: Colors.border, true: Colors.coral }}
              thumbColor={Colors.white}
            />
          }
        />

        <Text style={st.groupLabel}>서비스</Text>
        <View style={st.groupCard}>
          <SettingsRow
            icon={<SettingInquiryIcon width={20} height={20} color={Colors.coral} />}
            title="문의하기"
            subtitle="불편사항·개선 제안"
            grouped
            onPress={() => setShowInquiry(true)}
          />
          <SettingsRow
            icon={<SettingTermsIcon width={20} height={20} color={Colors.coral} />}
            title="이용약관"
            subtitle=""
            grouped
          />
          <SettingsRow
            icon={<SettingPrivacyIcon width={20} height={20} color={Colors.coral} />}
            title="개인정보 처리방침"
            subtitle=""
            grouped
            isLast
          />
        </View>

        <Text style={st.groupLabel}>로그인 관리</Text>
        <SettingsRow
          icon={<SettingLogoutIcon width={20} height={20} color={Colors.coral} />}
          title="로그아웃"
          subtitle=""
          onPress={() => setShowLogoutConfirm(true)}
        />
        <SettingsRow
          icon={<WithdrawIcon width={20} height={20} color={DANGER_COLOR} />}
          title="회원탈퇴"
          subtitle="탈퇴 시 모든 데이터가 삭제돼요"
          danger
          onPress={() => setWithdrawStep('confirm')}
        />

        <Text style={st.versionText}>견주여행 v1.0.0</Text>
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
  );
}

// ─── ReportPlaceView (장소 제보) ──────────────────────────────────────────────
function ReportPlaceView({ onBack }: { onBack: () => void }) {
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
    <SafeAreaView style={rp.safeArea}>
      <View style={rp.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={rp.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={rp.headerTitle}>장소 제보</Text>
      </View>

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
  );
}

// ─── TravelHistoryView (여행 기록) ────────────────────────────────────────────
function TravelHistoryView({ dog, onBack }: { dog: DogProfile; onBack: () => void }) {
  const totalTrips = MOCK_TRAVEL_HISTORY.length;
  const totalPlaces = MOCK_TRAVEL_HISTORY.reduce((sum, item) => sum + item.visitedCount, 0);
  const [viewingScrap, setViewingScrap] = useState<ScrapData | null>(null);

  if (viewingScrap) {
    return <StampAlbumScreen scrap={viewingScrap} onBack={() => setViewingScrap(null)} />;
  }

  return (
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
              {totalTrips}
              <Text style={th.statUnit}>회</Text>
            </Text>
            <Text style={th.statLabel}>총 여행</Text>
          </View>
          <View style={th.statDivider} />
          <View style={th.statItem}>
            <Text style={th.statValue}>
              {totalPlaces}
              <Text style={th.statUnit}>곳</Text>
            </Text>
            <Text style={th.statLabel}>총 방문 장소</Text>
          </View>
          <View style={th.statDivider} />
          <View style={th.statItem}>
            <Text style={th.statValue}>
              {dog.stampCount}
              <Text style={th.statUnit}>개</Text>
            </Text>
            <Text style={th.statLabel}>획득 스탬프</Text>
          </View>
        </View>

        {MOCK_TRAVEL_HISTORY.map((item, i) => {
          const isFirst = i === 0;
          return (
            <View key={item.id} style={th.row}>
              <View style={th.railCol}>
                <View style={[th.dot, isFirst && th.dotFirst]} />
                <View style={th.railLine} />
              </View>
              <View style={th.entryCol}>
                <Text style={th.dateText}>{item.date}</Text>
                <TouchableOpacity
                  style={th.card}
                  activeOpacity={0.85}
                  onPress={() =>
                    setViewingScrap(
                      MOCK_SCRAP_DATA[item.id] ?? {
                        id: item.id,
                        title: '오늘의 경주',
                        travelDate: item.date.replace(/\./g, ' · '),
                        dogName: dog.name,
                        dogProfileImageUri: dog.photoUri,
                        selectedPhotoUris: [],
                        stops: [],
                        totalDistanceInMeters: undefined,
                      }
                    )
                  }
                >
                  <Image source={{ uri: item.imageUri }} style={th.cardImage} resizeMode="cover" />
                  <View style={th.cardBody}>
                    <Text style={th.cardTitle}>{item.title}</Text>
                    <View style={th.cardMetaRow}>
                      <RecordPlaceIcon width={14} height={14} color={Colors.textBody2} />
                      <Text style={th.metaText}>{item.visitedCount}곳 방문</Text>
                      <RecordTimeIcon width={14} height={14} color={Colors.textBody2} style={{ marginLeft: Spacing.md }} />
                      <Text style={th.metaText}>{item.duration}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── StampAlbumScreen (스탬프 앨범) ───────────────────────────────────────────

/** 방문지 목록을 Tmap 보행자 경로 API로 이어서, 경로보기와 동일한 실제 도보 경로/거리를 구한다.
 * 키가 없거나 특정 구간 요청이 실패하면 그 구간만 두 지점 간 직선(Haversine)으로 대체한다. */
function useScrapRoute(stops: RouteStop[]) {
  const stopLatLngs = useMemo<LatLng[]>(
    () => stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
    [stops]
  );
  const [segments, setSegments] = useState<(PedestrianRouteResult | null)[]>([]);

  useEffect(() => {
    if (stopLatLngs.length < 2) {
      setSegments([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      stopLatLngs.slice(0, -1).map((from, i) => fetchPedestrianRoute(from, stopLatLngs[i + 1]))
    ).then((results) => {
      if (!cancelled) setSegments(results);
    });
    return () => {
      cancelled = true;
    };
  }, [stopLatLngs]);

  const routePath = useMemo<LatLng[]>(
    () =>
      stopLatLngs.slice(0, -1).flatMap((from, i) => segments[i]?.path ?? [from, stopLatLngs[i + 1]]),
    [stopLatLngs, segments]
  );

  const distanceMeters = useMemo(
    () =>
      stopLatLngs.slice(0, -1).reduce((sum, from, i) => {
        const segment = segments[i];
        if (segment) return sum + segment.distanceMeters;
        return sum + haversineMeters(from.lat, from.lng, stopLatLngs[i + 1].lat, stopLatLngs[i + 1].lng);
      }, 0),
    [stopLatLngs, segments]
  );

  return { routePath, distanceMeters };
}

function PolaroidPhoto({
  uri,
  rotate,
  showTape,
  onPress,
  style,
}: {
  uri?: string;
  rotate: string;
  showTape?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[sa.polaroid, { transform: [{ rotate }] }, style]}
    >
      {showTape && <View style={sa.tape} />}
      {uri ? (
        <Image source={{ uri }} style={sa.polaroidPhoto} resizeMode="cover" />
      ) : (
        <View style={[sa.polaroidPhoto, sa.polaroidPlaceholder]}>
          <Text style={sa.polaroidPlaceholderText}>사진 추가</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function DogProfileImage({ uri }: { uri?: string }) {
  return (
    <View style={sa.dogProfileWrap}>
      {uri ? (
        <Image source={{ uri }} style={sa.dogProfileImage} resizeMode="cover" />
      ) : (
        <DogPhotoBlank width={64} height={64} />
      )}
    </View>
  );
}

function FootprintSummaryCard({
  dogName,
  footprintCount,
}: {
  dogName: string;
  footprintCount: number;
}) {
  return (
    <View style={sa.footprintCard}>
      <Text style={sa.footprintTitle} numberOfLines={1} ellipsizeMode="tail">
        {dogName}의 발자국 지도
      </Text>
      <View style={sa.footprintCountRow}>
        <Text style={sa.footprintCount}>{footprintCount}</Text>
        <Image
          source={require('@/assets/icons/pets.png')}
          style={[sa.footprintPawIcon, { tintColor: Colors.coral }]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

/** 여행 완료 뱃지. 실제 뱃지 데이터/이미지가 확정되면 badge.imageUri만 채워주면 된다. */
function TravelBadge({ badge }: { badge?: TravelBadgeData }) {
  return (
    <View style={sa.badgeWrap}>
      {badge?.imageUri && (
        <Image source={{ uri: badge.imageUri }} style={sa.badgeImage} resizeMode="contain" />
      )}
    </View>
  );
}

function RouteSnapshotCard({
  stops,
  routePath,
  badge,
  onMapReady,
}: {
  stops: RouteStop[];
  routePath: LatLng[];
  badge?: TravelBadgeData;
  onMapReady: () => void;
}) {
  const routePlaces = useMemo(
    () => stops.map((s) => ({ id: s.id, lat: s.latitude, lng: s.longitude })),
    [stops]
  );

  return (
    <View style={sa.mapCard}>
      {stops.length > 0 ? (
        <KakaoMap
          routePlaces={routePlaces}
          routePath={routePath}
          onMapReady={onMapReady}
        />
      ) : (
        <View style={sa.mapPlaceholder}>
          <Text style={sa.mapPlaceholderText}>저장된 경로가 없어요</Text>
        </View>
      )}
      <View style={sa.mapBadgeOverlay}>
        <TravelBadge badge={badge} />
      </View>
    </View>
  );
}

function StampAlbumScreen({ scrap, onBack }: { scrap: ScrapData; onBack: () => void }) {
  const scrapAreaRef = useRef<View>(null);
  const [photoUris, setPhotoUris] = useState<(string | undefined)[]>([
    scrap.selectedPhotoUris[0],
    scrap.selectedPhotoUris[1],
  ]);
  // 저장된 경로가 없으면 기다릴 지도가 없으니 바로 준비된 것으로 본다.
  const [isMapReady, setIsMapReady] = useState(scrap.stops.length === 0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showPhotoPermissionModal, setShowPhotoPermissionModal] = useState(false);
  const { isSaving, isSharing, saveToGallery, shareImage } = useScrapCapture(scrapAreaRef, () => {
    setToastMsg('하루 기록이 저장됐어요!');
  });

  const { routePath, distanceMeters } = useScrapRoute(scrap.stops);
  const totalDistanceInMeters = scrap.totalDistanceInMeters ?? distanceMeters;
  const footprintCount = useMemo(
    () => calculateFootprintCount(totalDistanceInMeters),
    [totalDistanceInMeters]
  );

  const pickPhoto = async (index: number) => {
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
    const uri = result.assets[0].uri;
    setPhotoUris((prev) => {
      const next = [...prev];
      next[index] = uri;
      return next;
    });
  };

  const isBusy = isSaving || isSharing;
  const actionsDisabled = isBusy || !isMapReady;

  return (
    <SafeAreaView style={sa.safeArea}>
      <View style={sa.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={sa.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={sa.headerTitle}>스탬프 앨범</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sa.scrollContent}>
        {/* 캡처/공유 대상 영역: 헤더와 하단 버튼은 여기 포함되지 않는다 */}
        <View ref={scrapAreaRef} collapsable={false} style={sa.captureArea}>
          <Text style={sa.dateText}>{scrap.travelDate}</Text>
          <Text style={sa.titleText} numberOfLines={1} ellipsizeMode="tail">
            {scrap.title}
          </Text>
          <Text style={sa.subtitleText} numberOfLines={1} ellipsizeMode="tail">
            {scrap.dogName}와 함께한 하루
          </Text>

          <View style={sa.photoArea}>
            <PolaroidPhoto
              uri={photoUris[0]}
              rotate="-6deg"
              showTape
              onPress={() => pickPhoto(0)}
              style={sa.photoBack}
            />
            <PolaroidPhoto
              uri={photoUris[1]}
              rotate="5deg"
              showTape
              onPress={() => pickPhoto(1)}
              style={sa.photoFront}
            />
            <View style={sa.dogProfileOverlay}>
              <DogProfileImage uri={scrap.dogProfileImageUri} />
            </View>
          </View>

          <FootprintSummaryCard dogName={scrap.dogName} footprintCount={footprintCount} />

          <RouteSnapshotCard
            stops={scrap.stops}
            routePath={routePath}
            badge={scrap.badge}
            onMapReady={() => setIsMapReady(true)}
          />
        </View>
      </ScrollView>

      <View style={sa.actionRow}>
        <TouchableOpacity
          style={[sa.actionBtn, sa.actionBtnOutline, actionsDisabled && sa.actionBtnDisabled]}
          activeOpacity={0.85}
          disabled={actionsDisabled}
          onPress={saveToGallery}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.coral} />
          ) : (
            <Text style={sa.actionBtnOutlineText}>이미지로 저장</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[sa.actionBtn, sa.actionBtnFilled, actionsDisabled && sa.actionBtnDisabled]}
          activeOpacity={0.85}
          disabled={actionsDisabled}
          onPress={shareImage}
        >
          {isSharing ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={sa.actionBtnFilledText}>SNS 공유</Text>
          )}
        </TouchableOpacity>
      </View>

      <Toast
        message={toastMsg}
        subtitle={toastMsg ? '마이페이지 > 방문한 장소 배너 클릭 후 확인' : undefined}
        onHide={() => setToastMsg(null)}
        icon={<ToastDailyRecordIcon width={18} height={20} />}
      />

      <PhotoPermissionModal
        visible={showPhotoPermissionModal}
        onCancel={() => setShowPhotoPermissionModal(false)}
        onOpenSettings={() => {
          setShowPhotoPermissionModal(false);
          Linking.openSettings();
        }}
      />
    </SafeAreaView>
  );
}

// ─── EditProfileView (프로필 편집) ────────────────────────────────────────────
const DOG_SIZE_OPTIONS: { value: string; label: string; iconSize: number }[] = [
  { value: '소형견', label: '소형', iconSize: 26 },
  { value: '중형견', label: '중형', iconSize: 38 },
  { value: '대형견', label: '대형', iconSize: 50 },
];
const PERSONALITY_OPTIONS = ['낯가림', '느긋함', '친화력 좋음', '예민함', '호기심', '활동적'];

function EditProfileView({
  dog,
  onBack,
  onSave,
}: {
  dog?: DogProfile;
  onBack: () => void;
  onSave: (saved: DogProfile) => void;
}) {
  const isNew = !dog;
  const [name, setName] = useState(dog?.name ?? '');
  const [breed, setBreed] = useState(dog?.breed ?? '');
  const [sizeType, setSizeType] = useState(dog?.sizeType ?? DOG_SIZE_OPTIONS[1].value);
  const [age, setAge] = useState(dog ? String(dog.age) : '');
  const [gender, setGender] = useState<DogProfile['gender']>(dog?.gender ?? '남아');
  const [personality, setPersonality] = useState<string>(
    dog?.personalityTags.find((tag) => PERSONALITY_OPTIONS.includes(tag)) ?? PERSONALITY_OPTIONS[0]
  );
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
    const token = await getAccessToken();
    if (!token) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        breed: breed.trim(),
        size: sizeToApi(sizeType),
        age: Number(age) || 1,
        gender: genderToApi(gender),
        personality: personalityToApi(personality),
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
          style={ep.input}
          placeholder="나이를 입력해 주세요"
          placeholderTextColor={Colors.textMuted}
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
        />

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

        <Text style={ep.label}>성향</Text>
        <View style={ep.tagRow}>
          {PERSONALITY_OPTIONS.map((tag) => {
            const selected = personality === tag;
            return (
              <TouchableOpacity
                key={tag}
                style={[ep.tagChip, selected && ep.tagChipSelected]}
                activeOpacity={0.8}
                onPress={() => setPersonality(tag)}
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
  );
}

// ─── StampGalleryScreen (스탬프 앨범) ──────────────────────────────────────────
function StampGalleryScreen({ onBack }: { onBack: () => void }) {
  const [earnedStampIndices, setEarnedStampIndices] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    getEarnedStampIndices().then(setEarnedStampIndices);
  }, []);

  const progressRatio = earnedStampIndices.size / TOTAL_STAMP_COUNT;

  return (
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

      <View style={sg.hintCard}>
        <View style={sg.hintTitleRow}>
          <Image source={require('@/assets/mypage/stamp-hint-leaf.png')} style={sg.hintLeaf} resizeMode="contain" />
          <Text style={sg.hintTitle}>다음 스탬프 힌트</Text>
        </View>
        <View style={sg.hintBodyRow}>
          <Text style={sg.hintBody}>대릉원 방문하기</Text>
          <Text style={sg.hintChevron}>›</Text>
        </View>
      </View>
    </SafeAreaView>
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
  const [showReportPlace, setShowReportPlace] = useState(false);
  const [showTravelHistory, setShowTravelHistory] = useState(false);
  const [showStampGallery, setShowStampGallery] = useState(false);
  const [profileEditorMode, setProfileEditorMode] = useState<'edit' | 'add' | null>(null);
  const [pendingPrimaryDog, setPendingPrimaryDog] = useState<DogProfile | null>(null);
  const [primarySwitchSuccess, setPrimarySwitchSuccess] = useState(false);
  const [earnedStampIndices, setEarnedStampIndices] = useState<Set<number>>(new Set([0]));
  const dog = dogProfiles.find((d) => d.id === selectedDogId) ?? dogProfiles[0];

  // 다른 탭에 있는 동안 관광지 도착(지오펜싱)으로 스탬프가 늘었을 수 있어, 마이 탭에 올 때마다 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      getEarnedStampIndices().then(setEarnedStampIndices);
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

  const handleConfirmPrimarySwitch = () => {
    if (!pendingPrimaryDog) return;
    const newPrimaryId = pendingPrimaryDog.id;
    setDogProfiles((prev) => prev.map((d) => ({ ...d, isPrimary: d.id === newPrimaryId })));
    setSelectedDogId(newPrimaryId);
    setPendingPrimaryDog(null);
    setPrimarySwitchSuccess(true);
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

  if (showSettings) {
    return (
      <SettingsView
        onBack={() => setShowSettings(false)}
        onEditProfile={() => {
          setShowSettings(false);
          setProfileEditorMode('edit');
        }}
      />
    );
  }

  if (showReportPlace) {
    return <ReportPlaceView onBack={() => setShowReportPlace(false)} />;
  }

  if (showTravelHistory && dog) {
    return <TravelHistoryView dog={dog} onBack={() => setShowTravelHistory(false)} />;
  }

  if (showStampGallery) {
    return <StampGalleryScreen onBack={() => setShowStampGallery(false)} />;
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
          if (profileEditorMode === 'add') setSelectedDogId(saved.id);
          setProfileEditorMode(null);
        }}
      />
    );
  }

  if (!dog) {
    return (
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
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
                  {dog.breed} · {dog.sizeType} · {dog.age}살
                </Text>
                <TouchableOpacity onPress={() => setProfileEditorMode('edit')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <PencilIcon width={14} height={14} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.tagsRow}>
                {dog.personalityTags.map((tag) => (
                  <Badge key={tag} label={tag} variant="filled" tone="neutral" style={styles.profileTagBadge} />
                ))}
              </View>
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
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{dog.name}의 스탬프</Text>
            <TouchableOpacity onPress={() => setShowStampGallery(true)}>
              <Text style={styles.sectionMoreText}>전체보기 ›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.stampRow}>
            {Array.from({ length: STAMP_SLOTS }).map((_, i) => {
              const earned = earnedStampIndices.has(i);
              const StampIcon = earned ? STAMP_ICONS[i] : STAMP_LOCKED_ICON;
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

        <ProfileBottomLandscape
          width={SCREEN_WIDTH}
          height={PROFILE_BOTTOM_LANDSCAPE_HEIGHT}
          style={styles.profileBottomLandscape}
        />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.xl },
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  pageTitle: { fontSize: 22, fontWeight: '700', color: Colors.textBody1 },
  profileSection: { position: 'relative' },
  profileTopLandscape: { position: 'absolute', left: 0, right: 0, top: 0 },
  profileBottomLandscape: { marginTop: Spacing.xl },
  profileCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
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
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  profileTagBadge: { height: 20 },
  section: {
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
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
  dogItemAvatarPlaceholder: { overflow: 'hidden' },
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
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.background,
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
  menuChevron: { fontSize: 18, color: Colors.textMuted },
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
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rowDanger: { backgroundColor: DANGER_BG },
  groupCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  rowGrouped: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  rowGroupedDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0EDE8',
  },
  rowIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconBoxDanger: { backgroundColor: DANGER_BG },
  rowTextCol: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.textBody1 },
  rowTitleDanger: { color: DANGER_COLOR },
  rowSubtitle: { fontSize: 12, color: Colors.textMuted },
  rowChevron: { fontSize: 18, color: Colors.textMuted },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.xl,
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
  cardImage: { width: '100%', height: 160 },
  cardBody: { padding: Spacing.lg, gap: 6 },
  cardTitle: { fontSize: 16, color: Colors.textBody1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: Colors.textBody2, marginRight: Spacing.xs },
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
    shadowColor: '#3A3330',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  hintCard: {
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  hintTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  hintLeaf: { width: 15, height: 18 },
  hintTitle: { fontSize: 14, fontWeight: '700', color: Colors.secondary },
  hintBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Spacing.xxl,
  },
  hintBody: { fontSize: 14, color: Colors.textBody2 },
  hintChevron: { fontSize: 16, color: Colors.textMuted },
});

// ─── 스탬프 앨범 스타일 (sa) ───────────────────────────────────────────────────
const sa = StyleSheet.create({
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
  scrollContent: { paddingBottom: 24 },
  captureArea: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  dateText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'left',
    letterSpacing: 1,
    marginLeft: 16,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textBody1,
    textAlign: 'left',
    marginTop: 4,
    marginLeft: 16,
  },
  subtitleText: {
    fontSize: 14,
    color: Colors.textBody2,
    textAlign: 'left',
    marginTop: 4,
    marginLeft: 16,
  },
  photoArea: {
    height: 260,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  polaroid: {
    backgroundColor: Colors.white,
    padding: 8,
    paddingBottom: 28,
    borderRadius: 4,
    shadowColor: '#3A3330',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  photoBack: { position: 'absolute', left: '4%', top: 0, zIndex: 1 },
  photoFront: { position: 'absolute', right: '4%', top: 28, zIndex: 2 },
  polaroidPhoto: {
    // 가로 4 : 세로 3 비율
    width: 192,
    height: 144,
    borderRadius: 2,
    backgroundColor: Colors.bgWarm,
  },
  polaroidPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  polaroidPlaceholderText: { fontSize: 12, color: Colors.textMuted },
  tape: {
    position: 'absolute',
    top: -14,
    left: '50%',
    marginLeft: -28,
    width: 56,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    transform: [{ rotate: '-3deg' }],
    zIndex: 5,
  },
  dogProfileOverlay: { position: 'absolute', right: 4, bottom: 24, zIndex: 3 },
  dogProfileWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    borderWidth: 3,
    borderColor: Colors.background,
    backgroundColor: Colors.bgWarm,
    overflow: 'hidden',
    shadowColor: '#3A3330',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  dogProfileImage: { width: '100%', height: '100%' },
  footprintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  footprintTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textBody1, marginRight: Spacing.sm },
  footprintCountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footprintCount: { fontSize: 22, fontWeight: '700', color: Colors.coral },
  footprintPawIcon: { width: 20, height: 20 },
  mapCard: {
    height: 200,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.bgWarm,
    position: 'relative',
  },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapPlaceholderText: { fontSize: 13, color: Colors.textMuted },
  mapBadgeOverlay: { position: 'absolute', right: 12, bottom: 12 },
  badgeWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3A3330',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  badgeImage: { width: 40, height: 40 },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnOutline: { backgroundColor: Colors.bgWarm },
  actionBtnOutlineText: { color: Colors.textBody1, fontSize: 15, fontWeight: '600' },
  actionBtnFilled: { backgroundColor: Colors.bgWarm },
  actionBtnFilledText: { color: Colors.textBody1, fontSize: 15, fontWeight: '600' },
  actionBtnDisabled: { opacity: 0.5 },
});
