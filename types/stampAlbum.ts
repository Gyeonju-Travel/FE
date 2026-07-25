/** 방문한 장소 하나. 지도에 방문 순서대로 1번부터 번호 핀으로 표시된다. */
export interface RouteStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface TravelBadgeData {
  id: string;
  name: string;
  imageUri?: string;
}

export interface ScrapData {
  id: string;
  title: string;
  travelDate: string;
  dogName: string;
  dogProfileImageUri?: string;
  selectedPhotoUris: string[];
  /** 방문한 장소들 (방문 순서대로). */
  stops: RouteStop[];
  /** 서버가 총 이동 거리를 제공하는 경우 사용. 없으면 각 구간을 Tmap 도보 경로 API로 조회해 합산한다. */
  totalDistanceInMeters?: number;
  badge?: TravelBadgeData;
}
