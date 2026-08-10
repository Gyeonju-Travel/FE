import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Schedule } from '@/types/schedule';
import { GEOFENCE_ATTRACTIONS, awardStamp, getEarnedStampIndices } from '@/constants/stamps';

const ARRIVAL_RADIUS_METERS = 40;

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
    // 알림 권한 요청 실패는 무시 — 도착 감지 자체는 알림 없이도 동작한다.
  }
}

async function notifyArrival(placeName: string, stampAwarded: boolean) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '도착했어요! 🐾',
        body: stampAwarded
          ? `${placeName}에서 새로운 스탬프를 획득했어요.`
          : `${placeName}에 도착했어요.`,
        sound: true,
      },
      trigger: null,
    });
  } catch {
    // 알림 권한이 없거나 실패해도 처리 자체는 이미 끝났으므로 조용히 무시한다.
  }
}

// ─── 일정 도착 감지 (경로보기 화면의 체크마크 전용) ────────────────────────────────
// 오늘 일정에 담긴 장소들에 실제로 들렀는지만 표시하는 용도라, 스탬프 지급과는 분리돼 있다.
// (스탬프는 아래 "관광지 스탬프 지오펜싱" 6곳 고정 지점에서만 지급된다.)
export const GEOFENCE_TASK_NAME = 'gyeonjutravel-schedule-arrival';

const ARRIVED_PLACES_KEY_PREFIX = 'gyeonjutravel.arrivedPlaces.';
const PLACE_NAMES_KEY_PREFIX = 'gyeonjutravel.geofencePlaceNames.';
const ACTIVE_SCHEDULE_KEY = 'gyeonjutravel.activeGeofenceScheduleId';

function arrivedPlacesKey(scheduleId: string) {
  return `${ARRIVED_PLACES_KEY_PREFIX}${scheduleId}`;
}
function placeNamesKey(scheduleId: string) {
  return `${PLACE_NAMES_KEY_PREFIX}${scheduleId}`;
}

// region identifier는 "{scheduleId}::{placeId}" 형태로 인코딩해, 백그라운드 콜백에서
// 어떤 일정의 어떤 장소에 도착한 건지 복원한다.
function encodeRegionId(scheduleId: string, placeId: string) {
  return `${scheduleId}::${placeId}`;
}
function decodeRegionId(identifier: string): { scheduleId: string; placeId: string } | null {
  const idx = identifier.indexOf('::');
  if (idx === -1) return null;
  return { scheduleId: identifier.slice(0, idx), placeId: identifier.slice(idx + 2) };
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

async function getScheduledPlaceName(scheduleId: string, placeId: string): Promise<string> {
  const raw = await AsyncStorage.getItem(placeNamesKey(scheduleId));
  if (!raw) return '목적지';
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed[placeId] ?? '목적지';
  } catch {
    return '목적지';
  }
}

if (!TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
  TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
    if (error) return;
    const eventData = data as
      | { eventType: Location.LocationGeofencingEventType; region: Location.LocationRegion }
      | undefined;
    if (!eventData || eventData.eventType !== Location.LocationGeofencingEventType.Enter) return;

    const identifier = eventData.region.identifier;
    if (!identifier) return;
    const decoded = decodeRegionId(identifier);
    if (!decoded) return;

    const { scheduleId, placeId } = decoded;
    const isNew = await markArrived(scheduleId, placeId);
    if (!isNew) return; // 이미 도착 처리된 장소 — 경계 근처에서 재진입해도 중복 알림 없음

    const placeName = await getScheduledPlaceName(scheduleId, placeId);
    await notifyArrival(placeName, false);
  });
}

export type StartGeofencingResult = 'started' | 'permission-denied' | 'no-places';

