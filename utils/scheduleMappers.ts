import { Schedule } from '@/types/schedule';
import { SavedPlace } from '@/types/save';
import { MapPlace } from '@/types/map';
import { DepartureArea, ScheduleDetailResponse, searchPlaces } from '@/utils/api';
import { parseTags, toMapPlace } from '@/utils/placeMappers';
import { getAccessToken } from '@/utils/authStorage';

/** 출발지 화면에 노출하는 4개 지역과 서버 departureArea enum 간의 매핑. */
export const DEPARTURE_OPTIONS: string[] = ['황리단길', '금리단길', '첨성대', '교촌마을'];

const DEPARTURE_AREA_BY_LABEL: Record<string, DepartureArea> = {
  황리단길: 'HWANGRIDAN_GIL',
  금리단길: 'GEUMRIDAN_GIL',
  첨성대: 'CHEOMSEONGDAE',
  교촌마을: 'GYOCHON_VILLAGE',
};

const LABEL_BY_DEPARTURE_AREA: Record<DepartureArea, string> = {
  HWANGRIDAN_GIL: '황리단길',
  GEUMRIDAN_GIL: '금리단길',
  CHEOMSEONGDAE: '첨성대',
  GYOCHON_VILLAGE: '교촌마을',
};

export function labelToDepartureArea(label: string): DepartureArea {
  return DEPARTURE_AREA_BY_LABEL[label] ?? 'HWANGRIDAN_GIL';
}

export function departureAreaToLabel(area: string): string {
  return LABEL_BY_DEPARTURE_AREA[area as DepartureArea] ?? area;
}

export function toIsoDate(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** 서버 일정 상세 응답을 화면에서 쓰는 Schedule(연/월/일 분리) 형태로 변환한다. */
export function toSchedule(detail: ScheduleDetailResponse): Schedule {
  const [y, m, d] = detail.date.split('-').map(Number);
  const places: SavedPlace[] = detail.places.map((p) => ({
    id: String(p.placeId),
    name: p.name,
    category: '관광지',
    tags: parseTags(p.petAccessType, p.petRequirements),
    imageUri: p.imageUrl,
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  return {
    id: String(detail.scheduleId),
    year: y,
    month: m - 1,
    day: d,
    departureLabel: departureAreaToLabel(detail.departure.code) || detail.departure.name,
    departureLatitude: detail.departure.latitude,
    departureLongitude: detail.departure.longitude,
    places,
    started: detail.started,
  };
}

/** 장소 이름으로 대표 사진을 검색한다. 관광지 카테고리에 없으면(예: 금리단길) 카테고리 제한을
 * 풀어 한 번 더 찾는다 — 완전히 사진 없이 두는 것보다는 근처 식당/카페 사진이라도 보여주는 게 낫다. */
export async function searchPlaceByName(name: string, token: string): Promise<MapPlace | undefined> {
  try {
    // 카테고리를 관광지로 한정하지 않으면 "OO황리단길점" 같은 인근 식당/카페가 먼저 잡혀서
    // 엉뚱한 사진이 붙는다. DB에 등록된 이름은 보통 "경주 " 접두사가 붙어있어 정확히
    // 일치하진 않으므로, 이름에 검색어가 포함된 것을 우선으로 찾는다.
    let result = await searchPlaces({ keyword: name, categories: ['ATTRACTION'], size: 10 }, token);
    if (result.places.length === 0) {
      result = await searchPlaces({ keyword: name, size: 10 }, token);
    }
    const match = result.places.find((p) => p.name.includes(name)) ?? result.places[0];
    return match ? toMapPlace(match) : undefined;
  } catch (e) {
    return undefined;
  }
}

/** 4개 출발지 지역 각각의 대표 장소(이름/좌표/사진)를 검색해 이름으로 조회할 수 있게 맵으로 묶는다. */
export async function fetchDeparturePlaces(): Promise<Record<string, MapPlace>> {
  const token = await getAccessToken();
  if (!token) return {};
  const entries = await Promise.all(
    DEPARTURE_OPTIONS.map(async (name) => {
      try {
        const place = await searchPlaceByName(name, token);
        return place ? ([name, place] as const) : null;
      } catch (e) {
        return null;
      }
    })
  );
  return Object.fromEntries(entries.filter((e): e is readonly [string, MapPlace] => e !== null));
}
