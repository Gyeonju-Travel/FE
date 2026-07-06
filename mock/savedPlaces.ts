import { SavedPlace } from '@/types/save';

export const MOCK_SAVED_PLACES: SavedPlace[] = [
  {
    id: '1',
    name: '황리단길 살로우 커피',
    category: '카페',
    tags: ['전 구역', '이동장 필수'],
    imageUri: 'https://picsum.photos/seed/cafe1/200/200',
  },
  {
    id: '2',
    name: '대릉원 일원',
    category: '관광지',
    tags: ['야외만'],
    imageUri: 'https://picsum.photos/seed/park1/200/200',
  },
  {
    id: '3',
    name: '교촌마을 한옥 카페',
    category: '카페',
    tags: ['전 구역', '이동장 필수'],
    imageUri: 'https://picsum.photos/seed/cafe2/200/200',
  },
  {
    id: '4',
    name: '불국사',
    category: '관광지',
    tags: ['야외만', '목줄 필수'],
    imageUri: 'https://picsum.photos/seed/temple1/200/200',
  },
  {
    id: '5',
    name: '첨성대',
    category: '관광지',
    tags: ['야외만'],
    imageUri: 'https://picsum.photos/seed/tower1/200/200',
  },
  {
    id: '6',
    name: '경주 로스터리',
    category: '카페',
    tags: ['전 구역'],
    imageUri: 'https://picsum.photos/seed/cafe3/200/200',
  },
];
