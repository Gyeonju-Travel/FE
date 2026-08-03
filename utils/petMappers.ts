import { DogProfile } from '@/types/mypage';
import {
  PetSummaryResponse,
  RepresentativePetResponse,
  PetDetailResponse,
  PetSize,
  PetGender,
  PetPersonality,
} from '@/utils/api';

const SIZE_TO_API: Record<string, PetSize> = { 소형견: 'SMALL', 중형견: 'MEDIUM', 대형견: 'LARGE' };
const SIZE_TO_LABEL: Record<PetSize, string> = { SMALL: '소형견', MEDIUM: '중형견', LARGE: '대형견' };

const GENDER_TO_API: Record<'남아' | '여아', PetGender> = { 남아: 'MALE', 여아: 'FEMALE' };
const GENDER_TO_LABEL: Record<PetGender, '남아' | '여아'> = { MALE: '남아', FEMALE: '여아' };

const PERSONALITY_TO_API: Record<string, PetPersonality> = {
  활동적: 'ACTIVE',
  느긋함: 'RELAXED',
  '친화력 좋음': 'FRIENDLY',
};
const PERSONALITY_TO_LABEL: Record<PetPersonality, string> = {
  ACTIVE: '활동적',
  RELAXED: '느긋함',
  FRIENDLY: '친화력 좋음',
};

export function sizeToApi(label: string): PetSize {
  return SIZE_TO_API[label] ?? 'MEDIUM';
}
export function sizeToLabel(size: PetSize): string {
  return SIZE_TO_LABEL[size];
}
export function genderToApi(label: '남아' | '여아'): PetGender {
  return GENDER_TO_API[label];
}
export function genderToLabel(gender: PetGender): '남아' | '여아' {
  return GENDER_TO_LABEL[gender];
}
export function personalityToApi(label: string): PetPersonality {
  return PERSONALITY_TO_API[label] ?? 'ACTIVE';
}
export function personalityToLabel(personality: PetPersonality): string {
  return PERSONALITY_TO_LABEL[personality] ?? '';
}

export function toDogSummary(res: PetSummaryResponse, isPrimary: boolean): DogProfile {
  return {
    id: String(res.petId),
    name: res.name,
    photoUri: res.profileImageUrl ?? '',
    breed: '',
    sizeType: '중형견',
    age: 0,
    gender: '남아',
    personalityTags: [],
    isPrimary,
    stampCount: 0,
    visitedPlacesCount: 0,
  };
}

export function toDogFromRepresentative(res: RepresentativePetResponse): DogProfile {
  return {
    id: String(res.petId),
    name: res.name,
    photoUri: res.profileImageUrl ?? '',
    breed: res.breed,
    sizeType: sizeToLabel(res.size),
    age: res.age,
    gender: '남아',
    personalityTags: [],
    isPrimary: true,
    stampCount: 0,
    visitedPlacesCount: 0,
  };
}

export function toDogDetail(res: PetDetailResponse, isPrimary: boolean): DogProfile {
  return {
    id: String(res.petId),
    name: res.name,
    photoUri: res.profileImageUrl ?? '',
    breed: res.breed,
    sizeType: sizeToLabel(res.size),
    age: res.age,
    gender: genderToLabel(res.gender),
    personalityTags: [personalityToLabel(res.personality)].filter(Boolean),
    isPrimary,
    stampCount: 0,
    visitedPlacesCount: 0,
  };
}
