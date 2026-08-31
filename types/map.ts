export interface MapPlace {
  id: string;
  name: string;
  category: '관광지' | '카페' | '식당';
  tags: string[];
  imageUri: string | null;
  latitude: number;
  longitude: number;
  address: string;
  phone: string;
  hours: string;
  breakTime?: string;
  closedDays?: string;
  /** 관광지 입장 전 안내 사항 (백엔드 petInfo 원문 — "- 항목1\n- 항목2" 형태). */
  petInfo?: string;
}
