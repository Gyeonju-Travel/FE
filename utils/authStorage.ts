import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'gyeonjutravel.accessToken';
const REFRESH_TOKEN_KEY = 'gyeonjutravel.refreshToken';

export async function saveTokens(accessToken: string, refreshToken?: string) {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}
