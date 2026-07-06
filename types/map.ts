export interface MapPlace {
  id: string;
  name: string;
  category: '관광지' | '카페' | '식당';
  tags: string[];
  imageUri: string;
  latitude: number;
  longitude: number;
  address: string;
  phone: string;
  hours: string;
}
