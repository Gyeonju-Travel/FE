export type PlaceCategory = '전체' | '관광지' | '카페' | '식당';

export interface SavedPlace {
  id: string;
  name: string;
  category: Exclude<PlaceCategory, '전체'>;
  tags: string[];
  imageUri: string;
}
