// 홈 "관광지 살펴보기"와 지도 검색 "관광지" 카테고리에 공통으로 노출할 장소 6곳.
// 이름에 포함만 되면 매칭한다(예: "경주 첨성대"도 "첨성대"로 매칭).
export const MAIN_ATTRACTION_NAMES = ['교촌마을', '황리단길', '계림', '월정교', '경주읍성', '첨성대'];
export function isMainAttraction(name: string): boolean {
  return MAIN_ATTRACTION_NAMES.some((n) => name.includes(n));
}

// 그 중에서도 BEST 뱃지를 붙이고 맨 위로 올릴 장소들.
export const BEST_ATTRACTION_NAMES = ['첨성대', '교촌마을', '황리단길'];
export function isBestAttraction(name: string): boolean {
  return BEST_ATTRACTION_NAMES.some((n) => name.includes(n));
}
