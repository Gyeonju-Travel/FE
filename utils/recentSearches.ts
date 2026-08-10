import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_SEARCHES_KEY = 'gyeonjutravel.recentSearches';
const MAX_RECENT_SEARCHES = 10;

export async function getRecentSearches(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** 최근 검색어 맨 앞에 추가한다 (중복 제거, 최대 개수 유지). */
export async function addRecentSearch(term: string): Promise<string[]> {
  const trimmed = term.trim();
  if (!trimmed) return getRecentSearches();
  const current = await getRecentSearches();
  const next = [trimmed, ...current.filter((t) => t !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
  await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

export async function removeRecentSearch(term: string): Promise<string[]> {
  const current = await getRecentSearches();
  const next = current.filter((t) => t !== term);
  await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
}
