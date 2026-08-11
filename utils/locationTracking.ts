import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Schedule } from '@/types/schedule';
import { haversineMeters } from '@/utils/distance';
import { calculateFootprintCount } from '@/utils/footprintCalculator';
import { GEOFENCE_ATTRACTIONS, awardStamp, getEarnedStampIndices } from '@/constants/stamps';

// 백그라운드 위치 추적을 "하나만" 돌린다. 지오펜싱(점 반경 감지)과 거리 누적(발자국)을
// 따로 돌리면 백그라운드 위치 구독이 2개가 되어 배터리를 더 쓰게 되므로, 같은 위치
// 업데이트 콜백 안에서 (1) 걸은 거리 누적 → 발자국, (2) 관광지 6곳 근접 체크 → 스탬프,
// (3) 진행 중인 일정 장소 근접 체크 → 도착 표시까지 한 번에 처리한다.
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
const ACTIVE_SCHEDULE_PLACES_KEY = 'gyeonjutravel.activeSchedulePlaces';

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

// ─── 일정 장소 도착 표시 (경로보기 화면 체크마크 전용, 스탬프 지급과는 무관) ────────────
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

async function getActiveSchedule(): Promise<{ scheduleId: string; places: ActiveSchedulePlace[] } | null> {
  const scheduleId = await AsyncStorage.getItem(ACTIVE_SCHEDULE_KEY);
  if (!scheduleId) return null;
  const raw = await AsyncStorage.getItem(ACTIVE_SCHEDULE_PLACES_KEY);
  if (!raw) return null;
  try {
    const places = JSON.parse(raw);
    return Array.isArray(places) ? { scheduleId, places } : null;
  } catch {
    return null;
  }
}

/** 오늘 진행할 일정을 등록해서, 위치 추적 중 이 일정의 장소들도 같이 도착 감지하도록 한다. */
export type StartTrackingResult = 'started' | 'permission-denied' | 'no-places';

export async function setActiveSchedule(schedule: Schedule): Promise<StartTrackingResult> {
  const granted = await ensureLocationPermissions();
  if (!granted) return 'permission-denied';
  await ensureNotificationPermission();

  const arrivedIds = await getArrivedPlaceIds(schedule.id);
  const pendingPlaces = schedule.places.filter((p) => !arrivedIds.includes(p.id));
  if (pendingPlaces.length === 0) return 'no-places';

  const places: ActiveSchedulePlace[] = pendingPlaces.map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.latitude,
    lng: p.longitude,
  }));
  await AsyncStorage.setItem(ACTIVE_SCHEDULE_KEY, schedule.id);
  await AsyncStorage.setItem(ACTIVE_SCHEDULE_PLACES_KEY, JSON.stringify(places));

  await startLocationTracking();
  return 'started';
}

export async function clearActiveSchedule(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_SCHEDULE_KEY);
  await AsyncStorage.removeItem(ACTIVE_SCHEDULE_PLACES_KEY);
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
    const activeSchedule = await getActiveSchedule();

    for (const loc of locations) {
      const point: LatLng = { lat: loc.coords.latitude, lng: loc.coords.longitude };

      // (1) 거리 누적 → 발자국
      if (lastPoint) {
        const segment = haversineMeters(lastPoint.lat, lastPoint.lng, point.lat, point.lng);
        if (segment > 0 && segment < MAX_VALID_JUMP_METERS) {
          total += segment;
        }
      }
      lastPoint = point;

      // (2) 관광지 6곳 근접 체크 → 스탬프 지급
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

      // (3) 진행 중인 일정 장소 근접 체크 → 도착 표시
      if (activeSchedule) {
        for (const place of activeSchedule.places) {
          const dist = haversineMeters(point.lat, point.lng, place.lat, place.lng);
          if (dist <= ARRIVAL_RADIUS_METERS) {
            const isNew = await markArrived(activeSchedule.scheduleId, place.id);
            if (isNew) {
              await notify('도착했어요! 🐾', `${place.name}에 도착했어요.`);
            }
          }
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