/** 일정에 담긴, 아직 도착하지 않은 장소들을 대상으로 백그라운드 지오펜싱을 시작한다. */
export async function startScheduleGeofencing(schedule: Schedule): Promise<StartGeofencingResult> {
  const granted = await ensureLocationPermissions();
  if (!granted) return 'permission-denied';
  await ensureNotificationPermission();

  const arrivedIds = await getArrivedPlaceIds(schedule.id);
  const pendingPlaces = schedule.places.filter((p) => !arrivedIds.includes(p.id));
  if (pendingPlaces.length === 0) return 'no-places';

  const regions: Location.LocationRegion[] = pendingPlaces.map((p) => ({
    identifier: encodeRegionId(schedule.id, p.id),
    latitude: p.latitude,
    longitude: p.longitude,
    radius: ARRIVAL_RADIUS_METERS,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  const placeNames = Object.fromEntries(schedule.places.map((p) => [p.id, p.name]));
  await AsyncStorage.setItem(placeNamesKey(schedule.id), JSON.stringify(placeNames));
  await AsyncStorage.setItem(ACTIVE_SCHEDULE_KEY, schedule.id);

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
  return 'started';
}

export async function stopScheduleGeofencing(): Promise<void> {
  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  if (started) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }
  await AsyncStorage.removeItem(ACTIVE_SCHEDULE_KEY);
}

/** 이 일정이 지금 지오펜싱으로 감지 중인지 (다른 일정을 감지 중이면 false). */
export async function isGeofencingActiveFor(scheduleId: string): Promise<boolean> {
  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  if (!started) return false;
  const activeId = await AsyncStorage.getItem(ACTIVE_SCHEDULE_KEY);
  return activeId === scheduleId;
}

// ─── 관광지 스탬프 지오펜싱 (교촌마을·황리단길·계림·월정교·경주읍성·첨성대 6곳 고정) ──────
// 일정과 무관하게 항상 이 6곳을 감시한다. 실제로 근처에 가면 해당 관광지의 고유 스탬프가
// 그 자리에서 지급된다 (순서 상관없이, 어떤 곳을 먼저 가든 그 곳에 맞는 뱃지를 받음).
export const ATTRACTION_GEOFENCE_TASK_NAME = 'gyeonjutravel-attraction-stamp';

function encodeAttractionRegionId(stampIndex: number) {
  return `attraction::${stampIndex}`;
}
function decodeAttractionRegionId(identifier: string): number | null {
  const prefix = 'attraction::';
  if (!identifier.startsWith(prefix)) return null;
  const n = Number(identifier.slice(prefix.length));
  return Number.isFinite(n) ? n : null;
}

if (!TaskManager.isTaskDefined(ATTRACTION_GEOFENCE_TASK_NAME)) {
  TaskManager.defineTask(ATTRACTION_GEOFENCE_TASK_NAME, async ({ data, error }) => {
    if (error) return;
    const eventData = data as
      | { eventType: Location.LocationGeofencingEventType; region: Location.LocationRegion }
      | undefined;
    if (!eventData || eventData.eventType !== Location.LocationGeofencingEventType.Enter) return;

    const identifier = eventData.region.identifier;
    if (!identifier) return;
    const stampIndex = decodeAttractionRegionId(identifier);
    if (stampIndex == null) return;

    const attraction = GEOFENCE_ATTRACTIONS.find((a) => a.stampIndex === stampIndex);
    if (!attraction) return;

    const awarded = await awardStamp(stampIndex);
    await notifyArrival(attraction.name, awarded);
  });
}

/** 6개 관광지 지점에 대해 백그라운드 지오펜싱을 시작한다 (이미 스탬프 받은 곳은 제외). */
export async function startAttractionGeofencing(): Promise<StartGeofencingResult> {
  const granted = await ensureLocationPermissions();
  if (!granted) return 'permission-denied';
  await ensureNotificationPermission();

  const earned = await getEarnedStampIndices();
  const pending = GEOFENCE_ATTRACTIONS.filter((a) => !earned.has(a.stampIndex));
  if (pending.length === 0) return 'no-places';

  const regions: Location.LocationRegion[] = pending.map((a) => ({
    identifier: encodeAttractionRegionId(a.stampIndex),
    latitude: a.latitude,
    longitude: a.longitude,
    radius: ARRIVAL_RADIUS_METERS,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  await Location.startGeofencingAsync(ATTRACTION_GEOFENCE_TASK_NAME, regions);
  return 'started';
}

export async function stopAttractionGeofencing(): Promise<void> {
  const started = await Location.hasStartedGeofencingAsync(ATTRACTION_GEOFENCE_TASK_NAME);
  if (started) {
    await Location.stopGeofencingAsync(ATTRACTION_GEOFENCE_TASK_NAME);
  }
}

export async function isAttractionGeofencingActive(): Promise<boolean> {
  return Location.hasStartedGeofencingAsync(ATTRACTION_GEOFENCE_TASK_NAME);
}
