import { SavedPlace } from './save';

export interface Schedule {
  id: string;
  year: number;
  month: number; // 0-indexed, matches Date#getMonth()
  day: number; // 1-indexed
  departureLabel: string;
  departureLatitude: number;
  departureLongitude: number;
  places: SavedPlace[];
  started: boolean;
}
