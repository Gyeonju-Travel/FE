import { GYEONGJU_NX, GYEONGJU_NY, getBaseDateTime, parseWeatherItems } from './weatherCore';

export type { GyeongjuWeather, SkyCondition } from './weatherCore';

const KMA_API_KEY = process.env.EXPO_PUBLIC_KMA_API_KEY;

/** 경주 지역의 현재(가장 가까운 예보 시각) 기온·하늘상태를 기상청 초단기예보 API로 가져온다. */
export async function fetchGyeongjuWeather() {
  if (!KMA_API_KEY) return null;

  try {
    const { baseDate, baseTime } = getBaseDateTime(new Date());
    // 발급받은 키는 공공데이터포털이 아니라 기상청 API허브(apihub.kma.go.kr) 키라서
    // 그쪽 엔드포인트와 authKey 파라미터를 써야 한다. 응답 스키마는 동일하다.
    const params = new URLSearchParams({
      authKey: KMA_API_KEY,
      pageNo: '1',
      numOfRows: '100',
      dataType: 'JSON',
      base_date: baseDate,
      base_time: baseTime,
      nx: String(GYEONGJU_NX),
      ny: String(GYEONGJU_NY),
    });
    const response = await fetch(
      `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtFcst?${params.toString()}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return parseWeatherItems(data?.response?.body?.items?.item ?? []);
  } catch {
    return null;
  }
}
