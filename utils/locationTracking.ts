import { DeviceEventEmitter } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Schedule } from '@/types/schedule';
import { haversineMeters } from '@/utils/distance';
import { calculateFootprintCount } from '@/utils/footprintCalculator';
import {
  GEOFENCE_ATTRACTIONS,
  GeofenceAttraction,
  PERFECT_TRIP_STAMP_INDEX,
  awardStamp,
  getEarnedStampIndices,
} from '@/constants/stamps';
import { getAccessToken } from '@/utils/authStorage';
import { addScheduleFootprints, visitPlace, startSchedule, cancelStartSchedule } from '@/utils/api';
import {
  isPushEnabled,
  notify,
  STAMP_NOTIFICATION_DATA,
  showTrackingNotification,
  dismissTrackingNotification,
} from '@/utils/notifications';
export { isPushEnabled, setPushEnabled } from '@/utils/notifications';

// 백그라운드 위치 추적을 "하나만" 돌린다. 지오펜싱(점 반경 감지)과 거리 누적(발자국)을
// 따로 돌리면 백그라운드 위치 구독이 2개가 되어 배터리를 더 쓰게 되므로, 같은 위치
// 업데이트 콜백 안에서 (1) 걸은 거리 누적 → 발자국, (2) 관광지 6곳 근접 체크 → 스탬프,
// (3) 진행 중인 일정 장소 근접 체크 → 도착 표시 + 일정 완주 시 "완벽한여행" 스탬프,
// (4) 경주 경계 이탈 감지 → 자동 종료 + 알림까지 한 번에 처리한다.
export const LOCATION_TRACKING_TASK_NAME = 'gyeonjutravel-location-tracking';

const ARRIVAL_RADIUS_METERS = 40;
const MIN_DISTANCE_INTERVAL_METERS = 15; // 이 정도 움직였을 때만 위치 업데이트를 받는다.
// GPS가 순간적으로 튀는 경우(실내→실외 전환 등) 실제로 걷지 않은 거리가 잘못 누적되는 걸
// 막기 위해, 한 번에 이보다 크게 뛴 구간은 거리 누적에서 제외한다.
const MAX_VALID_JUMP_METERS = 200;

// 경주 시내 4개 경계점(황성대교삼거리·나정교·구황교네거리·배반네거리) 기준 사각 경계.
// 백엔드 GeoUtil.isCountable과 동일한 기준을 프론트에서도 써서, 발자국 카운팅 여부가
// 서버와 어긋나지 않게 맞춘다.
const GYEONGJU_MIN_LAT = 35.814789521055616;
const GYEONGJU_MAX_LAT = 35.8591577928764;
const GYEONGJU_MIN_LNG = 129.20040794404179;
const GYEONGJU_MAX_LNG = 129.236496164066;

function isWithinGyeongju(point: LatLng): boolean {
  return (
    point.lat > GYEONGJU_MIN_LAT &&
    point.lat < GYEONGJU_MAX_LAT &&
    point.lng > GYEONGJU_MIN_LNG &&
    point.lng < GYEONGJU_MAX_LNG
  );
}

const TOTAL_DISTANCE_KEY = 'gyeonjutravel.totalWalkedMeters';
const LAST_POINT_KEY = 'gyeonjutravel.locationTrackingLastPoint';
const OUTSIDE_GYEONGJU_STREAK_KEY = 'gyeonjutravel.outsideGyeongjuStreak';
// 경계선 부근에서 GPS가 잠깐 흔들리다 들어왔다 나갔다 하는 것만으로 일정이 끊기지 않도록,
// 연속으로 이 횟수만큼 경주 밖으로 감지돼야 실제 이탈로 확정해서 자동 종료한다.
const OUTSIDE_GYEONGJU_STREAK_THRESHOLD = 2;
const ARRIVED_PLACES_KEY_PREFIX = 'gyeonjutravel.arrivedPlaces.';
const BREADCRUMB_KEY_PREFIX = 'gyeonjutravel.breadcrumb.';
// 하루짜리 일정 기준으로 넉넉한 상한 — 무한정 커지는 것만 막는다(15m 간격이면 45km 분량).
const MAX_BREADCRUMB_POINTS = 3000;
const ACTIVE_SCHEDULE_KEY = 'gyeonjutravel.activeScheduleId';
const ACTIVE_SCHEDULE_STATE_KEY = 'gyeonjutravel.activeScheduleState';
const TODAYS_SCRAP_SCHEDULE_KEY = 'gyeonjutravel.todaysScrapSchedule';
const SCRAPPED_SCHEDULE_IDS_KEY = 'gyeonjutravel.scrappedScheduleIds';
const AUTO_ENDED_SCHEDULE_KEY = 'gyeonjutravel.autoEndedSchedule';
const SCRAP_REMINDER_ID_KEY = 'gyeonjutravel.scrapReminderNotificationId';
export const SCRAP_REMINDER_HOUR = 21;

