import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// locationTracking.ts와 constants/stamps.ts 둘 다 알림을 보내야 해서(스탬프는 stamps.ts가
// 완주 판정을 하고, 위치 추적은 locationTracking.ts가 처리) 순환 참조 없이 공유할 수 있게
// 이 둘의 공통 하위 모듈로 분리했다.

const PUSH_ENABLED_KEY = 'gyeonjutravel.pushEnabled';

/** 기본값 true(안 정해진 상태 = 켜짐)로 취급한다. */
export async function isPushEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PUSH_ENABLED_KEY);
  return raw !== 'false';
}

/** 토글 값을 저장하고, 껐을 때는 이미 예약된 알림(21시 스크랩 알림 등)도 즉시 취소한다. */
export async function setPushEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PUSH_ENABLED_KEY, String(enabled));
  if (!enabled) {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // 취소 실패는 무시 — 설정값은 이미 저장됐으므로 이후 알림부턴 안 나간다.
    }
  }
}

export async function notify(title: string, body: string, data?: Record<string, unknown>) {
  if (!(await isPushEnabled())) return;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body, sound: true, data }, trigger: null });
  } catch {
    // 알림 실패는 무시 — 기록/지급 자체는 이미 저장됐으므로 문제 없다.
  }
}

/** 스탬프 알림에 붙이는 데이터 — 알림을 탭했을 때 마이페이지 스탬프 앨범으로 보내는 데 쓴다
 * (app/_layout.tsx의 알림 응답 리스너 참고). */
export const STAMP_NOTIFICATION_DATA = { type: 'stamp' };

const TRACKING_NOTIFICATION_ID_KEY = 'gyeonjutravel.trackingNotificationId';

/** 일정 진행 중(=위치 추적 중)임을 알림센터에 계속 남겨서 알려준다. 안드로이드는 위치 추적을
 * 위한 foreground service 알림이 이미 따로 떠 있으니(startLocationTracking 참고), 이건 그런
 * 개념이 없는 iOS를 위한 것 — 알림을 하나 띄워두고, 사용자가 직접 지우거나 일정이 끝날 때까지
 * 알림센터에 남아있게 한다. 이미 떠 있으면 중복으로 또 띄우지 않는다. */
export async function showTrackingNotification(): Promise<void> {
  if (!(await isPushEnabled())) return;
  const existing = await AsyncStorage.getItem(TRACKING_NOTIFICATION_ID_KEY);
  if (existing) return;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '견주여행이 일정을 추적하고 있어요',
        body: '위치를 계속 확인해서 도착과 스탬프를 자동으로 기록해요.',
        sound: false,
      },
      trigger: null,
    });
    await AsyncStorage.setItem(TRACKING_NOTIFICATION_ID_KEY, id);
  } catch {
    // 알림 표시 실패는 무시 — 추적 자체는 계속 진행된다.
  }
}

/** 위치 추적이 끝났을 때(일정 취소 등) 추적 중 알림을 지운다. */
export async function dismissTrackingNotification(): Promise<void> {
  const id = await AsyncStorage.getItem(TRACKING_NOTIFICATION_ID_KEY);
  if (!id) return;
  await AsyncStorage.removeItem(TRACKING_NOTIFICATION_ID_KEY);
  try {
    await Notifications.dismissNotificationAsync(id);
  } catch {
    // 사용자가 이미 지웠거나 실패해도 무시
  }
}
