import AsyncStorage from '@react-native-async-storage/async-storage';

export type UpdateNewsCategory = '점검' | '업데이트' | '안내';

export interface UpdateNewsItem {
  id: string;
  category: UpdateNewsCategory;
  title: string;
  description: string;
  date: string;
}

// TODO: 실제 공지사항 API가 생기면 이 정적 목록을 대체한다.
export const UPDATE_NEWS: UpdateNewsItem[] = [];

const READ_IDS_KEY = 'gyeonjutravel.readUpdateNewsIds';

export async function getReadUpdateNewsIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(READ_IDS_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

export async function markUpdateNewsRead(id: string): Promise<void> {
  const ids = await getReadUpdateNewsIds();
  if (ids.has(id)) return;
  ids.add(id);
  await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify([...ids]));
}

export async function hasUnreadUpdateNews(): Promise<boolean> {
  const readIds = await getReadUpdateNewsIds();
  return UPDATE_NEWS.some((item) => !readIds.has(item.id));
}
