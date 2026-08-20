import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import SizeSmallIcon from '@/assets/icons/size-small.svg';
import SizeMediumIcon from '@/assets/icons/size-medium.svg';
import SizeLargeIcon from '@/assets/icons/size-large.svg';
import OnboardingCameraIcon from '@/assets/login/onboarding-camera.svg';
import OnboardingCafeIcon from '@/assets/login/onboarding-cafe.svg';
import OnboardingNatureIcon from '@/assets/login/onboarding-nature.svg';
import OnboardingPersonalityIllustration from '@/assets/login/onboarding-personality.svg';
import InfoIcon from '@/assets/icons/info.svg';
import { completeOnboarding, ApiError, PetTravelPreference, PetPersonality } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { sizeToApi } from '@/utils/petMappers';
import { showAlert } from '@/components/ui/AppAlert';
import SwipeBackScreen from '@/components/ui/SwipeBackScreen';

type IconComponent = React.FC<{ width?: number; height?: number; color?: string }>;

type Step = 1 | 2 | 3;

const STEP_TITLES: [string, string][] = [
  ['어떤 여행을', '선호 하시나요?'],
  ['강아지 크기를', '알려주세요!'],
  ['강아지의 성향은', '어떤가요?'],
];

const TRAVEL_PREF_OPTIONS: { id: string; label: string; Icon: IconComponent; travelPreference: PetTravelPreference }[] = [
  { id: 'photo-spot', label: '사진 찍기 좋은 관광지', Icon: OnboardingCameraIcon, travelPreference: 'PHOTO_SPOT' },
  { id: 'cafe', label: '분위기 좋은 카페', Icon: OnboardingCafeIcon, travelPreference: 'CAFE' },
  { id: 'nature-walk', label: '산책하기 좋은 자연 경관', Icon: OnboardingNatureIcon, travelPreference: 'NATURE' },
];

const DOG_SIZE_OPTIONS = [
  { value: '소형견', iconSize: 30, Icon: SizeSmallIcon },
  { value: '중형견', iconSize: 42, Icon: SizeMediumIcon },
  { value: '대형견', iconSize: 54, Icon: SizeLargeIcon },
];

const MAX_PERSONALITY_SELECT = 2;
const PERSONALITY_OPTIONS: { id: string; label: string; personality: PetPersonality }[] = [
  { id: 'shy', label: '#낯가림', personality: 'SHYNESS' },
  { id: 'relaxed', label: '#느긋함', personality: 'RELAXED' },
  { id: 'social', label: '#사교적', personality: 'FRIENDLY' },
  { id: 'sensitive', label: '#예민함', personality: 'SENSITIVITY' },
  { id: 'curious', label: '#호기심', personality: 'CURIOSITY' },
  { id: 'active', label: '#활동적', personality: 'ACTIVE' },
];

