import { clearTokens } from '@/utils/authStorage';
import { clearLocalStampData } from '@/constants/stamps';
import { clearLocalTrackingData } from '@/utils/locationTracking';
import { clearRecentSearches } from '@/utils/recentSearches';
import { clearLocalPushPreference } from '@/utils/notifications';

/** 로그아웃/회원탈퇴/회원가입 시 호출한다. 인증 토큰뿐 아니라, 계정과 무관하게 기기에 남아
 * 다음 로그인(다른 계정, 재가입 등)에 이전 계정의 상태가 그대로 섞여 보이게 하는 로컬 캐시
 * (스탬프, 진행 중이던 일정, 최근 검색어, 알림 설정)도 전부 정리한다. */
export async function clearAccountLocalData(): Promise<void> {
  await clearTokens();
  await Promise.all([
    clearLocalStampData(),
    clearLocalTrackingData(),
    clearRecentSearches(),
    clearLocalPushPreference(),
  ]);
}
