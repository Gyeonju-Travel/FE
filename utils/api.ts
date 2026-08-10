import { router } from 'expo-router';
import { clearTokens } from './authStorage';

// 백엔드(EXPO_PUBLIC_API_BASE_URL)와 통신하는 코드는 반드시 이 파일의 request()/requestMultipart()를
// 통해서만 fetch를 호출한다. 새 API 함수를 추가할 때도 이 두 헬퍼를 거치면 [API →]/[API ←]/[API ✕]
// 로그가 자동으로 남으므로, 다른 곳에서 직접 fetch로 백엔드를 호출하지 않는다.
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

const SENSITIVE_KEYS = ['password', 'passwordConfirmation', 'newPassword', 'newPasswordConfirmation'];

function redact(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of SENSITIVE_KEYS) {
    if (key in clone) clone[key] = '***';
  }
  return clone;
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
  const method = options.method ?? 'GET';

  if (!API_BASE_URL) {
    console.error('[API] EXPO_PUBLIC_API_BASE_URL이 설정되지 않았습니다. .env를 확인하세요.');
    throw new ApiError('서버 주소가 설정되지 않았어요.', 'NO_API_BASE_URL');
  }

  const url = `${API_BASE_URL}${path}${buildQueryString(options.params)}`;
  console.log(`[API →] ${method} ${path}`, options.body ? redact(options.body) : '');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkError) {
    console.error(`[API ✕ 네트워크 오류] ${method} ${path}`, networkError);
    throw networkError;
  }

  const text = await response.text();
  const json: ApiEnvelope<T> | null = text ? JSON.parse(text) : null;

  console.log(`[API ←] ${response.status} ${method} ${path}`, json ?? text);

  if (!response.ok || !json || !json.isSuccess) {
    console.error(`[API ✕ 실패] ${method} ${path}`, {
      status: response.status,
      code: json?.code,
      message: json?.message,
    });
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

// 로컬 file:// uri를 Blob으로 읽어온다. 새 expo/fetch는 표준 Fetch 스펙을 따라서
// http(s)/data 스킴만 지원하고 file://는 거부하므로, RN이 네이티브로 처리해주는
// XMLHttpRequest를 그대로 사용한다 (RN 공식 문서가 권장하는 로컬 파일 업로드 방식).
function readLocalFileAsBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error(`로컬 파일을 읽지 못했어요: ${uri}`));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

