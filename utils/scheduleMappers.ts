import { Schedule } from '@/types/schedule';
import { SavedPlace } from '@/types/save';
import { DepartureArea, ScheduleDetailResponse } from '@/utils/api';

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

/** 서버 일정 상세 응답을 화면에서 쓰는 Schedule(연/월/일 분리) 형태로 변환한다.
 *
 * GET /api/schedules(날짜별 목록)는 장소 이름만 내려주고 placeId/좌표/사진은 주지 않는다.
 * 이름만으로 자리표시자 SavedPlace를 만들어 개수·제목·타임라인 텍스트는 정확히 보여주되,
 * latitude/longitude는 NaN으로 채운다 — 지도가 필요한 화면(경로보기 등)은 이 값을 실제
 * 좌표로 신뢰하면 안 되고, 사용 전에 NaN 여부를 확인해서 안내 문구로 대체해야 한다. */
export function toSchedule(detail: ScheduleDetailResponse): Schedule {
  const [y, m, d] = detail.date.split('-').map(Number);
  const places: SavedPlace[] = detail.placeNames.map((name, i) => ({
    id: `${detail.scheduleId}-${i}`,
    name,
    category: '관광지',
    tags: [],
    imageUri: null,
    latitude: NaN,
    longitude: NaN,
  }));

  return {
    id: String(detail.scheduleId),
    year: y,
    month: m - 1,
    day: d,
    departureLabel: departureAreaToLabel(detail.departure.code) || detail.departure.name,
    places,
  };
}
