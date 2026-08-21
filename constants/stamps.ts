import type { FC } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyPageStamps } from '@/utils/api';
import { getAccessToken } from '@/utils/authStorage';
import { notify, STAMP_NOTIFICATION_DATA } from '@/utils/notifications';
import Stamp01Welcome from '@/assets/mypage/stamps/stamp-01-welcome.svg';
import Stamp02Gyochon from '@/assets/mypage/stamps/stamp-02-gyochon.svg';
import Stamp03Hwangridan from '@/assets/mypage/stamps/stamp-03-hwangridan.svg';
import Stamp04Gyerim from '@/assets/mypage/stamps/stamp-04-gyerim.svg';
import Stamp05Woljeonggyo from '@/assets/mypage/stamps/stamp-05-woljeonggyo.svg';
import Stamp06Eupseong from '@/assets/mypage/stamps/stamp-06-eupseong.svg';
import Stamp07Cheomseongdae from '@/assets/mypage/stamps/stamp-07-cheomseongdae.svg';
import Stamp08Complete from '@/assets/mypage/stamps/stamp-08-complete.svg';
import Stamp09Master from '@/assets/mypage/stamps/stamp-09-master.svg';
import Stamp10Locked from '@/assets/mypage/stamps/stamp-10-locked.svg';

export type StampIcon = FC<{ width?: number | string; height?: number | string }>;

// 1번(웰컴)은 회원가입 시 지급. 2~7번은 아래 GEOFENCE_ATTRACTIONS에 매핑된 실제 관광지에
// 도착하면 그 자리에서 지급. 8번(완벽한여행)은 하루 일정을 전부 완주하면 지급, 9번(경주마스터)은
// 2~7번(관광지 6개)을 모두 모으면 자동 지급.
export const STAMP_ICONS: StampIcon[] = [
  Stamp01Welcome,
  Stamp02Gyochon,
  Stamp03Hwangridan,
  Stamp04Gyerim,
  Stamp05Woljeonggyo,
  Stamp06Eupseong,
  Stamp07Cheomseongdae,
  Stamp08Complete,
  Stamp09Master,
];
export const STAMP_LOCKED_ICON: StampIcon = Stamp10Locked;
export const TOTAL_STAMP_COUNT = STAMP_ICONS.length;

// STAMP_ICONS와 같은 인덱스 순서. 획득 토스트/알림에 스탬프 이름을 표시할 때 쓴다.
export const STAMP_NAMES: string[] = [
  '웰컴',
  '교촌마을',
  '황리단길',
  '계림',
  '월정교',
  '경주읍성',
  '첨성대',
  '완벽한여행',
  '경주마스터',
];

// STAMP_ICONS의 인덱스(0-based) 기준. 좌표는 실제 배포 서버의 /api/places 검색 결과에서
// 가져왔다 (2026-08-10 기준). 황리단길은 거리 전체라 특정 place 하나로 등록돼 있지 않아서,
// 그 상권을 대표하는 실제 장소(샬로우커피 황리단길점)의 좌표를 대신 사용한다.
export interface GeofenceAttraction {
  stampIndex: number;
  name: string;
  placeId: number | null;
  latitude: number;
  longitude: number;
  /** true면 placeId가 실제 이 관광지의 상세정보가 아니라 좌표만 빌려온 대역(예: 황리단길의
   * 상권 대표 카페)이라는 뜻 — 카드를 눌렀을 때 그 장소 상세로 보내면 안 되고 지도만 이동시켜야 한다. */
  isProxyLocation?: boolean;
}

export const GEOFENCE_ATTRACTIONS: GeofenceAttraction[] = [
  { stampIndex: 1, name: '교촌마을', placeId: 64, latitude: 35.8296308266303, longitude: 129.214693367401 },
  { stampIndex: 2, name: '황리단길', placeId: 39, latitude: 35.83676179, longitude: 129.21001, isProxyLocation: true },
  { stampIndex: 3, name: '계림', placeId: 72, latitude: 35.8326469552, longitude: 129.218997827 },
  { stampIndex: 4, name: '월정교', placeId: 73, latitude: 35.8279335447, longitude: 129.2161732088 },
  { stampIndex: 5, name: '경주읍성', placeId: 81, latitude: 35.8473202021, longitude: 129.2139061887 },
  { stampIndex: 6, name: '첨성대', placeId: 82, latitude: 35.8343745291, longitude: 129.2185644826 },
];