// 백그라운드 위치 추적 태스크가 일정을 자동으로 취소/종료시켰을 때 쏘는 이벤트. 그 태스크는
// 화면(React 컴포넌트) 밖에서 돌기 때문에, 일정 화면이 계속 켜져 있어도(다른 화면에 갔다
// 안 와도) activeScheduleId 등 화면 상태가 저절로 안 바뀐다 — 화면에서 이 이벤트를 구독해서
// getActiveScheduleId() 등을 다시 읽어야 "여행중" 표시가 바로 "시작"으로 되돌아간다.
export const ACTIVE_SCHEDULE_AUTO_ENDED_EVENT = 'gyeonjutravel.activeScheduleAutoEnded';

export interface LatLng {
  lat: number;
  lng: number;
}

interface ActiveSchedulePlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface ActiveScheduleState {
  totalPlaceCount: number;
  places: ActiveSchedulePlace[]; // 아직 도착 안 한 장소만 (근접 체크 대상)
}

export interface TodaysScrapSchedule {
  scheduleId: string;
  date: string; // YYYY-MM-DD
  places: ActiveSchedulePlace[];
  /** 경로 지도에 출발지 핀을 표시하기 위한 좌표. /start 호출이 실패하면 없을 수 있다. */
  departure?: { name: string; lat: number; lng: number };
}

// ─── 위치 권한 ─────────────────────────────────────────────────────────────────
/** foreground → background 순서로 위치 권한을 요청한다 (iOS는 foreground가 먼저 있어야 "항상 허용" 승격이 가능). */
export async function ensureLocationPermissions(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === 'granted';
}

async function ensureNotificationPermission(): Promise<void> {
  try {
    await Notifications.requestPermissionsAsync();
  } catch {
    // 알림 권한 요청 실패는 무시 — 감지 자체는 알림 없이도 동작한다.
  }
}

/** 관광지 근접(또는 강제 도착 처리) 시 스탬프를 지급한다. 로컬 저장 + 알림뿐 아니라
 * attraction.placeId로 서버 방문 기록(visitPlace)도 같이 남겨야 한다 — 안 그러면 로컬에는
 * "받음"으로 뜨고 축하 알림까지 오는데, 마이페이지 스탬프 앨범(서버 기준)에는 안 뜨는
 * 불일치가 생긴다. isProxyLocation(예: 황리단길 대역 좌표)은 실제 이 관광지의 placeId가
 * 아니므로 방문 기록을 안 남긴다.
 *
 * 서버 방문 기록을 알림보다 먼저 남긴다 — 순서가 반대면, 사용자가 알림을 뜨자마자 눌러
 * 스탬프 앨범(서버 기준)으로 들어갔을 때 visitPlace 네트워크 요청이 아직 안 끝나있어서
 * "알림은 왔는데 앨범엔 한참 있다가 뜨는" 것처럼 보일 수 있다. */
async function awardAttractionStamp(
  attraction: GeofenceAttraction,
  scheduleId: string | null,
  accessToken: string | null
): Promise<boolean> {
  const awarded = await awardStamp(attraction.stampIndex);
  if (!awarded) return false;
  if (accessToken && scheduleId && attraction.placeId != null && !attraction.isProxyLocation) {
    try {
      await visitPlace(
        attraction.placeId,
        { scheduleId: Number(scheduleId), latitude: attraction.latitude, longitude: attraction.longitude },
        accessToken
      );
    } catch {
      // 서버 방문 기록 실패는 무시 — 로컬 지급/알림은 그대로 진행한다.
    }
  }
  await notify('축하해요! 🎉', `${attraction.name} 스탬프를 획득했어요!`, STAMP_NOTIFICATION_DATA);
  return true;
}

