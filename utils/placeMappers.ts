import { MapPlace } from '@/types/map';
import { SavedPlace } from '@/types/save';
import { MapPlaceResponse, PlaceDetailResponse } from '@/utils/api';

export function parseTags(petAccessType?: string | null, petRequirements?: string | null): string[] {
  const access = petAccessType ? petAccessType.split('/').map((s) => s.trim()) : [];
  const requirements = petRequirements ? petRequirements.split(',').map((s) => s.trim()) : [];
  return [...access, ...requirements].filter(Boolean);
}

// 백엔드 petInfo는 "- 항목1\n- 항목2" 형태가 기본이지만, 일부 데이터는 줄바꿈 없이
// "항목1- 항목2"처럼 붙어있다. 둘 다 "-" 앞에서 끊어 항목으로 나눈다.
export function parsePetInfoBullets(petInfo?: string | null): string[] {
  if (!petInfo) return [];
  return petInfo
    .split(/\n?-\s*/)
    .map((s) => s.replace(/\n/g, ' ').trim())
    .filter(Boolean);
}

export function toMapPlace(res: MapPlaceResponse): MapPlace {
  return {
    id: String(res.id),
    name: res.name,
    category: (res.categoryLabel as MapPlace['category']) ?? '관광지',
    tags: parseTags(res.petAccessType, res.petRequirements),
    imageUri: res.imageUrl,
    latitude: res.latitude,
    longitude: res.longitude,
    address: res.roadAddress,
    phone: '',
    hours: '',
  };
}

export function toMapPlaceDetail(res: PlaceDetailResponse): MapPlace {
  return {
    ...toMapPlace(res),
    phone: res.phone ?? '',
    hours: res.businessHours ?? '',
    breakTime: res.breakTime ?? '',
    closedDays: res.closedDays ?? '',
    petInfo: res.petInfo ?? '',
  };
}

export function toSavedPlace(res: MapPlaceResponse): SavedPlace {
  return {
    id: String(res.id),
    name: res.name,
    category: (res.categoryLabel as SavedPlace['category']) ?? '관광지',
    tags: parseTags(res.petAccessType, res.petRequirements),
    imageUri: res.imageUrl,
    latitude: res.latitude,
    longitude: res.longitude,
  };
}