// 장소명을 직접 말하지 않고, 그 장소를 떠올리게 하는 이미지/전설/특징으로만 설명한다.
// GEOFENCE_ATTRACTIONS의 stampIndex와 짝을 맞춘다.
export const STAMP_HINTS: Record<number, string> = {
  1: '기와지붕 아래,\n향긋한 술 익는 냄새가 퍼지는 마을이 있어요.',
  2: '오래된 무덤 옆으로 예쁜 카페와\n소품샵이 줄지어 있는 골목이에요.',
  3: '황금알과 하얀 닭 울음소리,\n신라의 전설이 시작된 숲이에요.',
  4: '밤이 되면 강물 위로 화려한\n불빛이 켜지는 옛 다리예요.',
  5: '경주를 둘러싸고 지키던\n오래된 성벽이 남아있는 곳이에요.',
  6: '밤하늘의 별을 관찰하던\n병 모양의 오래된 탑이에요.',
};

// 백엔드 StampType.displayName → STAMP_ICONS 인덱스. 문구가 프론트 표기와 미묘하게 달라서
// (예: "경주 계림" vs "계림", "완벽한 여행" vs "완벽한여행") 직접 매핑 테이블로 연결한다.
const BACKEND_STAMP_NAME_TO_INDEX: Record<string, number> = {
  환영하개: 0,
  교촌마을: 1,
  황리단길: 2,
  '경주 계림': 3,
  월정교: 4,
  '경주 읍성': 5,
  '경주 첨성대': 6,
  '완벽한 여행': 7,
  '경주 마스터': 8,
};

/** 서버가 내려준 스탬프 이름(StampAlbumResponse.stampName)을 STAMP_ICONS 인덱스로 변환한다. */
export function stampIndexFromBackendName(stampName: string): number | undefined {
  return BACKEND_STAMP_NAME_TO_INDEX[stampName];
}

/** 화면에 보여줄 획득 스탬프 목록. 서버(GET /api/my-page/stamps)를 우선 사용하고,
 * 로그인 전이거나 서버 조회에 실패하면(오프라인 등) 로컬 캐시로 대체한다. */
export async function getDisplayStampIndices(): Promise<Set<number>> {
  const token = await getAccessToken();
  let indices: Set<number>;
  if (token) {
    try {
      const { stamps } = await getMyPageStamps(token);
      indices = new Set<number>();
      for (const stamp of stamps) {
        const index = stampIndexFromBackendName(stamp.stampName);
        if (index !== undefined) indices.add(index);
      }
      // 서버 기준 획득 현황을 로컬 캐시(EARNED_STAMPS_KEY)에도 반영해둔다 — 안 그러면 재설치나
      // 기기 변경으로 로컬 캐시가 비어있을 때, awardStamp()가 이미 획득한 관광지 스탬프를 다시
      // "새로 획득"으로 착각해서 축하 토스트/푸시 알림이 중복으로 뜬다.
      await mergeEarnedStampIndices(indices);
    } catch {
      // 서버 조회 실패 시 로컬 캐시로 대체
      indices = await getEarnedStampIndices();
    }
  } else {
    indices = await getEarnedStampIndices();
  }

  // 관광지 6개(서버 기준)를 다 모았는데 "경주마스터"(로컬 전용 보너스 배지)가 아직 로컬에
  // 없으면 여기서 보정 지급한다. 관광지 스탬프는 서버에서 하나씩 받아오는 반면 6개를 다
  // 모았을 때의 보너스는 로컬에서만 판단하다 보니, 순서·타이밍에 따라(예: 재설치로 로컬
  // 캐시가 초기화된 경우) awardStamp() 안의 완주 체크를 놓칠 수 있다.
  if (NAMED_ATTRACTION_INDICES.every((i) => indices.has(i)) && !indices.has(GYEONGJU_MASTER_STAMP_INDEX)) {
    // 여기서 걸리는 건 항상 "예전에 이미 달성했는데 로컬 캐시만 없던" 경우다(방금 6번째 관광지를
    // 막 찍은 경우엔 그 자리에서 awardStamp()가 이미 축하 처리를 끝냈으므로 여기 도달하지 않는다).
    // 그래서 조용히(토스트/푸시 알림 없이)만 지급한다 — 안 그러면 로컬 캐시가 비워질 때마다
    // (재설치, 개발 중 재빌드 등) "경주 마스터 획득" 축하가 매번 다시 뜬다.
    await awardStamp(GYEONGJU_MASTER_STAMP_INDEX, false);
    indices.add(GYEONGJU_MASTER_STAMP_INDEX);
  }
  return indices;
}

