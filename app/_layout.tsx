import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppAlertHost } from '@/components/ui/AppAlert';
import * as Notifications from 'expo-notifications';
import { getAccessToken } from '@/utils/authStorage';
import { registerPushToken } from '@/utils/notifications';

// api.ts가 실패한 요청마다 console.error로 [API ✕ ...] 로그를 남기는데(디버깅용, Metro 로그엔
// 계속 남음), 개발 모드에서 화면 하단에 뜨는 LogBox 알림 배너는 거슬리니 꺼둔다.
LogBox.ignoreLogs(['[API ✕ 실패]', '[API ✕ 네트워크 오류]']);

// 이게 없으면 iOS에서 앱이 포그라운드에 떠 있을 때 알림이 예약대로 발생해도 배너/사운드가
// 조용히 무시된다(기본값이 "표시 안 함"). 앱을 켜놓고 확인하는 21시 리마인더 같은 경우 특히 중요.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  // 이미 로그인된 상태로 앱을 재실행한 경우를 위한 등록. 로그인/회원가입 직후는 각 화면에서
  // 바로 registerPushToken을 호출하므로(login.tsx, signup.tsx), 여기선 앱을 새로 켰을 때만
  // 커버하면 된다.
  useEffect(() => {
    getAccessToken().then((token) => {
      if (token) registerPushToken(token);
    });
  }, []);
  // 스탬프 획득 알림(locationTracking.ts의 STAMP_NOTIFICATION_DATA)을 탭하면 마이페이지의
  // 스탬프 앨범으로 이동한다. 홈 화면 스탬프 미리보기를 눌렀을 때와 같은 쿼리 파라미터를 써서
  // (app/(tabs)/mypage.tsx의 openStampGallery 처리 로직 재사용) 바로 열어준다.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'stamp') {
        router.push('/(tabs)/mypage?openStampGallery=1');
      }
    });
    return () => sub.remove();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="signup-complete" />
        <Stack.Screen name="terms-detail" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <AppAlertHost />
    </GestureHandlerRootView>
  );
}
