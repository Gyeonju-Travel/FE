import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import SignupCameraIcon from '@/assets/login/signup-camera.svg';
import { showAlert } from '@/components/ui/AppAlert';

const AVATAR_SIZE = 170;
const AVATAR_MARGIN_BOTTOM = Spacing.xxl * 1.5;

export default function SignupCompleteScreen() {
  const [dogName, setDogName] = useState('');

  const [stageHeight, setStageHeight] = useState(0);
  const [avatarHeight, setAvatarHeight] = useState(0);
  const [nameGroupHeight, setNameGroupHeight] = useState(0);

  const onStageLayout = (e: LayoutChangeEvent) => setStageHeight(e.nativeEvent.layout.height);
  const onAvatarLayout = (e: LayoutChangeEvent) => setAvatarHeight(e.nativeEvent.layout.height);
  const onNameGroupLayout = (e: LayoutChangeEvent) => setNameGroupHeight(e.nativeEvent.layout.height);

  const ready = stageHeight > 0 && avatarHeight > 0 && nameGroupHeight > 0;
  // 이름 입력 그룹의 중심이 stage 정중앙(stageHeight/2)에 오도록,
  // 아바타 위쪽 여백을 계산한다. (absolute/translateY 대신 marginTop 계산)
  const avatarTopSpacer = ready
    ? Math.max(0, stageHeight / 2 - nameGroupHeight / 2 - AVATAR_MARGIN_BOTTOM - avatarHeight)
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>가입이 완료되었어요!</Text>

        <View style={styles.stage} onLayout={onStageLayout}>
          <View
            style={[styles.avatarWrap, { marginTop: avatarTopSpacer, opacity: ready ? 1 : 0 }]}
            onLayout={onAvatarLayout}
          >
            <View style={styles.avatar} />
            <TouchableOpacity style={styles.cameraBtn} activeOpacity={0.8}>
              <SignupCameraIcon width={20} height={18} color={Colors.textBody2} />
            </TouchableOpacity>
          </View>

          <View style={[styles.nameGroup, { opacity: ready ? 1 : 0 }]} onLayout={onNameGroupLayout}>
            <Text style={styles.label}>강아지 이름</Text>
            <TextInput
              style={styles.input}
              placeholder="이름을 입력해 주세요"
              placeholderTextColor={Colors.textMuted}
              value={dogName}
              onChangeText={setDogName}
            />
          </View>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={() => {
            if (!dogName.trim()) {
              showAlert('강아지 이름', '강아지 이름을 입력해주세요.');
              return;
            }
            router.replace({ pathname: '/onboarding', params: { dogName: dogName.trim() } });
          }}
        >
          <Text style={styles.primaryBtnText}>다음</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl * 2, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: Colors.textBody1 },
  stage: { flex: 1, width: '100%', alignItems: 'center' },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginBottom: AVATAR_MARGIN_BOTTOM,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  cameraBtn: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 40,
    height: 40,
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
  nameGroup: { width: '100%' },
  label: { alignSelf: 'flex-start', fontSize: 14, fontWeight: '600', color: Colors.textBody1, marginBottom: 8 },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Colors.textBody1,
  },
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
