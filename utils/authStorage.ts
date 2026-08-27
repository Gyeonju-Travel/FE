import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'gyeonjutravel.accessToken';
const REFRESH_TOKEN_KEY = 'gyeonjutravel.refreshToken';
const ACCOUNT_EMAIL_KEY = 'gyeonjutravel.accountEmail';

export async function saveTokens(accessToken: string, refreshToken?: string) {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, ACCOUNT_EMAIL_KEY]);
}

// 백엔드에 "내 정보 조회" API가 없어서, 로그인/회원가입 시 입력한 이메일을 로컬에 저장해두고
// 설정 > 정보 수정 화면에서 보여준다.
export async function saveAccountEmail(email: string) {
  await AsyncStorage.setItem(ACCOUNT_EMAIL_KEY, email);
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(input: string): string {
  const cleaned = input.replace(/[^A-Za-z0-9+/]/g, '');
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of cleaned) {
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

// 액세스 토큰(JWT)의 payload에는 sub 클레임으로 가입 이메일이 들어있다. 서명 검증은 하지
// 않고(백엔드가 이미 검증한 토큰이라 신뢰) 화면에 표시할 이메일만 꺼내 쓴다.
function decodeEmailFromAccessToken(token: string): string | null {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const raw = decodeBase64(base64);
    const percentEncoded = raw
      .split('')
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
    const payload = JSON.parse(decodeURIComponent(percentEncoded));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch (e) {
    return null;
  }
}

export async function getAccountEmail(): Promise<string | null> {
  const token = await getAccessToken();
  const emailFromToken = token ? decodeEmailFromAccessToken(token) : null;
  if (emailFromToken) return emailFromToken;
  return AsyncStorage.getItem(ACCOUNT_EMAIL_KEY);
}