// 8번(완벽한여행, index 7)은 하루 일정을 전부 완주했을 때 지급 — locationTracking.ts가
// 일정 장소를 다 돌았는지 확인하고 awardStamp(PERFECT_TRIP_STAMP_INDEX)를 직접 호출한다.
export const PERFECT_TRIP_STAMP_INDEX = 7;
// 9번(경주마스터, index 8)은 관광지 스탬프 6개(index 1~6)를 전부 모으면 이 파일에서 자동 지급한다.
const GYEONGJU_MASTER_STAMP_INDEX = 8;
const NAMED_ATTRACTION_INDICES = GEOFENCE_ATTRACTIONS.map((a) => a.stampIndex);

const EARNED_STAMPS_KEY = 'gyeonjutravel.earnedStampIndices';
const PENDING_STAMP_TOASTS_KEY = 'gyeonjutravel.pendingStampToasts';

// TODO: 실제 획득 현황을 백엔드에서 내려주는 API가 생기면 이 로컬 저장 값을 대체한다.
export async function getEarnedStampIndices(): Promise<Set<number>> {
  const indices = new Set<number>([0]); // 1번(웰컴)은 항상 획득한 상태
  const raw = await AsyncStorage.getItem(EARNED_STAMPS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((n) => {
          if (typeof n === 'number' && n >= 0 && n < TOTAL_STAMP_COUNT) indices.add(n);
        });
      }
    } catch {
      // 저장된 값이 손상됐으면 웰컴 스탬프만 있는 기본 상태로 취급한다.
    }
  }
  return indices;
}

export async function getEarnedStampCount(): Promise<number> {
  const indices = await getEarnedStampIndices();
  return indices.size;
}

/** 서버 기준 획득 스탬프를 로컬 캐시에 합쳐 넣는다(이미 있는 건 건드리지 않음, 축하 알림도 안 띄움).
 * awardStamp()의 "이미 획득" 판단이 로컬 캐시만 보기 때문에, 재설치/기기변경으로 로컬이 비어있는
 * 상태에서 이미 서버에 기록된 관광지를 다시 방문했을 때 중복 축하 알림이 뜨는 걸 막기 위함. */
async function mergeEarnedStampIndices(serverIndices: Set<number>): Promise<void> {
  const local = await getEarnedStampIndices();
  let changed = false;
  for (const index of serverIndices) {
    if (!local.has(index)) {
      local.add(index);
      changed = true;
    }
  }
  if (changed) {
    await AsyncStorage.setItem(EARNED_STAMPS_KEY, JSON.stringify([...local]));
  }
}

