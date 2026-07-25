import { TravelHistoryItem } from '@/types/mypage';

export const MOCK_TRAVEL_HISTORY: TravelHistoryItem[] = [
  {
    id: 'trip-1',
    date: '2026.06.22',
    title: '황리단길 → 첨성대',
    imageUri: 'https://picsum.photos/seed/cheomseongdae/800/500',
    visitedCount: 4,
    duration: '2시간',
  },
  {
    id: 'trip-2',
    date: '2026.05.17',
    title: '불국사 → 안압지',
    imageUri: 'https://picsum.photos/seed/bulguksa/800/500',
    visitedCount: 3,
    duration: '2시간 20분',
  },
  {
    id: 'trip-3',
    date: '2026.04.23',
    title: '교촌마을 → 대릉원 일원',
    imageUri: 'https://picsum.photos/seed/gyochon/800/500',
    visitedCount: 5,
    duration: '3시간',
  },
];