/** 하루 일정을 전부 완주했을 때 보내는 알림. "완벽한여행" 스탬프를 이번에 처음 받았으면 그걸
 * 알려주고, 이미 갖고 있던 경우(로컬에 없어서 다시 지급 시도됐지만 실패한 경우 포함)에도 완주
 * 자체는 축하해준다. */
async function notifyPerfectTrip(awarded: boolean) {
  if (awarded) {
    await notify('완벽한 여행! 🎉', '오늘 일정을 모두 완주했어요.', STAMP_NOTIFICATION_DATA);
  } else {
    await notify('완주했어요! 🎉', '오늘도 반려견과 즐거운 하루였길 바라요.');
  }
}

// ─── 거리 누적 (발자국) ─────────────────────────────────────────────────────────
async function getTotalDistanceMeters(): Promise<number> {
  const raw = await AsyncStorage.getItem(TOTAL_DISTANCE_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

async function getLastPoint(): Promise<LatLng | null> {
  const raw = await AsyncStorage.getItem(LAST_POINT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

/** 지금까지 누적된 총 이동거리(m). */
export async function getFootprintTotalDistanceMeters(): Promise<number> {
  return getTotalDistanceMeters();
}

/** 100m당 1개로 환산한 발자국 개수. */
export async function getFootprintCount(): Promise<number> {
  return calculateFootprintCount(await getTotalDistanceMeters());
}

// ─── 일정 장소 도착 표시 (경로보기 화면 체크마크) + 일정 완주 시 "완벽한여행" 스탬프 ──────
function arrivedPlacesKey(scheduleId: string) {
  return `${ARRIVED_PLACES_KEY_PREFIX}${scheduleId}`;
}

export async function getArrivedPlaceIds(scheduleId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(arrivedPlacesKey(scheduleId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** 새로 도착 처리됐으면 true, 이미 도착 기록이 있었으면 false (중복 알림 방지용). */
async function markArrived(scheduleId: string, placeId: string): Promise<boolean> {
  const current = await getArrivedPlaceIds(scheduleId);
  if (current.includes(placeId)) return false;
  await AsyncStorage.setItem(arrivedPlacesKey(scheduleId), JSON.stringify([...current, placeId]));
  return true;
}

async function clearArrivedPlaces(scheduleId: string): Promise<void> {
  await AsyncStorage.removeItem(arrivedPlacesKey(scheduleId));
}

function breadcrumbKey(scheduleId: string) {
  return `${BREADCRUMB_KEY_PREFIX}${scheduleId}`;
}

/** 오늘 기록된 실제 GPS 발자취. 스크랩 화면에서 "계획된 경로" 대신 "실제로 걸은 경로"를
 * 보여주는 데 쓴다 — 없으면(지난 날짜 기록, 아직 추적을 시작 안 한 경우 등) 빈 배열. */
export async function getBreadcrumbPath(scheduleId: string): Promise<LatLng[]> {
  const raw = await AsyncStorage.getItem(breadcrumbKey(scheduleId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendBreadcrumbPoint(scheduleId: string, point: LatLng): Promise<void> {
  const path = await getBreadcrumbPath(scheduleId);
  path.push(point);
  const trimmed = path.length > MAX_BREADCRUMB_POINTS ? path.slice(path.length - MAX_BREADCRUMB_POINTS) : path;
  await AsyncStorage.setItem(breadcrumbKey(scheduleId), JSON.stringify(trimmed));
}

async function clearBreadcrumbPath(scheduleId: string): Promise<void> {
  await AsyncStorage.removeItem(breadcrumbKey(scheduleId));
}

async function getActiveSchedule(): Promise<{ scheduleId: string; state: ActiveScheduleState } | null> {
  const scheduleId = await AsyncStorage.getItem(ACTIVE_SCHEDULE_KEY);
  if (!scheduleId) return null;
  const raw = await AsyncStorage.getItem(ACTIVE_SCHEDULE_STATE_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    return state ? { scheduleId, state } : null;
  } catch {
    return null;
  }
}

async function removePendingPlace(scheduleId: string, placeId: string) {
  const active = await getActiveSchedule();
  if (!active || active.scheduleId !== scheduleId) return;
  const nextPlaces = active.state.places.filter((p) => p.id !== placeId);
  await AsyncStorage.setItem(
    ACTIVE_SCHEDULE_STATE_KEY,
    JSON.stringify({ ...active.state, places: nextPlaces })
  );
}

export type StartTrackingResult = 'started' | 'permission-denied' | 'no-places';

// ─── 일정 종료 스크랩 (오늘 하루 기록) ────────────────────────────────────────────
function todayIsoDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 예약해둔 21시 스크랩 알림이 있으면 취소한다. 일정을 취소했는데도 이미 예약된 알림이 그대로
 * 남아있으면, 오늘 일정이 없는데도 21시에 알림이 울리게 된다. */
async function cancelScrapReminder(): Promise<void> {
  const existingId = await AsyncStorage.getItem(SCRAP_REMINDER_ID_KEY);
  if (!existingId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(existingId);
  } catch {
    // 이미 취소/발송된 알림이면 실패해도 무시
  }
  await AsyncStorage.removeItem(SCRAP_REMINDER_ID_KEY);
}

/** 오늘 21시에 "일정 종료? 스크랩으로 기록해보세요" 알림을 예약한다. 이미 21시가 지났으면 예약하지 않는다.
 * 같은 날 취소 후 재시작을 반복해도 알림이 중복으로 쌓이지 않도록, 이전에 예약해둔 알림이 있으면
 * 먼저 취소하고 새로 예약한다. */
async function scheduleScrapReminder(): Promise<void> {
  await cancelScrapReminder();

  const target = new Date();
  target.setHours(SCRAP_REMINDER_HOUR, 0, 0, 0);
  if (target.getTime() <= Date.now()) return;
  if (!(await isPushEnabled())) return;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '일정이 종료 됐나요?',
        body: '스크랩으로 오늘 하루를 기록해 보세요',
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
    });
    await AsyncStorage.setItem(SCRAP_REMINDER_ID_KEY, id);
  } catch {
    // 알림 예약 실패는 무시 — 앱을 열면 홈 화면에서 자동으로 스크랩 화면을 띄워준다.
  }
}

async function getScrappedScheduleIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(SCRAPPED_SCHEDULE_IDS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** 스크랩 앨범 저장에 성공한 뒤 호출한다 — 같은 일정으로는 다시 스크랩 화면이 자동으로 뜨지 않는다. */
export async function markScheduleScrapped(scheduleId: string): Promise<void> {
  const ids = await getScrappedScheduleIds();
  if (ids.includes(scheduleId)) return;
  await AsyncStorage.setItem(SCRAPPED_SCHEDULE_IDS_KEY, JSON.stringify([...ids, scheduleId]));
}

/** 오늘 '시작'을 눌렀지만 아직 스크랩하지 않은 일정이 있으면 반환한다 (홈 진입 시 스크랩 화면 자동 진입에 사용). */
export async function getPendingScrapSchedule(): Promise<TodaysScrapSchedule | null> {
  const raw = await AsyncStorage.getItem(TODAYS_SCRAP_SCHEDULE_KEY);
  if (!raw) return null;
  try {
    const state: TodaysScrapSchedule = JSON.parse(raw);
    if (state.date !== todayIsoDate()) return null;
    const scrappedIds = await getScrappedScheduleIds();
    if (scrappedIds.includes(state.scheduleId)) return null;
    return state;
  } catch {
    return null;
  }
}

/** 오늘 '시작'했던 특정 일정의 스크랩 정보를 반환한다 (이미 스크랩했어도 반환 — 기록 다시 보기용). */
export async function getTodaysScrapSchedule(scheduleId: string): Promise<TodaysScrapSchedule | null> {
  const raw = await AsyncStorage.getItem(TODAYS_SCRAP_SCHEDULE_KEY);
  if (!raw) return null;
  try {
    const state: TodaysScrapSchedule = JSON.parse(raw);
    if (state.date !== todayIsoDate() || state.scheduleId !== scheduleId) return null;
    return state;
  } catch {
    return null;
  }
}

/** 오늘 진행할 일정을 등록해서, 위치 추적 중 이 일정의 장소들도 같이 도착 감지하도록 한다. */
export async function setActiveSchedule(schedule: Schedule): Promise<StartTrackingResult> {
  const granted = await ensureLocationPermissions();
  if (!granted) return 'permission-denied';
  await ensureNotificationPermission();

  // 서버에 일정 시작을 알린다 — 이걸 먼저 호출해야 이후의 발자국/관광지 방문 기록(POST .../footprints,
  // .../visits)이 서버에서 거부되지 않는다(서버가 startedAt 이후 기록만 인정).
  // schedule.places에도 이미 실제 좌표가 있지만, /start 응답을 우선 소스로 써서 항상 최신 상태를 반영한다.
  const token = await getAccessToken();
  let schedulePlaces: ActiveSchedulePlace[] = schedule.places.map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.latitude,
    lng: p.longitude,
  }));
  let departure: TodaysScrapSchedule['departure'];
  if (token) {
    try {
      const startResult = await startSchedule(Number(schedule.id), token);
      schedulePlaces = startResult.places.map((p) => ({
        id: String(p.placeId),
        name: p.name,
        lat: p.latitude,
        lng: p.longitude,
      }));
      departure = {
        name: startResult.departure.name,
        lat: startResult.departure.latitude,
        lng: startResult.departure.longitude,
      };
    } catch {
      // 실패하면 schedule.places의 좌표로 폴백한다.
    }
  }

  const arrivedIds = await getArrivedPlaceIds(schedule.id);
  const pendingPlaces = schedulePlaces.filter((p) => !arrivedIds.includes(p.id));

  await AsyncStorage.setItem(ACTIVE_SCHEDULE_KEY, schedule.id);
  await AsyncStorage.setItem(
    ACTIVE_SCHEDULE_STATE_KEY,
    JSON.stringify({
      totalPlaceCount: schedulePlaces.length,
      places: pendingPlaces,
    })
  );

  // 오늘 '시작'을 누른 일정을 스크랩 대상으로 별도 저장 (ACTIVE_SCHEDULE_KEY는 추적 종료 시 지워지므로 분리 보관)
  // 하고, 21시 스크랩 알림을 예약한다.
  const scrapState: TodaysScrapSchedule = {
    scheduleId: schedule.id,
    date: todayIsoDate(),
    places: schedulePlaces,
    departure,
  };
  await AsyncStorage.setItem(TODAYS_SCRAP_SCHEDULE_KEY, JSON.stringify(scrapState));
  await scheduleScrapReminder();

  // 이미 일정을 다 돌았는데 지금 막 활성화한 경우("완벽한여행"을 놓쳤을 수 있어) 바로 지급 시도.
  if (pendingPlaces.length === 0 && schedulePlaces.length > 0 && arrivedIds.length >= schedulePlaces.length) {
    const awarded = await awardStamp(PERFECT_TRIP_STAMP_INDEX);
    await notifyPerfectTrip(awarded);
  }

  await startLocationTracking();
  await showTrackingNotification();
  return pendingPlaces.length === 0 ? 'no-places' : 'started';
}

export async function clearActiveSchedule(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_SCHEDULE_KEY);
  await AsyncStorage.removeItem(ACTIVE_SCHEDULE_STATE_KEY);
}

export async function isActiveSchedule(scheduleId: string): Promise<boolean> {
  const activeId = await AsyncStorage.getItem(ACTIVE_SCHEDULE_KEY);
  return activeId === scheduleId;
}

/** 현재 위치 추적 중인 일정의 id (없으면 null). "여행중" 표시 등 UI에서 쓴다. */
export async function getActiveScheduleId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_SCHEDULE_KEY);
}

/** 경주 경계를 연속으로 벗어난 게 확인되면(=여행이 자연스럽게 끝난 것으로 간주) 사용자가
 * 취소한 것과 동일하게 위치 추적을 멈추고 진행 중 상태를 정리한다. 이미 모은 발자국·스탬프·
 * 오늘의 스크랩 대상 정보(TODAYS_SCRAP_SCHEDULE_KEY)는 지우지 않는다 — 21시 자동 종료 때와
 * 마찬가지로 스크랩 화면에서 오늘 하루를 계속 기록할 수 있어야 하기 때문이다. 사용자가 직접
 * 누른 게 아니라 자동으로 끝난 것이므로 별도 알림으로 알려주고, 21시 전이라도 일정 목록에서
 * 바로 "기록보기"로 넘어갈 수 있게 AUTO_ENDED_SCHEDULE_KEY에 기록해둔다.
 *
 * 단, 목적지를 한 곳도 못 가본 채 벗어난 경우(경주 밖에서 실수로 "시작"을 눌렀거나, 도착
 * 전에 미리 눌러둔 경우 등)엔 남길 기록 자체가 없다. 이땐 "종료"로 취급해 기록보기만 뜨는
 * 막다른 상태로 두는 대신, 취소된 것으로 되돌려서 실제로 경주에 도착하면 같은 일정을 바로
 * 다시 시작할 수 있게 한다 — 매번 새 일정을 만들 필요가 없도록. */
async function endActiveScheduleDueToExit(scheduleId: string): Promise<void> {
  await stopLocationTracking();
  DeviceEventEmitter.emit(ACTIVE_SCHEDULE_AUTO_ENDED_EVENT);
  const arrivedIds = await getArrivedPlaceIds(scheduleId);
  if (arrivedIds.length === 0) {
    const token = await getAccessToken();
    if (token) {
      try {
        await cancelStartSchedule(Number(scheduleId), token);
      } catch {
        // 서버 취소 실패는 무시 — 로컬은 이미 취소된 것으로 정리된다.
      }
    }
    // 완전히 취소된 것으로 되돌리는 경로라, cancelActiveSchedule()과 마찬가지로 스크랩 대상과
    // 예약된 21시 알림도 같이 지운다 — 안 그러면 취소했는데도 21시에 알림이 울린다.
    const raw = await AsyncStorage.getItem(TODAYS_SCRAP_SCHEDULE_KEY);
    if (raw) {
      try {
        const state: TodaysScrapSchedule = JSON.parse(raw);
        if (state.scheduleId === scheduleId) {
          await AsyncStorage.removeItem(TODAYS_SCRAP_SCHEDULE_KEY);
          await cancelScrapReminder();
        }
      } catch {
        // 손상된 값이면 그냥 둔다
      }
    }
    await notify(
      '경주 안에서만 일정을 시작할 수 있어요',
      '경주 밖에 있어서 일정이 취소됐어요. 경주에 도착하면 다시 시작해주세요.'
    );
    return;
  }
  await AsyncStorage.setItem(
    AUTO_ENDED_SCHEDULE_KEY,
    JSON.stringify({ scheduleId, date: todayIsoDate() })
  );
  await notify('경주를 벗어나 일정이 자동으로 종료됐어요', '오늘 하루를 스크랩으로 기록해보세요!');
}

/** 경주 이탈 감지로 자동 종료된 일정의 id(오늘 기록이 아니면 null). 일정 목록 화면에서 이
 * 값과 같은 일정이면 21시 전이라도 "기록보기"로 보여주는 데 쓴다. */
export async function getAutoEndedScheduleId(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(AUTO_ENDED_SCHEDULE_KEY);
  if (!raw) return null;
  try {
    const parsed: { scheduleId: string; date: string } = JSON.parse(raw);
    return parsed.date === todayIsoDate() ? parsed.scheduleId : null;
  } catch {
    return null;
  }
}

// ─── 통합 백그라운드 위치 추적 태스크 ───────────────────────────────────────────
if (!TaskManager.isTaskDefined(LOCATION_TRACKING_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TRACKING_TASK_NAME, async ({ data, error }) => {
    if (error) return;
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
    if (locations.length === 0) return;

    let lastPoint = await getLastPoint();
    let total = await getTotalDistanceMeters();
    const earnedStampIndices = await getEarnedStampIndices();
    const active = await getActiveSchedule();
    const scheduleId = active?.scheduleId ?? null;
    const accessToken = await getAccessToken();
    let pendingSchedulePlaces = active?.state.places ?? [];
    const totalPlaceCount = active?.state.totalPlaceCount ?? 0;
    // 일정이 진행 중일 때만 의미가 있는 값이라, 진행 중인 일정이 없으면 0으로 취급해서
    // 이전 일정에서 남은 값이 다음 일정에 영향을 주지 않게 한다.
    let outsideStreak = scheduleId ? Number((await AsyncStorage.getItem(OUTSIDE_GYEONGJU_STREAK_KEY)) ?? '0') || 0 : 0;

    for (const loc of locations) {
      const point: LatLng = { lat: loc.coords.latitude, lng: loc.coords.longitude };

      // (1) 거리 누적 → 발자국 (일정이 진행 중이면 그 일정의 앨범에도 증가분을 동기화)
      // 경주를 벗어난 구간(예: 집에 돌아가는 길)은 발자국으로 안 쳐준다.
      const withinGyeongju = isWithinGyeongju(point);
      if (lastPoint && withinGyeongju) {
        const segment = haversineMeters(lastPoint.lat, lastPoint.lng, point.lat, point.lng);
        if (segment > 0 && segment < MAX_VALID_JUMP_METERS) {
          total += segment;
          if (scheduleId && accessToken) {
            const meters = Math.round(segment);
            if (meters > 0) {
              try {
                await addScheduleFootprints(Number(scheduleId), meters, accessToken);
              } catch {
                // 서버 동기화 실패는 무시 — 로컬 누적치(total)는 이미 반영됐다.
              }
            }
          }
        }
      }
      // 계획한 장소가 아닌 곳에 들렀어도 스크랩 화면에 실제 경로로 보여주기 위한 발자취 기록.
      if (scheduleId && withinGyeongju) await appendBreadcrumbPoint(scheduleId, point);
      lastPoint = point;

      // (4) 경주 경계 이탈 감지 → 연속 OUTSIDE_GYEONGJU_STREAK_THRESHOLD회 확인되면 자동 종료.
      if (scheduleId) {
        outsideStreak = withinGyeongju ? 0 : outsideStreak + 1;
        if (outsideStreak >= OUTSIDE_GYEONGJU_STREAK_THRESHOLD) {
          await AsyncStorage.setItem(TOTAL_DISTANCE_KEY, String(total));
          await AsyncStorage.setItem(LAST_POINT_KEY, JSON.stringify(lastPoint));
          await AsyncStorage.removeItem(OUTSIDE_GYEONGJU_STREAK_KEY);
          await endActiveScheduleDueToExit(scheduleId);
          return;
        }
      }

      // (2) 관광지 6곳 근접 체크 → 스탬프 지급 (+ 6개 다 모으면 constants/stamps.ts에서 "경주마스터" 자동 지급)
      for (const attraction of GEOFENCE_ATTRACTIONS) {
        if (earnedStampIndices.has(attraction.stampIndex)) continue;
        const dist = haversineMeters(point.lat, point.lng, attraction.latitude, attraction.longitude);
        if (dist <= ARRIVAL_RADIUS_METERS) {
          const awarded = await awardAttractionStamp(attraction, scheduleId, accessToken);
          if (awarded) earnedStampIndices.add(attraction.stampIndex);
        }
      }

      // (3) 진행 중인 일정 장소 근접 체크 → 도착 표시. 일정을 전부 돌았으면 "완벽한여행" 지급.
      if (scheduleId && pendingSchedulePlaces.length > 0) {
        const stillPending: ActiveSchedulePlace[] = [];
        for (const place of pendingSchedulePlaces) {
          const dist = haversineMeters(point.lat, point.lng, place.lat, place.lng);
          if (dist <= ARRIVAL_RADIUS_METERS) {
            const isNew = await markArrived(scheduleId, place.id);
            if (isNew) {
              await notify('도착했어요! 🐾', `${place.name}에 도착했어요.`);
              await removePendingPlace(scheduleId, place.id);
              if (accessToken) {
                try {
                  await visitPlace(
                    Number(place.id),
                    { scheduleId: Number(scheduleId), latitude: point.lat, longitude: point.lng },
                    accessToken
                  );
                } catch {
                  // 방문 기록 서버 저장 실패는 무시 — 로컬 도착 표시(체크마크)는 이미 반영됐다.
                }
              }
            }
          } else {
            stillPending.push(place);
          }
        }
        pendingSchedulePlaces = stillPending;

        if (pendingSchedulePlaces.length === 0 && totalPlaceCount > 0) {
          const awarded = await awardStamp(PERFECT_TRIP_STAMP_INDEX);
          await notifyPerfectTrip(awarded);
        }
      }
    }

    await AsyncStorage.setItem(TOTAL_DISTANCE_KEY, String(total));
    await AsyncStorage.setItem(LAST_POINT_KEY, JSON.stringify(lastPoint));
    if (scheduleId) {
      await AsyncStorage.setItem(OUTSIDE_GYEONGJU_STREAK_KEY, String(outsideStreak));
    }
  });
}

/** 백그라운드 위치 추적을 시작한다 (발자국 누적 + 관광지 스탬프 + 일정 도착 감지 전부 포함). 이미 켜져 있으면 그대로 둔다. */
export async function startLocationTracking(): Promise<boolean> {
  const granted = await ensureLocationPermissions();
  if (!granted) return false;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
  if (alreadyStarted) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: MIN_DISTANCE_INTERVAL_METERS,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.Fitness,
    foregroundService: {
      notificationTitle: '견주여행이 산책을 기록하고 있어요',
      notificationBody: '이동 거리와 관광지 도착을 계속 확인하고 있어요.',
      notificationColor: '#E8906A',
    },
  });
  return true;
}