async function getLocalEarnedOrder(): Promise<number[]> {
  const raw = await AsyncStorage.getItem(EARNED_STAMPS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

/** 홈 화면 미리보기용: 최근 획득한 스탬프를 최신순으로 최대 count개 반환한다.
 * 서버는 획득 순서를 안 줘서, 로컬에 기록된 획득 순서(웰컴이 항상 가장 먼저)를 기준으로 삼는다.
 * 로컬 기록에 없는(다른 기기 등에서 획득된) 스탬프는 오래된 것으로 간주해 뒤에 붙인다. */
export async function getRecentStampIndices(count: number): Promise<number[]> {
  const earned = await getDisplayStampIndices();
  const localOrder = await getLocalEarnedOrder();
  const chronological = [0, ...localOrder.filter((i) => i !== 0)];
  const known = chronological.filter((i) => earned.has(i));
  const unknown = [...earned].filter((i) => !chronological.includes(i));
  const oldestFirst = [...known, ...unknown];
  return oldestFirst.slice(-count).reverse();
}

async function pushPendingStampToast(stampIndex: number): Promise<void> {
  const raw = await AsyncStorage.getItem(PENDING_STAMP_TOASTS_KEY);
  const list: number[] = raw ? JSON.parse(raw) : [];
  list.push(stampIndex);
  await AsyncStorage.setItem(PENDING_STAMP_TOASTS_KEY, JSON.stringify(list));
}

/** 대기 중인 스탬프 획득 토스트를 하나 꺼내온다(먼저 지급된 것부터). 없으면 null.
 * 홈 화면이 포커스될 때마다 호출해서, 백그라운드에서 지급된 스탬프도 앱 내 토스트로 보여준다. */
export async function popPendingStampToast(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(PENDING_STAMP_TOASTS_KEY);
  if (!raw) return null;
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return null;
    const [first, ...rest] = list;
    await AsyncStorage.setItem(PENDING_STAMP_TOASTS_KEY, JSON.stringify(rest));
    return typeof first === 'number' ? first : null;
  } catch {
    return null;
  }
}

// awardStamp()는 홈/마이페이지 등 여러 화면에서 거의 동시에 호출될 수 있는데(예: 관광지 6개를
// 막 다 모은 시점에 두 화면이 동시에 포커스), 내부에서 "이미 획득했나?"를 AsyncStorage 읽기로
// 판단하다 보니 두 호출이 서로의 쓰기 완료 전에 동시에 읽으면 둘 다 "아직 없음"으로 착각해서
// 축하 토스트/푸시 알림이 중복으로 나간다. 호출을 한 줄로 직렬화해서 막는다.
let awardStampQueue: Promise<unknown> = Promise.resolve();

/** 특정 번호의 스탬프를 지급한다 (지오펜싱 도착 시 사용). 새로 지급됐으면 true.
 * notify=false면 축하 토스트/푸시 알림 없이 조용히 저장만 한다 — getDisplayStampIndices()의
 * "보정" 지급처럼 실제로는 예전에 이미 달성한 걸 로컬 캐시에 뒤늦게 반영하는 경우에 쓴다. */
export function awardStamp(stampIndex: number, shouldNotify: boolean = true): Promise<boolean> {
  const run = awardStampQueue.then(() => awardStampLocked(stampIndex, shouldNotify));
  awardStampQueue = run.catch(() => {});
  return run;
}

async function awardStampLocked(stampIndex: number, shouldNotify: boolean): Promise<boolean> {
  if (stampIndex <= 0 || stampIndex >= TOTAL_STAMP_COUNT) return false;
  const indices = await getEarnedStampIndices();
  if (indices.has(stampIndex)) return false;

  indices.add(stampIndex);
  const newlyEarned = [stampIndex];
  if (!indices.has(GYEONGJU_MASTER_STAMP_INDEX) && NAMED_ATTRACTION_INDICES.every((i) => indices.has(i))) {
    indices.add(GYEONGJU_MASTER_STAMP_INDEX);
    newlyEarned.push(GYEONGJU_MASTER_STAMP_INDEX);
    // 관광지 스탬프 알림엔 그 관광지 이름이 붙어서 따로 나가지만, 이걸로 완성되는 "경주마스터"
    // 보너스는 어느 호출 경로로 지급되든(관광지 알림, getDisplayStampIndices 보정 등) 여기
    // 한 곳에서만 판단되므로, 푸시 알림도 여기서 직접 보낸다.
    if (shouldNotify) {
      await notify('경주 마스터! 🏆', '관광지 스탬프 6개를 모두 모았어요!', STAMP_NOTIFICATION_DATA);
    }
  }
  await AsyncStorage.setItem(EARNED_STAMPS_KEY, JSON.stringify([...indices]));
  if (shouldNotify) {
    for (const idx of newlyEarned) await pushPendingStampToast(idx);
  }
  return true;
}
