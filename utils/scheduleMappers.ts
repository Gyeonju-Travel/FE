import { Schedule } from '@/types/schedule';
import { SavedPlace } from '@/types/save';
import { DepartureArea, ScheduleDetailResponse } from '@/utils/api';
import { parseTags } from '@/utils/placeMappers';

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
  const places: SavedPlace[] = [...detail.places]
    .sort((a, b) => a.visitOrder - b.visitOrder)
    .map((p) => ({
      id: String(p.placeId),
      name: p.name,
      // 일정 상세 응답에는 카테고리가 내려오지 않아 기본값으로 표시한다.
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
    places,
  };
}