function StepIndicator({ currentStep }: { currentStep: Step }) {
  return (
    <View style={ob.stepRow}>
      {([1, 2, 3] as Step[]).map((step, idx) => {
        const isDone = step < currentStep;
        const isCurrent = step === currentStep;
        return (
          <React.Fragment key={step}>
            {idx > 0 && <View style={ob.stepLine} />}
            <View style={[ob.stepDot, isCurrent && ob.stepDotCurrent, isDone && ob.stepDotDone]}>
              {isDone ? (
                <Text style={ob.stepDotCheck}>✓</Text>
              ) : (
                <Text style={[ob.stepDotText, isCurrent && ob.stepDotTextCurrent]}>{step}</Text>
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

function OptionListItem({
  label,
  Icon,
  selected,
  onPress,
}: {
  label: string;
  Icon?: IconComponent;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[ob.optionRow, selected && ob.optionRowSelected]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={ob.optionAvatar}>
        {Icon && <Icon width={18} height={16} color={Colors.white} />}
      </View>
      <Text style={ob.optionLabel} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
      <View style={[ob.optionCheckbox, selected && ob.optionCheckboxSelected]}>
        {selected && <Text style={ob.optionCheckMark}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

function SizeOption({
  label,
  iconSize,
  Icon,
  selected,
  onPress,
}: {
  label: string;
  iconSize: number;
  Icon: React.FC<{ width?: number; height?: number }>;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[ob.sizeBox, selected && ob.sizeBoxSelected]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <Icon width={iconSize} height={iconSize} />
      <Text style={ob.sizeLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity style={ob.primaryBtn} activeOpacity={0.85} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={ob.primaryBtnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

export default function OnboardingScreen() {
  const { dogName, photoUri } = useLocalSearchParams<{ dogName?: string; photoUri?: string }>();
  const [step, setStep] = useState<Step>(1);
  const [travelPref, setTravelPref] = useState(TRAVEL_PREF_OPTIONS[0].id);
  const [dogSize, setDogSize] = useState(DOG_SIZE_OPTIONS[0].value);
  const [personalities, setPersonalities] = useState<string[]>([]);
  const [registering, setRegistering] = useState(false);

  const togglePersonality = (id: string) => {
    setPersonalities((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_PERSONALITY_SELECT) return prev;
      return [...prev, id];
    });
  };

  const handleNext = async () => {
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    if (personalities.length !== MAX_PERSONALITY_SELECT) {
      showAlert('반려견 등록', '강아지의 성향은 필수로 두 가지를 선택해주세요.');
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      router.replace('/(tabs)');
      return;
    }
    setRegistering(true);
    try {
      const travelPreference = TRAVEL_PREF_OPTIONS.find((o) => o.id === travelPref)?.travelPreference ?? 'NATURE';
      const personality = personalities
        .map((id) => PERSONALITY_OPTIONS.find((o) => o.id === id)?.personality)
        .filter((p): p is PetPersonality => !!p);
      await completeOnboarding(
        {
          name: dogName ?? '',
          size: sizeToApi(dogSize),
          travelPreference,
          personality,
        },
        token,
        photoUri || null
      );
      router.replace({ pathname: '/(tabs)', params: { justOnboarded: '1' } });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '반려견 등록에 실패했어요. 잠시 후 다시 시도해주세요.';
      showAlert('반려견 등록', message);
    } finally {
      setRegistering(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as Step);
      return;
    }
    router.back();
  };

  const [titleLine1, titleLine2] = STEP_TITLES[step - 1];

  return (
    <SwipeBackScreen onBack={handleBack}>
      <SafeAreaView style={ob.safeArea}>
        <View style={ob.content}>
          <TouchableOpacity
            style={ob.backBtn}
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={ob.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={ob.header}>
            <StepIndicator currentStep={step} />

            {step === 3 && (
              <View style={ob.illustrationWrap}>
                <OnboardingPersonalityIllustration width={200} height={141} />
              </View>
            )}

            <Text style={ob.title}>
              {titleLine1}
              {'\n'}
              {titleLine2}
            </Text>
          </View>

          <View style={ob.optionsArea}>
            {step === 1 && (
              <View>
                {TRAVEL_PREF_OPTIONS.map((opt) => (
                  <OptionListItem
                    key={opt.id}
                    label={opt.label}
                    Icon={opt.Icon}
                    selected={travelPref === opt.id}
                    onPress={() => setTravelPref(opt.id)}
                  />
                ))}
              </View>
            )}

            {step === 2 && (
              <View style={ob.sizeRow}>
                {DOG_SIZE_OPTIONS.map((opt) => (
                  <SizeOption
                    key={opt.value}
                    label={opt.value}
                    iconSize={opt.iconSize}
                    Icon={opt.Icon}
                    selected={dogSize === opt.value}
                    onPress={() => setDogSize(opt.value)}
                  />
                ))}
              </View>
            )}

            {step === 3 && (
              <View style={ob.personalityGrid}>
                {PERSONALITY_OPTIONS.map((opt) => {
                  const selected = personalities.includes(opt.id);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[ob.personalityChip, selected && ob.personalityChipSelected]}
                      activeOpacity={0.8}
                      onPress={() => togglePersonality(opt.id)}
                    >
                      <Text style={[ob.personalityChipText, selected && ob.personalityChipTextSelected]}>
                        <Text style={ob.personalityChipHash}>#</Text>
                        {opt.label.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        <View style={ob.bottomBar}>
          {step === 3 && (
            <View style={ob.personalityHintRow}>
              <InfoIcon width={14} height={14} />
              <Text style={ob.personalityHint}>강아지의 성향은 필수로 두 가지를 선택해주세요</Text>
            </View>
          )}
          <PrimaryButton
            label={step < 3 ? '다음' : '견주 여행 즐기러 가기'}
            onPress={handleNext}
            loading={registering}
          />
        </View>
      </SafeAreaView>
    </SwipeBackScreen>
  );
}

const ob = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: Spacing.xl },
  backBtn: { marginTop: Spacing.xl, marginBottom: Spacing.md },
  backArrow: { fontSize: 22, color: Colors.textBody1 },
  header: { paddingTop: Spacing.md },
  optionsArea: { flex: 1, justifyContent: 'center' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotCurrent: { backgroundColor: Colors.coral, borderColor: Colors.coral },
  stepDotDone: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  stepDotText: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
  stepDotTextCurrent: { color: Colors.white },
  stepDotCheck: { fontSize: 16, fontWeight: '700', color: Colors.white },
  stepLine: { width: 40, height: 1.5, backgroundColor: Colors.border, marginHorizontal: 4 },
  illustrationWrap: { alignItems: 'center', marginBottom: Spacing.xxl },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textBody1,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: Spacing.xxl,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  optionRowSelected: {
    borderColor: Colors.coral,
    borderWidth: 1.5,
    backgroundColor: Colors.primaryTint,
  },
  optionAvatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { flex: 1, fontSize: 15, color: Colors.textBody1 },
  optionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckboxSelected: { backgroundColor: Colors.coral, borderColor: Colors.coral },
  optionCheckMark: { fontSize: 14, fontWeight: '700', color: Colors.white },
  sizeRow: { flexDirection: 'row', gap: Spacing.sm },
  sizeBox: {
    flex: 1,
    height: 190,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  sizeBoxSelected: { borderColor: Colors.coral, borderWidth: 1.5 },
  sizeLabel: { fontSize: 14, color: Colors.textBody1 },
  personalityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  personalityChip: {
    width: 100,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  personalityChipSelected: { borderColor: Colors.coral, borderWidth: 1.5, backgroundColor: Colors.primaryTint },
  personalityChipText: { fontSize: 14, fontWeight: '500', color: Colors.textBody1 },
  personalityChipTextSelected: { fontWeight: '700' },
  personalityChipHash: { color: Colors.coral },
  personalityHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  personalityHint: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
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