// multipart/form-data 전용 요청. "request" 파트는 서버가 application/json Content-Type을
// 요구해서(없으면 415) Blob으로 명시적인 type을 지정해 붙여준다.
// (Expo의 FormData 패치가 .entries()를 추가하면서 문자열/Blob이 아닌 커스텀 객체 파트는
//  "Unsupported FormDataPart implementation" 에러로 거부한다 — {string,type} 트릭 불가.)
async function requestMultipart<T>(
  path: string,
  method: string,
  requestPart: unknown,
  accessToken: string,
  imageUri?: string | null
): Promise<T> {
  if (!API_BASE_URL) {
    console.error('[API] EXPO_PUBLIC_API_BASE_URL이 설정되지 않았습니다. .env를 확인하세요.');
    throw new ApiError('서버 주소가 설정되지 않았어요.', 'NO_API_BASE_URL');
  }

  console.log(`[API →] ${method} ${path} (multipart)`, redact(requestPart), imageUri ? '+ image' : '');

  const form = new FormData();
  form.append('request', new Blob([JSON.stringify(requestPart)], { type: 'application/json' }));
  if (imageUri) {
    const extension = imageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
    // 위 "request" 파트와 마찬가지로 실제 Blob이어야 한다. 로컬 파일 uri를 읽어
    // Blob으로 변환한 뒤 붙인다 ({uri, name, type} 객체 트릭은 더 이상 통하지 않는다).
    const rawBlob = await readLocalFileAsBlob(imageUri);
    const imageBlob = new Blob([rawBlob], { type: mimeType });
    form.append('image', imageBlob, `photo.${extension}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
  } catch (networkError) {
    console.error(`[API ✕ 네트워크 오류] ${method} ${path}`, networkError);
    throw networkError;
  }

  const text = await response.text();
  const json: ApiEnvelope<T> | null = text ? JSON.parse(text) : null;

  console.log(`[API ←] ${response.status} ${method} ${path}`, json ?? text);

  if (!response.ok || !json || !json.isSuccess) {
    console.error(`[API ✕ 실패] ${method} ${path}`, {
      status: response.status,
      code: json?.code,
      message: json?.message,
    });
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

export function sendPasswordResetVerificationCode(email: string) {
  return request<void>('/api/auth/password-reset/verification-code', {
    method: 'POST',
    body: { email },
  });
}

export interface PasswordResetVerificationResult {
  resetToken: string;
  expiresIn: number;
}

export function verifyPasswordResetCode(email: string, verificationCode: string) {
  return request<PasswordResetVerificationResult>('/api/auth/password-reset/verification-code/confirm', {
    method: 'POST',
    body: { email, verificationCode },
  });
}

export interface PasswordResetRequest {
  email: string;
  resetToken: string;
  newPassword: string;
  newPasswordConfirmation: string;
}

export function resetPassword(body: PasswordResetRequest) {
  return request<void>('/api/auth/password-reset', { method: 'PATCH', body });
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
export type PetPersonality = 'ACTIVE' | 'RELAXED' | 'FRIENDLY' | 'SHYNESS' | 'SENSITIVITY' | 'CURIOSITY';

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

export function registerPet(body: PetRegistrationRequest, accessToken: string, imageUri?: string | null) {
  return requestMultipart<PetDetailResponse>('/api/pets', 'POST', body, accessToken, imageUri);
}

export function updatePetProfile(
  petId: number,
  body: PetProfileUpdateRequest,
  accessToken: string,
  imageUri?: string | null
) {
  return requestMultipart<PetDetailResponse>(`/api/pets/${petId}`, 'PATCH', body, accessToken, imageUri);
}

export type PetTravelPreference = 'PHOTO_SPOT' | 'CAFE' | 'NATURE';

export interface PetOnboardingRequest {
  name: string;
  size: PetSize;
  travelPreference: PetTravelPreference;
  personality: PetPersonality[];
}

export interface PetOnboardingResponse {
  petId: number;
  name: string;
  profileImageUrl: string | null;
  size: PetSize;
  travelPreference: PetTravelPreference;
  personality: PetPersonality[];
}

export function completeOnboarding(body: PetOnboardingRequest, accessToken: string, imageUri?: string | null) {
  return requestMultipart<PetOnboardingResponse>('/api/onboarding', 'POST', body, accessToken, imageUri);
}

// ─── 일정 (Schedule) ──────────────────────────────────────────────────────────
export type DepartureArea = 'HWANGRIDAN_GIL' | 'GEUMRIDAN_GIL' | 'CHEOMSEONGDAE' | 'GYOCHON_VILLAGE';

export interface DepartureResponse {
  code: string;
  name: string;
  longitude: number;
  latitude: number;
}

export interface SchedulePlaceResponse {
  visitOrder: number;
  placeId: number;
  name: string;
  imageUrl: string | null;
  petAccessType: string;
  petRequirements: string;
  walkingDurationSeconds: number;
  walkingDistanceMeters: number;
}

export interface SchedulePlaceDetailResponse extends SchedulePlaceResponse {
  longitude: number;
  latitude: number;
}

export interface WalkingRouteResponse {
  fromNodeKey: string;
  toNodeKey: string;
  durationSeconds: number;
  distanceMeters: number;
}

export interface SchedulePreviewRequest {
  departureArea: DepartureArea;
  date: string; // YYYY-MM-DD
  placeIds: number[];
}

export interface SchedulePreviewResponse {
  matrixToken: string;
  expiresAt: string;
  date: string;
  departure: DepartureResponse;
  recommendedPlaces: SchedulePlaceResponse[];
  walkingTimeMatrix: WalkingRouteResponse[];
}

export interface ScheduleCreateRequest {
  matrixToken: string;
  orderedPlaceIds: number[];
}

export interface ScheduleResponse {
  scheduleId: number;
  date: string;
  departure: DepartureResponse;
  places: SchedulePlaceResponse[];
}

export interface ScheduleDetailResponse {
  scheduleId: number;
  date: string;
  departure: DepartureResponse;
  lastPlaceName: string;
  totalPlaceCount: number;
  totalWalkingDurationSeconds: number;
  places: SchedulePlaceDetailResponse[];
}

export interface ScheduleDateResponse {
  date: string;
  totalScheduleCount: number;
  schedules: ScheduleDetailResponse[];
}

export interface ScheduleDeleteRequest {
  scheduleIds: number[];
}

/** 도보시간 매트릭스를 계산하고 최근접 이웃 알고리즘으로 장소를 자동 정렬한 미리보기를 받는다. */
export function previewSchedule(body: SchedulePreviewRequest, accessToken: string) {
  return request<SchedulePreviewResponse>('/api/schedules/preview', { method: 'POST', body, accessToken });
}

/** 기존 일정 수정용 미리보기 — 새 matrixToken을 발급받는다. */
export function previewScheduleUpdate(scheduleId: number, body: SchedulePreviewRequest, accessToken: string) {
  return request<SchedulePreviewResponse>(`/api/schedules/${scheduleId}/preview`, {
    method: 'POST',
    body,
    accessToken,
  });
}

/** 미리보기의 matrixToken과 사용자가 확정한 순서로 일정을 저장한다. */
export function createSchedule(body: ScheduleCreateRequest, accessToken: string) {
  return request<ScheduleResponse>('/api/schedules', { method: 'POST', body, accessToken });
}

/** 미리보기에서 확정한 출발지/날짜/장소·순서로 기존 일정을 수정한다. */
export function updateSchedule(scheduleId: number, body: ScheduleCreateRequest, accessToken: string) {
  return request<ScheduleResponse>(`/api/schedules/${scheduleId}`, { method: 'PUT', body, accessToken });
}

/** 선택한 날짜의 일정과 장소별 도보 이동 정보를 조회한다. */
export function getSchedulesByDate(date: string, accessToken: string) {
  return request<ScheduleDateResponse>('/api/schedules', { accessToken, params: { date } });
}

/** 선택한 일정을 모두 삭제한다. */
export function deleteSchedules(scheduleIds: number[], accessToken: string) {
  return request<void>('/api/schedules', { method: 'DELETE', body: { scheduleIds }, accessToken });
}

// ─── 장소 제보 (Place Report) ──────────────────────────────────────────────────
export type PetPolicy = 'PET_FRIENDLY' | 'OUTDOOR_ONLY' | 'CARRIER_REQUIRED' | 'LEASH_REQUIRED';

export interface PlaceReportCreateRequest {
  placeName: string;
  address: string;
  petPolicies: PetPolicy[];
  recommendationReason?: string;
}

export type PlaceReportStatus = 'SUBMITTED' | 'IN_REVIEW' | 'COMPLETED';

export interface PlaceReportCreateResponse {
  placeReportId: number;
  status: PlaceReportStatus;
  imageUrl: string | null;
  submittedAt: string;
}

/** 장소 정보와 선택 사진을 첨부하여 새로운 장소를 제보한다. */
export function createPlaceReport(
  body: PlaceReportCreateRequest,
  accessToken: string,
  imageUri?: string | null
) {
  return requestMultipart<PlaceReportCreateResponse>('/api/place-reports', 'POST', body, accessToken, imageUri);
}

// ─── 문의 (Inquiry) ────────────────────────────────────────────────────────────
export interface InquiryCreateRequest {
  title: string;
  content: string;
}

export type InquiryStatus = 'SUBMITTED' | 'IN_REVIEW' | 'COMPLETED';

export interface InquiryCreateResponse {
  inquiryId: number;
  status: InquiryStatus;
  submittedAt: string;
}

/** 제목과 문의 내용을 입력하여 문의를 접수한다. */
export function createInquiry(body: InquiryCreateRequest, accessToken: string) {
  return request<InquiryCreateResponse>('/api/inquiries', { method: 'POST', body, accessToken });
}
