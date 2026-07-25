import { ScrapData } from '@/types/stampAlbum';

/**
 * MOCK: mock/travelHistory.ts의 TravelHistoryItem.id로 조회하는 스크랩 데이터.
 * 실제 연결 지점: 여행 기록 상세 API가 생기면 이 파일 대신 id로 서버에서 ScrapData를 받아오면 된다.
 * selectedPhotoUris/badge는 아직 실제 데이터가 없어 비워둔다 (화면은 placeholder로 처리).
 */
export const MOCK_SCRAP_DATA: Record<string, ScrapData> = {
  'trip-1': {
    id: 'trip-1',
    title: '오늘의 경주',
    travelDate: '2026 · 06 · 22',
    dogName: '쪼리',
    dogProfileImageUri: 'https://picsum.photos/seed/dog1/200/200',
    selectedPhotoUris: [],
    stops: [
      { id: 'hwangridan', name: '황리단길', latitude: 35.8331, longitude: 129.2122 },
      { id: 'wolseong', name: '월성', latitude: 35.8337, longitude: 129.2146 },
      { id: 'daereungwon', name: '대릉원', latitude: 35.8342, longitude: 129.217 },
      { id: 'cheomseongdae', name: '첨성대', latitude: 35.8347, longitude: 129.2194 },
    ],
    // 값이 없으면 각 구간을 Tmap 도보 경로 API로 조회해 거리를 합산한다.
    totalDistanceInMeters: undefined,
  },
  'trip-2': {
    id: 'trip-2',
    title: '오늘의 경주',
    travelDate: '2026 · 05 · 17',
    dogName: '쪼리',
    dogProfileImageUri: 'https://picsum.photos/seed/dog1/200/200',
    selectedPhotoUris: [],
    stops: [
      { id: 'bulguksa', name: '불국사', latitude: 35.7898, longitude: 129.332 },
      { id: 'viewpoint', name: '고분 전망대', latitude: 35.7924, longitude: 129.3298 },
      { id: 'anapji', name: '안압지', latitude: 35.7949, longitude: 129.3277 },
    ],
    totalDistanceInMeters: undefined,
  },
};
