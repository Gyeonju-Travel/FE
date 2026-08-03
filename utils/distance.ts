const EARTH_RADIUS_M = 6371000;
const WALK_METERS_PER_MIN = 70;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 두 좌표 사이의 직선 거리 (m). 실제 도보 경로가 아닌 근사치. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/** 직선 거리 기반 도보 소요 시간(분) 근사치. */
export function estimateWalkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_METERS_PER_MIN));
}

/** 1000m 이상이면 km 단위로 표시. */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${Math.round(meters)}m`;
}

/** 총 도보 소요 시간(분)을 "n시간 m분" 또는 "n분" 형태로 표시. */
export function formatWalkDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}분`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}
