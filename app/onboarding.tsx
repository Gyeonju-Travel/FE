import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

// NOTE: 아직 앱 진입 흐름(예: 첫 실행 시 이동, 로그인 후 이동)과 연결되지 않은 상태.
// 실제로 온보딩을 붙일 때 여기(handleNext의 3단계 완료 분기)에서 다음 화면으로 이동시키면 된다.

type Step = 1 | 2 | 3;

const STEP_TITLES: [string, string][] = [
  ['어떤 여행을', '선호 하시나요?'],
  ['강아지 크기를', '알려주세요!'],
  ['평소 산책 스타일은', '어떤가요?'],
];

const TRAVEL_PREF_OPTIONS = [
  { id: 'photo-spot', label: '사진 찍기 좋은 관광지' },
  { id: 'cafe', label: '분위기 좋은 카페' },
  { id: 'nature-walk', label: '산책하기 좋은 자연 경관' },
];

const DOG_SIZE_OPTIONS = [
  { value: '소형견', iconSize: 26 },
  { value: '중형견', iconSize: 38 },
  { value: '대형견', iconSize: 50 },
];

const WALK_STYLE_OPTIONS = [
  { id: 'short', label: '짧은 산책을 선호해요' },
  { id: 'long', label: '긴 산책도 거뜬해요' },
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
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[ob.optionRow, selected && ob.optionRowSelected]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={ob.optionAvatar} />
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
  selected,
  onPress,
}: {
  label: string;
  iconSize: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[ob.sizeBox, selected && ob.sizeBoxSelected]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <Image
        source={require('@/assets/icons/puppy.png')}
        style={{ width: iconSize, height: iconSize, tintColor: Colors.textMuted }}
        resizeMode="contain"
      />
      <Text style={ob.sizeLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={ob.primaryBtn} activeOpacity={0.85} onPress={onPress}>
      <Text style={ob.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>(1);
  const [travelPref, setTravelPref] = useState(TRAVEL_PREF_OPTIONS[0].id);
  const [dogSize, setDogSize] = useState(DOG_SIZE_OPTIONS[0].value);
  const [walkStyle, setWalkStyle] = useState(WALK_STYLE_OPTIONS[0].id);

  const handleNext = () => {
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
      return;
    }
    // 3단계 완료 - 다음 화면 연결은 아직 미구현
  };

  const [titleLine1, titleLine2] = STEP_TITLES[step - 1];

  return (
    <SafeAreaView style={ob.safeArea}>
      <View style={ob.content}>
        <StepIndicator currentStep={step} />

        <Text style={ob.title}>
          {titleLine1}
          {'\n'}
          {titleLine2}
        </Text>

        {step === 1 && (
          <View>
            {TRAVEL_PREF_OPTIONS.map((opt) => (
              <OptionListItem
                key={opt.id}
                label={opt.label}
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
                selected={dogSize === opt.value}
                onPress={() => setDogSize(opt.value)}
              />
            ))}
          </View>
        )}

        {step === 3 && (
          <View>
            {WALK_STYLE_OPTIONS.map((opt) => (
              <OptionListItem
                key={opt.id}
                label={opt.label}
                selected={walkStyle === opt.id}
                onPress={() => setWalkStyle(opt.id)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={ob.bottomBar}>
        <PrimaryButton label={step < 3 ? '다음' : '견주 여행 즐기러 가기'} onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}

const ob = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl },
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
    backgroundColor: Colors.primaryBorder,
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
    height: 140,
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
