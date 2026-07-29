import { router } from 'expo-router';
import { clearTokens } from './authStorage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

interface ApiEnvelope<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  result: T;
}

export class ApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

type QueryParams = Record<string, string | number | string[] | undefined>;

function buildQueryString(params?: QueryParams): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => usp.append(key, v));
    } else {
      usp.append(key, String(value));
    }
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string; params?: QueryParams } = {}
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError('서버 주소가 설정되지 않았어요.', 'NO_API_BASE_URL');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}${buildQueryString(options.params)}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const json: ApiEnvelope<T> | null = text ? JSON.parse(text) : null;

  if (!response.ok || !json || !json.isSuccess) {
    // 인증이 필요한 요청에서 토큰이 만료/무효 처리된 경우 로그인 화면으로 되돌린다.
    // (로그인/회원가입 자체의 401은 accessToken을 안 실었으니 여기 해당 안 됨)
    if (response.status === 401 && options.accessToken) {
      await clearTokens();
      router.replace('/login');
    }
    throw new ApiError(json?.message ?? `요청에 실패했어요. (${response.status})`, json?.code ?? String(response.status));
  }

  return json.result;
}

// multipart/form-data 전용 요청. "request" 파트는 서버가 application/json Content-Type을
// 요구해서(없으면 415) Blob으로 명시적인 type을 지정해 붙여준다.
// (Expo의 FormData 패치가 .entries()를 추가하면서 문자열/Blob이 아닌 커스텀 객체 파트는
//  "Unsupported FormDataPart implementation" 에러로 거부한다 — {string,type} 트릭 불가.)
async function requestMultipart<T>(
  path: string,
  method: string,
  requestPart: unknown,
  accessToken: string
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError('서버 주소가 설정되지 않았어요.', 'NO_API_BASE_URL');
  }

  const form = new FormData();
  form.append('request', new Blob([JSON.stringify(requestPart)], { type: 'application/json' }));

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  const text = await response.text();
  const json: ApiEnvelope<T> | null = text ? JSON.parse(text) : null;

  if (!response.ok || !json || !json.isSuccess) {
    if (response.status === 401) {
      await clearTokens();
      router.replace('/login');
    }
    throw new ApiError(json?.message ?? `요청에 실패했어요. (${response.status})`, json?.code ?? String(response.status));
  }

  return json.result;
}

export type Gender = 'FEMALE' | 'MALE';

export interface SignUpRequest {
  email: string;
  password: string;
  passwordConfirmation: string;
  name: string;
  birthDate: string;
  gender: Gender;
  phoneNumber: string;
}

export interface SignUpResult {
  memberId: number;
  email: string;
  name: string;
  birthDate: string;
  gender: Gender;
  phoneNumber: string;
  accessToken: string;
  accessTokenExpiresIn: number;
  onboardingCompleted: boolean;
}

export function signUp(body: SignUpRequest) {
  return request<SignUpResult>('/api/auth/signup', { method: 'POST', body });
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResult {
  memberId: number;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  onboardingCompleted: boolean;
}

export function login(body: LoginRequest) {
  return request<LoginResult>('/api/auth/login', { method: 'POST', body });
}

export function logout(accessToken: string) {
  return request<void>('/api/auth/logout', { method: 'POST', accessToken });
}

export function withdraw(accessToken: string) {
  return request<void>('/api/auth/withdraw', { method: 'DELETE', accessToken });
}

export type PlaceCategoryCode = 'RESTAURANT' | 'CAFE' | 'ATTRACTION';

export interface MapPlaceResponse {
  id: number;
  name: string;
  category: PlaceCategoryCode;
  categoryLabel: string;
  detailCategory: string | null;
  roadAddress: string;
  longitude: number;
  latitude: number;
  imageUrl: string | null;
  petAccessType: string | null;
  petRequirements: string | null;
}

export interface MapPlacePageResponse {
  places: MapPlaceResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface PlaceDetailResponse extends MapPlaceResponse {
  area: string | null;
  administrativeDistrict: string | null;
  lotAddress: string | null;
  postalCode: string | null;
  phone: string | null;
  businessHours: string | null;
  breakTime: string | null;
  closedDays: string | null;
  allowedPets: string | null;
  petInfo: string | null;
  petFacilities: string | null;
  petProvidedItems: string | null;
  petSafetyInfo: string | null;
}

export function searchPlaces(
  params: { categories?: PlaceCategoryCode[]; keyword?: string; page?: number; size?: number },
  accessToken: string
) {
  return request<MapPlacePageResponse>('/api/places', { params, accessToken });
}

export function getPlaceDetail(placeId: number, accessToken: string) {
  return request<PlaceDetailResponse>(`/api/places/${placeId}`, { accessToken });
}

export function saveBookmark(placeId: number, accessToken: string) {
  return request<MapPlaceResponse>(`/api/places/${placeId}/bookmarks`, { method: 'POST', accessToken });
}

export function getBookmarks(categories: PlaceCategoryCode[] | undefined, accessToken: string) {
  return request<MapPlaceResponse[]>('/api/places/bookmarks', { params: { categories }, accessToken });
}

export function deleteBookmarks(placeIds: number[], accessToken: string) {
  return request<void>('/api/places/bookmarks', {
    method: 'DELETE',
    body: { placeIds },
    accessToken,
  });
}

export type PetSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export type PetGender = 'MALE' | 'FEMALE';
export type PetPersonality = 'ACTIVE' | 'RELAXED' | 'FRIENDLY';

export interface PetSummaryResponse {
  petId: number;
  name: string;
  profileImageUrl: string | null;
}

export interface RepresentativePetResponse {
  petId: number;
  name: string;
  profileImageUrl: string | null;
  breed: string;
  size: PetSize;
  age: number;
}

export interface PetListResponse {
  representativePet: RepresentativePetResponse | null;
  otherPets: PetSummaryResponse[];
}

export interface PetDetailResponse {
  petId: number;
  name: string;
  profileImageUrl: string | null;
  breed: string;
  size: PetSize;
  age: number;
  gender: PetGender;
  personality: PetPersonality;
}

export interface PetRegistrationRequest {
  name: string;
  breed: string;
  size: PetSize;
  age: number;
  gender: PetGender;
  personality: PetPersonality;
}

export type PetProfileUpdateRequest = PetRegistrationRequest;

export function getMyPets(accessToken: string) {
  return request<PetListResponse>('/api/pets', { accessToken });
}

export function getPetDetail(petId: number, accessToken: string) {
  return request<PetDetailResponse>(`/api/pets/${petId}`, { accessToken });
}

export function registerPet(body: PetRegistrationRequest, accessToken: string) {
  return requestMultipart<PetDetailResponse>('/api/pets', 'POST', body, accessToken);
}

export function updatePetProfile(petId: number, body: PetProfileUpdateRequest, accessToken: string) {
  return requestMultipart<PetDetailResponse>(`/api/pets/${petId}`, 'PATCH', body, accessToken);
}
