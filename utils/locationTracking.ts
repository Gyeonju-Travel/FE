import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Schedule } from '@/types/schedule';
import { haversineMeters } from '@/utils/distance';
import { calculateFootprintCount } from '@/utils/footprintCalculator';
import { GEOFENCE_ATTRACTIONS, PERFECT_TRIP_STAMP_INDEX, awardStamp, getEarnedStampIndices } from '@/constants/stamps';
import { getAccessToken } from '@/utils/authStorage';
import { addScheduleFootprints, visitPlace, startSchedule } from '@/utils/api';

// 백그라운드 위치 추적을 "하나만" 돌린다. 지오펜싱(점 반경 감지)과 거리 누적(발자국)을
// 따로 돌리면 백그라운드 위치 구독이 2개가 되어 배터리를 더 쓰게 되므로, 같은 위치
// 업데이트 콜백 안에서 (1) 걸은 거리 누적 → 발자국, (2) 관광지 6곳 근접 체크 → 스탬프,
// (3) 진행 중인 일정 장소 근접 체크 → 도착 표시 + 일정 완주 시 "완벽한여행" 스탬프까지
// 한 번에 처리한다.
export const LOCATION_TRACKING_TASK_NAME = 'gyeonjutravel-location-tracking';

const ARRIVAL_RADIUS_METERS = 40;
const MIN_DISTANCE_INTERVAL_METERS = 15; // 이 정도 움직였을 때만 위치 업데이트를 받는다.
// GPS가 순간적으로 튀는 경우(실내→실외 전환 등) 실제로 걷지 않은 거리가 잘못 누적되는 걸
// 막기 위해, 한 번에 이보다 크게 뛴 구간은 거리 누적에서 제외한다.
const MAX_VALID_JUMP_METERS = 200;

const TOTAL_DISTANCE_KEY = 'gyeonjutravel.totalWalkedMeters';
const LAST_POINT_KEY = 'gyeonjutravel.locationTrackingLastPoint';
const ARRIVED_PLACES_KEY_PREFIX = 'gyeonjutravel.arrivedPlaces.';
const ACTIVE_SCHEDULE_KEY = 'gyeonjutravel.activeScheduleId';
const ACTIVE_SCHEDULE_STATE_KEY = 'gyeonjutravel.activeScheduleState';
const TODAYS_SCRAP_SCHEDULE_KEY = 'gyeonjutravel.todaysScrapSchedule';
const SCRAPPED_SCHEDULE_IDS_KEY = 'gyeonjutravel.scrappedScheduleIds';
const SCRAP_REMINDER_HOUR = 21;

interface LatLng {
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

async function notify(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body, sound: true }, trigger: null });
  } catch {
    // 알림 실패는 무시 — 기록/지급 자체는 이미 저장됐으므로 문제 없다.
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

/** 오늘 21시에 "일정 종료? 스크랩으로 기록해보세요" 알림을 예약한다. 이미 21시가 지났으면 예약하지 않는다. */
async function scheduleScrapReminder(): Promise<void> {
  const target = new Date();
  target.setHours(SCRAP_REMINDER_HOUR, 0, 0, 0);
  if (target.getTime() <= Date.now()) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '일정이 종료 됐나요?',
        body: '스크랩으로 오늘 하루를 기록해 보세요',
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: target },
    });
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

/** 오늘 진행할 일정을 등록해서, 위치 추적 중 이 일정의 장소들도 같이 도착 감지하도록 한다. */
export async function setActiveSchedule(schedule: Schedule): Promise<StartTrackingResult> {
  const granted = await ensureLocationPermissions();
  if (!granted) return 'permission-denied';
  await ensureNotificationPermission();

  // 서버에 일정 시작을 알린다 — 이걸 먼저 호출해야 이후의 발자국/관광지 방문 기록(POST .../footprints,
  // .../visits)이 서버에서 거부되지 않는다(서버가 startedAt 이후 기록만 인정).
  // 날짜별 목록 조회(toSchedule)로 만든 schedule.places는 좌표가 없는 자리표시자라서, 여기서
  // 받는 실제 좌표(placeId 포함)를 지오펜싱/스크랩 지도의 진짜 소스로 쓴다.
  const token = await getAccessToken();
  let schedulePlaces: ActiveSchedulePlace[] = schedule.places.map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.latitude,
    lng: p.longitude,
  }));
  if (token) {
    try {
      const startResult = await startSchedule(Number(schedule.id), token);
      schedulePlaces = startResult.places.map((p) => ({
        id: String(p.placeId),
        name: p.name,
        lat: p.latitude,
        lng: p.longitude,
      }));
    } catch {
      // 실패하면 좌표 없는 자리표시자로 폴백 — 이후 개별 발자국/방문 기록 호출도 서버에서 거부될 수 있다.
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
  const scrapState: TodaysScrapSchedule = { scheduleId: schedule.id, date: todayIsoDate(), places: schedulePlaces };
  await AsyncStorage.setItem(TODAYS_SCRAP_SCHEDULE_KEY, JSON.stringify(scrapState));
  await scheduleScrapReminder();

  // 이미 일정을 다 돌았는데 지금 막 활성화한 경우("완벽한여행"을 놓쳤을 수 있어) 바로 지급 시도.
  if (pendingPlaces.length === 0 && schedulePlaces.length > 0 && arrivedIds.length >= schedulePlaces.length) {
    const awarded = await awardStamp(PERFECT_TRIP_STAMP_INDEX);
    if (awarded) await notify('완벽한 여행! 🎉', '오늘 일정을 모두 완주했어요.');
  }

  await startLocationTracking();
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

    for (const loc of locations) {
      const point: LatLng = { lat: loc.coords.latitude, lng: loc.coords.longitude };

      // (1) 거리 누적 → 발자국 (일정이 진행 중이면 그 일정의 앨범에도 증가분을 동기화)
      if (lastPoint) {
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
      lastPoint = point;

      // (2) 관광지 6곳 근접 체크 → 스탬프 지급 (+ 6개 다 모으면 constants/stamps.ts에서 "경주마스터" 자동 지급)
      for (const attraction of GEOFENCE_ATTRACTIONS) {
        if (earnedStampIndices.has(attraction.stampIndex)) continue;
        const dist = haversineMeters(point.lat, point.lng, attraction.latitude, attraction.longitude);
        if (dist <= ARRIVAL_RADIUS_METERS) {
          const awarded = await awardStamp(attraction.stampIndex);
          if (awarded) {
            earnedStampIndices.add(attraction.stampIndex);
            await notify('도착했어요! 🐾', `${attraction.name}에서 새로운 스탬프를 획득했어요.`);
          }
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
          if (awarded) await notify('완벽한 여행! 🎉', '오늘 일정을 모두 완주했어요.');
        }
      }
    }

    await AsyncStorage.setItem(TOTAL_DISTANCE_KEY, String(total));
    await AsyncStorage.setItem(LAST_POINT_KEY, JSON.stringify(lastPoint));
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
}

export async function isLocationTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
}
