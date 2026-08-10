import { PetPersonality } from '@/utils/api';

// 성향 2개 조합 → 표시 문구. 디자인 시안 기준 12개 조합 (6개 성향 중 3쌍은 시안에 없어 정의돼 있지 않음).
// 키는 두 성향을 알파벳순으로 정렬해 "A+B" 형태로 만든다 (선택 순서 상관없이 항상 같은 키가 나오도록).
const COMBO_LABELS: Record<string, string> = {
  'RELAXED+SHYNESS': '조용한 산책가', // 낯가림 + 느긋함
  'SENSITIVITY+SHYNESS': '섬세한 관찰자', // 낯가림 + 예민함
  'CURIOSITY+SHYNESS': '수줍은 탐험가', // 낯가림 + 호기심
  'ACTIVE+SHYNESS': '조용한 모험가', // 낯가림 + 활동적
  'FRIENDLY+RELAXED': '여유로운 친구', // 느긋함 + 사교적
  'CURIOSITY+RELAXED': '느긋한 탐색가', // 느긋함 + 호기심
  'FRIENDLY+SENSITIVITY': '다정한 관찰자', // 사교적 + 예민함
  'CURIOSITY+FRIENDLY': '다정한 탐험가', // 사교적 + 호기심
  'ACTIVE+FRIENDLY': '활발한 분위기왕', // 사교적 + 활동적
  'CURIOSITY+SENSITIVITY': '예리한 탐색가', // 예민함 + 호기심
  'ACTIVE+SENSITIVITY': '민첩한 행동파', // 예민함 + 활동적
  'ACTIVE+CURIOSITY': '활발한 탐험가', // 호기심 + 활동적
};

function comboKey(a: PetPersonality, b: PetPersonality): string {
  return [a, b].sort().join('+');
}

/** 성향 2개 조합에 대응하는 표시 문구를 반환한다. 조합이 시안에 없거나 성향이 2개가 아니면 null. */
export function getPersonalityComboLabel(personalities: PetPersonality[] | null | undefined): string | null {
  if (!personalities || personalities.length < 2) return null;
  const [a, b] = personalities;
  if (a === b) return null;
  return COMBO_LABELS[comboKey(a, b)] ?? null;
}
