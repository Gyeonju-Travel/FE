import AsyncStorage from '@react-native-async-storage/async-storage';
import { PetPersonality } from '@/utils/api';

// TODO: 백엔드 PetDetailResponse가 personality를 배열로 내려주기 시작하면 이 로컬 저장은 걷어내고
// 서버 값을 그대로 쓴다. 지금은 온보딩 완료 응답에만 성향 2개가 담겨 오고, 이후 조회(GET /api/pets/{id})는
// 성향 1개만 내려오기 때문에 온보딩 시점에 로컬로 캐싱해서 조합 뱃지를 계속 보여준다.
const KEY_PREFIX = 'gyeonjutravel.petPersonalityCombo.';

export async function savePetPersonalityCombo(
  petId: string | number,
  personalities: PetPersonality[]
): Promise<void> {
  await AsyncStorage.setItem(`${KEY_PREFIX}${petId}`, JSON.stringify(personalities));
}

export async function getPetPersonalityCombo(petId: string | number): Promise<PetPersonality[] | null> {
  const raw = await AsyncStorage.getItem(`${KEY_PREFIX}${petId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PetPersonality[]) : null;
  } catch {
    return null;
  }
}