export async function stopLocationTracking(): Promise<void> {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
  }
  await clearActiveSchedule();
  await dismissTrackingNotification();
}

export async function isLocationTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
}

/** 로그아웃/회원탈퇴 시 호출한다. 진행 중인 일정 추적 상태, 발자국 거리, 스크랩 대상 등은
 * 계정이 아니라 기기 기준으로 저장되기 때문에, 안 지우면 같은 기기에서 재가입하거나 다른
 * 계정으로 로그인했을 때 이전 계정의 진행 상태가 그대로 섞여 보인다. */
export async function clearLocalTrackingData(): Promise<void> {
  await stopLocationTracking(); // 백그라운드 추적 중지 + ACTIVE_SCHEDULE_KEY/STATE 정리 + 추적 알림 제거
  await cancelScrapReminder(); // 예약된 21시 알림 취소
  await AsyncStorage.multiRemove([
    TOTAL_DISTANCE_KEY,
    LAST_POINT_KEY,
    OUTSIDE_GYEONGJU_STREAK_KEY,
    TODAYS_SCRAP_SCHEDULE_KEY,
    SCRAPPED_SCHEDULE_IDS_KEY,
    AUTO_ENDED_SCHEDULE_KEY,
  ]);
}

/** "여행중"인 일정을 잘못 시작했을 때 되돌리는 용도 — 위치 추적을 끄고 활성 일정을 해제한다.
 * 오늘의 스크랩 대상으로도 등록돼 있었다면(21시 알림 대상) 그것도 같이 지운다. */
