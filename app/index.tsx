import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, Modal, Linking } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Spacing } from '@/constants/theme';
import SplashLandscape from '@/assets/splash/splash-landscape.svg';
import AlertCard from '@/components/ui/AlertCard';
import ModalPawIcon from '@/assets/icons/modal-paw.svg';
import { getAccessToken } from '@/utils/authStorage';

const SCREEN_WIDTH = Dimensions.get('window').width;
const LANDSCAPE_ASPECT = 390 / 218;

export default function SplashScreen() {
  const [showLocationModal, setShowLocationModal] = useState(false);

  // 저장된 로그인 세션이 있으면(자동로그인) 로그인 화면을 건너뛰고 바로 앱으로 들어간다.
  // 세션이 없을 때만 로그인 화면으로 보낸다.
  const proceedAfterSplash = async () => {
    const token = await getAccessToken();
    router.replace(token ? '/(tabs)' : '/login');
  };

  useEffect(() => {
    let navigated = false;
    const goNext = () => {
      if (navigated) return;
      navigated = true;
      proceedAfterSplash();
    };

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setTimeout(goNext, 1800);
        } else {
          setShowLocationModal(true);
        }
      } catch (e) {
        setTimeout(goNext, 1800);
      }
    })();

    return () => {
      navigated = true;
    };
  }, []);

  const handleClose = () => {
    setShowLocationModal(false);
    proceedAfterSplash();
  };

  const handleOpenSettings = () => {
    setShowLocationModal(false);
    Linking.openSettings();
    proceedAfterSplash();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={require('@/assets/splash/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>견주여행</Text>
        <Text style={styles.subtitle}>반려견과 동행하는 경주 여행</Text>
      </View>
      <SplashLandscape
        style={styles.landscape}
        width={SCREEN_WIDTH}
        height={SCREEN_WIDTH / LANDSCAPE_ASPECT}
      />

      <Modal visible={showLocationModal} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.modalBackdrop}>
          <AlertCard
            icon={<ModalPawIcon width={26} height={24} />}
            iconTone="sage"
            title="여행 기록을 위해 위치 권한이 필요해요!"
            subtitle={"설정 화면에서 위치 권한 '항상 허용'을\n눌러주세요"}
            buttons={[
              { label: '취소', onPress: handleClose, variant: 'outline' },
              { label: '변경하기', onPress: handleOpenSettings, tone: 'sage' },
            ]}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgWarm,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logo: {
    width: 190,
    height: 190,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textBody1,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textBody2,
  },
  landscape: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(58,51,48,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
