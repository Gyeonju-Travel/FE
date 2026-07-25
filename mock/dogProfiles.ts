import { DogProfile } from '@/types/mypage';

export const MOCK_DOG_PROFILES: DogProfile[] = [
  {
    id: 'dog-1',
    name: '쪼리',
    photoUri: 'https://picsum.photos/seed/dog1/200/200',
    breed: '믹스',
    sizeType: '중형견',
    age: 6,
    gender: '남아',
    personalityTags: ['독립형', '활동량 높음'],
    isPrimary: true,
    stampCount: 5,
    visitedPlacesCount: 2,
  },
  {
    id: 'dog-2',
    name: '앵두',
    photoUri: 'https://picsum.photos/seed/dog2/200/200',
    breed: '포메라니안',
    sizeType: '소형견',
    age: 3,
    gender: '여아',
    personalityTags: ['애교 많음', '겁 많음'],
    isPrimary: false,
    stampCount: 3,
    visitedPlacesCount: 1,
  },
];
