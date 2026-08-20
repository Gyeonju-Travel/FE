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

// 사진 여러 장을 "photos" 파트 여러 개로 보내는 전용 멀티파트 요청 (JSON "request" 파트가 없는 형태).
async function requestPhotosMultipart<T>(
  path: string,
  photoUris: string[],
  accessToken: string
): Promise<T> {
  if (!API_BASE_URL) {
    console.error('[API] EXPO_PUBLIC_API_BASE_URL이 설정되지 않았습니다. .env를 확인하세요.');
    throw new ApiError('서버 주소가 설정되지 않았어요.', 'NO_API_BASE_URL');
  }

  console.log(`[API →] POST ${path} (multipart, photos: ${photoUris.length})`);

  const form = new FormData();
  for (const uri of photoUris) {
    const extension = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
    const rawBlob = await readLocalFileAsBlob(uri);
    const photoBlob = new Blob([rawBlob], { type: mimeType });
    form.append('photos', photoBlob, `photo.${extension}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
  } catch (networkError) {
    console.error(`[API ✕ 네트워크 오류] POST ${path}`, networkError);
    throw networkError;
  }

  const text = await response.text();
  const json: ApiEnvelope<T> | null = text ? JSON.parse(text) : null;

  console.log(`[API ←] ${response.status} POST ${path}`, json ?? text);

  if (!response.ok || !json || !json.isSuccess) {
    console.error(`[API ✕ 실패] POST ${path}`, {
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

export interface TermsAgreementRequest {
  termsOfServiceAgreed: boolean;
  privacyPolicyAgreed: boolean;
  locationServiceAgreed: boolean;
  ageOverFourteenAgreed: boolean;
}

export interface TermsAgreementResponse {
  agreementToken: string;
}

/** 회원가입 전 약관 동의 체크를 서버에 기록하고, 가입 요청에 넣을 토큰을 발급받는다. */
export function agreeToTerms(body: TermsAgreementRequest) {
  return request<TermsAgreementResponse>('/api/auth/terms/agreement', { method: 'POST', body });
}

export interface SignUpRequest {
  email: string;
  password: string;
  passwordConfirmation: string;
  name: string;
  birthDate: string;
  gender: Gender;
  phoneNumber: string;
  /** POST /api/auth/terms/agreement 로 발급받은 토큰. */
  termsAgreementToken: string;
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
  /** 항상 2개(대표/부 성향)가 내려온다. */
  personality: PetPersonality[];
}

export interface PetRegistrationRequest {
  name: string;
  breed: string;
  size: PetSize;
  age: number;
  gender: PetGender;
  /** 정확히 2개를 보내야 한다 (서버 @Size(min=2, max=2) 검증). */
  personality: PetPersonality[];
}

export type PetProfileUpdateRequest = PetRegistrationRequest;

export function getMyPets(accessToken: string) {
  return request<PetListResponse>('/api/pets', { accessToken });
}

export function getPetDetail(petId: number, accessToken: string) {
  return request<PetDetailResponse>(`/api/pets/${petId}`, { accessToken });
}

/** 선택한 반려견을 대표 반려견으로 변경하고 갱신된 반려견 목록을 반환한다. */
export function changeRepresentativePet(petId: number, accessToken: string) {
  return request<PetListResponse>(`/api/pets/${petId}/representative`, { method: 'PATCH', accessToken });
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

// ─── 홈 (Home) ──────────────────────────────────────────────────────────────────
export interface HomePlaceResponse {
  placeId: number;
  placeName: string;
  imageUrl: string | null;
  longitude: number;
  latitude: number;
}

export interface HomeResponse {
  petName: string;
  petProfileImageUrl: string | null;
  petPersonalities: PetPersonality[];
  footprintCount: number;
  stampNames: string[];
  places: HomePlaceResponse[];
}

/** 대표 반려견, 발자국 개수, 획득 스탬프 3개, 관광지 6개를 한 번에 조회한다. */
export function getHome(accessToken: string) {
  return request<HomeResponse>('/api/home', { accessToken });
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
  lastPlaceName: string | null;
  totalPlaceCount: number;
  totalWalkingDurationSeconds: number;
  places: SchedulePlaceDetailResponse[];
  started: boolean;
  startedAt: string | null;
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

export interface ScheduleStartResponse {
  scheduleId: number;
  date: string;
  started: boolean;
  startedAt: string | null;
  departure: DepartureResponse;
  places: SchedulePlaceDetailResponse[];
}

/** 선택한 일정을 시작 상태로 바꾸고 시작 시각을 서버에 저장한다. 이 호출 이전에는
 * 발자국/관광지 방문 기록(POST .../footprints, .../visits)이 서버에서 거부된다. */
export function startSchedule(scheduleId: number, accessToken: string) {
  return request<ScheduleStartResponse>(`/api/schedules/${scheduleId}/start`, { method: 'POST', accessToken });
}

/** 시작했던 일정을 취소해서 서버의 started 상태를 되돌린다. 이걸 안 부르면 서버는 이 일정을
 * 계속 "시작됨"으로 보고, 날짜가 지나거나 21시가 지나면 앱에서 영구히 "기록보기"로 고정되고
 * 21시 알림 대상에서도 계속 잡힌다. */
export function cancelStartSchedule(scheduleId: number, accessToken: string) {
  return request<ScheduleStartResponse>(`/api/schedules/${scheduleId}/start`, { method: 'DELETE', accessToken });
}

/** 선택한 일정을 모두 삭제한다. */
export function deleteSchedules(scheduleIds: number[], accessToken: string) {
  return request<void>('/api/schedules', { method: 'DELETE', body: { scheduleIds }, accessToken });
}

// ─── 추천 경로 (Recommended Route) ──────────────────────────────────────────────
export type DogCondition = 'BAD' | 'NORMAL' | 'BEST';
export type RecommendedRouteStatus = 'CREATING' | 'COMPLETED' | 'FAILED';
export type RecommendedRouteStep =
  | 'DEPARTURE_ANALYZING'
  | 'COURSE_SEARCHING'
  | 'CONDITION_CHECKING'
  | 'ROUTE_COMPLETED';

export interface RecommendedRouteRequest {
  departureArea: DepartureArea;
  date: string; // YYYY-MM-DD
  condition: DogCondition;
}

export interface RecommendedRouteJobResponse {
  recommendationId: number;
  status: RecommendedRouteStatus;
}

export interface RecommendedRouteStatusResponse {
  recommendationId: number;
  status: RecommendedRouteStatus;
  step: RecommendedRouteStep | null;
  message: string | null;
  errorMessage: string | null;
}

export interface RecommendedRoutePlaceResponse {
  visitOrder: number;
  placeId: number;
  name: string;
  category: PlaceCategoryCode;
  categoryLabel: string;
  imageUrl: string | null;
  petAccessType: string | null;
  petRequirements: string | null;
  walkingDurationSeconds: number;
  walkingDistanceMeters: number;
}

export interface RecommendedRouteResultResponse {
  recommendationId: number;
  date: string;
  departure: DepartureResponse;
  recommendedPlaces: RecommendedRoutePlaceResponse[];
}

/** 출발지/날짜/오늘 컨디션을 입력받아 AI 추천 경로 생성 작업을 비동기로 시작한다. */
export function createRecommendedRoute(body: RecommendedRouteRequest, accessToken: string) {
  return request<RecommendedRouteJobResponse>('/api/recommend-routes', { method: 'POST', body, accessToken });
}

/** 추천 경로 생성 작업의 진행 상태(step/message)만 조회한다. 완료될 때까지 폴링한다. */
export function getRecommendedRouteStatus(recommendationId: number, accessToken: string) {
  return request<RecommendedRouteStatusResponse>(`/api/recommend-routes/${recommendationId}`, { accessToken });
}

/** 생성이 완료된 뒤 추천 장소 목록과 구간별 도보 시간/거리를 조회한다. */
export function getRecommendedRouteResult(recommendationId: number, accessToken: string) {
  return request<RecommendedRouteResultResponse>(`/api/recommend-routes/${recommendationId}/result`, {
    accessToken,
  });
}

/** 추천 경로 결과를 그대로 실제 일정으로 저장한다. */
export function saveRecommendedRouteSchedule(recommendationId: number, accessToken: string) {
  return request<ScheduleResponse>(`/api/recommend-routes/${recommendationId}/schedule`, {
    method: 'POST',
    accessToken,
  });
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

// ─── 스탬프 앨범 (Stamp Album) ──────────────────────────────────────────────────
export interface PlaceVisitRequest {
  scheduleId: number;
  longitude: number;
  latitude: number;
}

export interface PlaceVisitResponse {
  visitId: number;
  scheduleId: number;
  stampName: string;
  visitedAt: string;
}

/** 현재 좌표가 관광지 40m 이내면 방문으로 인정하고 스탬프 방문 기록을 저장한다. */
export function visitPlace(placeId: number, body: PlaceVisitRequest, accessToken: string) {
  return request<PlaceVisitResponse>(`/api/places/${placeId}/visits`, { method: 'POST', body, accessToken });
}

export interface ScheduleFootprintResponse {
  scheduleId: number;
  totalDistanceMeters: number;
  footprintCount: number;
}

/** 앱이 로컬에서 누적한 증가 이동거리를 해당 일정의 앨범에 더한다. */
export function addScheduleFootprints(scheduleId: number, distanceMeters: number, accessToken: string) {
  return request<ScheduleFootprintResponse>(`/api/schedules/${scheduleId}/stamp-album/footprints`, {
    method: 'POST',
    body: { distanceMeters },
    accessToken,
  });
}

export interface StampAlbumResponse {
  scheduleId: number;
  date: string;
  petId: number;
  petName: string;
  petProfileImageUrl: string | null;
  footprintCount: number;
  totalDistanceMeters: number;
  stampName: string;
  photoUrls: string[];
}

/** 선택한 일정의 발자국 개수, 누적 거리, 사진, 획득 스탬프 이름을 조회한다. */
export function getStampAlbum(scheduleId: number, accessToken: string) {
  return request<StampAlbumResponse>(`/api/schedules/${scheduleId}/stamp-album`, { accessToken });
}

/** 일정 종료 화면에서 선택한 사진(최대 2장)을 저장한다. */
export function saveStampAlbumPhotos(scheduleId: number, photoUris: string[], accessToken: string) {
  return requestPhotosMultipart<StampAlbumResponse>(
    `/api/schedules/${scheduleId}/stamp-album/photos`,
    photoUris,
    accessToken
  );
}

export interface MyPageStampItemResponse {
  stampName: string;
  count: number;
}

export interface MyPageStampsResponse {
  totalStampCount: number;
  stamps: MyPageStampItemResponse[];
}

/** 사용자가 얻은 스탬프 목록을 조회한다. */
export function getMyPageStamps(accessToken: string) {
  return request<MyPageStampsResponse>('/api/my-page/stamps', { accessToken });
}

export interface TravelRecordItemResponse {
  scheduleId: number;
  date: string;
  title: string | null;
  photoUrl: string | null;
  totalPlaceCount: number;
  totalWalkingDurationSeconds: number;
}

export interface TravelRecordsResponse {
  totalTravelCount: number;
  totalVisitedPlaceCount: number;
  totalStampCount: number;
  records: TravelRecordItemResponse[];
}

/** 완료된 일정(스크랩 앨범 마무리된 것)을 여행 기록 목록으로 조회한다. */
export function getTravelRecords(accessToken: string) {
  return request<TravelRecordsResponse>('/api/my-page/travel-records', { accessToken });
}

// ─── 약관 (Terms) ──────────────────────────────────────────────────────────────
export interface TermsItemResponse {
  code: string;
  title: string;
  required: boolean;
}

export interface SignUpTermsResponse {
  terms: TermsItemResponse[];
}

/** 마이페이지에서 동의한 약관 목록을 조회한다. */
export function getMyPageTerms(accessToken: string) {
  return request<SignUpTermsResponse>('/api/my-page/terms', { accessToken });
}

// ─── 알림 (Notification) ──────────────────────────────────────────────────────
// 주의: NotificationListItemResponse엔 아직 title/body/type이 안 내려온다(백엔드 확인 필요).
// 그래서 목록 화면에서는 어떤 알림인지 내용을 못 보여주고 읽음 여부만 다룰 수 있다.
export interface NotificationListItemResponse {
  notificationId: number;
  read: boolean;
  readAt: string | null;
}

export interface NotificationListResponse {
  unreadCount: number;
  notifications: NotificationListItemResponse[];
}

/** 이 회원에게 온 개인 알림 목록을 조회한다. */
export function getNotifications(accessToken: string) {
  return request<NotificationListResponse>('/api/notifications', { accessToken });
}

/** 알림 하나를 읽음 처리한다. */
export function markNotificationRead(notificationId: number, accessToken: string) {
  return request<NotificationListItemResponse>(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    accessToken,
  });
}

/** 현재 기기의 FCM 토큰을 서버에 등록한다 — 이 회원에게 스탬프 앨범 준비 등 서버 발 푸시가
 * 오려면 먼저 이 토큰이 등록돼 있어야 한다. */
export function registerFcmToken(token: string, accessToken: string) {
  return request<void>('/api/notifications/fcm-token', { method: 'POST', body: { token }, accessToken });
}

/** 로그아웃 시 현재 기기의 FCM 토큰을 서버에서 삭제한다 — 안 지우면 로그아웃한 기기가
 * 이전 계정 앞으로 온 푸시를 계속 받게 된다. */
export function deleteFcmToken(token: string, accessToken: string) {
  return request<void>('/api/notifications/fcm-token', { method: 'DELETE', body: { token }, accessToken });
}