export async function cancelActiveSchedule(scheduleId: string): Promise<boolean> {
  const isActive = await isActiveSchedule(scheduleId);
  if (!isActive) return false;

  await stopLocationTracking();
  // 취소 후 같은 일정을 다시 시작할 수도 있으니, 이번 시도의 발자취와 도착(장소별 체크마크)
  // 기록도 여기서 지워서 다음 시도가 "이미 다 갔다 왔다"는 상태로 시작하지 않게 한다.
  await clearBreadcrumbPath(scheduleId);
  await clearArrivedPlaces(scheduleId);

  // 서버에도 취소를 알려서 started 상태를 되돌린다. 이걸 안 하면 서버는 계속 "시작됨"으로
  // 보고 있어서, 날짜가 지나거나 21시가 지나면 아무 기록도 없는데 "기록보기"로 고정되고
  // 21시 알림 대상에서도 계속 잡힌다.
  const token = await getAccessToken();
  if (token) {
    try {
      await cancelStartSchedule(Number(scheduleId), token);
    } catch {
      // 서버 취소 실패는 무시 — 로컬은 이미 취소된 것으로 정리된다.
    }
  }

  const raw = await AsyncStorage.getItem(TODAYS_SCRAP_SCHEDULE_KEY);
  if (raw) {
    try {
      const state: TodaysScrapSchedule = JSON.parse(raw);
      if (state.scheduleId === scheduleId) {
        await AsyncStorage.removeItem(TODAYS_SCRAP_SCHEDULE_KEY);
        await cancelScrapReminder();
      }
    } catch {
      // 손상된 값이면 그냥 둔다
    }
  }
  return true;
}
