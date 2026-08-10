import { GYEONGJU_NX, GYEONGJU_NY, getBaseDateTime, parseWeatherItems } from './weatherCore';

export type { GyeongjuWeather, SkyCondition } from './weatherCore';

// 기상청 API허브(apihub.kma.go.kr)는 브라우저 CORS를 허용하지 않아서 웹에서 직접 fetch하면
// 무조건 실패한다. 대신 같은 오리진의 /api/weather 서버리스 함수(api/weather.ts)를 거쳐 받아온다.
export async function fetchGyeongjuWeather() {
  try {
    const { baseDate, baseTime } = getBaseDateTime(new Date());
    const params = new URLSearchParams({
      base_date: baseDate,
      base_time: baseTime,
      nx: String(GYEONGJU_NX),
      ny: String(GYEONGJU_NY),
    });
    const response = await fetch(`/api/weather?${params.toString()}`);
    if (!response.ok) return null;
    const data = await response.json();
    return parseWeatherItems(data?.response?.body?.items?.item ?? []);
  } catch {
    return null;
  }
}
