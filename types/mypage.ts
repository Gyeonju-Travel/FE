export interface DogProfile {
  id: string;
  name: string;
  photoUri: string;
  breed: string;
  sizeType: string;
  age: number;
  gender: '남아' | '여아';
  personalityTags: string[];
  isPrimary: boolean;
  stampCount: number;
  visitedPlacesCount: number;
}

export interface TravelHistoryItem {
  id: string;
  date: string;
  title: string;
  imageUri: string;
  visitedCount: number;
  duration: string;
}
