const KMA_API_KEY = process.env.EXPO_PUBLIC_KMA_API_KEY;

// 경주시청 기준 기상청 격자 좌표 (전국 5km 격자, LCC 투영법으로 변환한 값). 경주 날씨만 다루므로 고정값 사용.
const GYEONGJU_NX = 101;
const GYEONGJU_NY = 92;

export type SkyCondition = 'sunny' | 'cloudy' | 'overcast' | 'rain' | 'snow' | 'sleet';

export interface GyeongjuWeather {
  temperatureC: number;
  sky: SkyCondition;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 초단기예보(getUltraSrtFcst) 발표시각은 매시 30분 생성, :45 이후부터 조회 가능. */
function getBaseDateTime(now: Date): { baseDate: string; baseTime: string } {
  const base = new Date(now);
  if (base.getMinutes() < 45) {
    base.setHours(base.getHours() - 1);
  }
  const baseDate = `${base.getFullYear()}${pad2(base.getMonth() + 1)}${pad2(base.getDate())}`;
  const baseTime = `${pad2(base.getHours())}30`;
  return { baseDate, baseTime };
}

function skyFromCodes(sky: string, pty: string): SkyCondition {
  switch (pty) {
    case '1':
    case '4':
    case '5':
      return 'rain';
    case '2':
    case '6':
      return 'sleet';
    case '3':
    case '7':
      return 'snow';
  }
  switch (sky) {
    case '3':
      return 'cloudy';
    case '4':
      return 'overcast';
    default:
      return 'sunny';
  }
}

/** 경주 지역의 현재(가장 가까운 예보 시각) 기온·하늘상태를 기상청 초단기예보 API로 가져온다. */
export async function fetchGyeongjuWeather(): Promise<GyeongjuWeather | null> {
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
    const items: any[] = data?.response?.body?.items?.item ?? [];
    if (items.length === 0) return null;

    // 가장 이른 예보 시각(fcstDate+fcstTime) 하나만 사용 = 사실상 '지금' 날씨.
    const earliest = items.reduce((min, cur) =>
      `${cur.fcstDate}${cur.fcstTime}` < `${min.fcstDate}${min.fcstTime}` ? cur : min
    );
    const nearestKey = `${earliest.fcstDate}${earliest.fcstTime}`;
    const nearestItems = items.filter((it: any) => `${it.fcstDate}${it.fcstTime}` === nearestKey);

    const byCategory = Object.fromEntries(nearestItems.map((it: any) => [it.category, it.fcstValue]));
    if (!byCategory.T1H) return null;

    return {
      temperatureC: Math.round(Number(byCategory.T1H)),
      sky: skyFromCodes(byCategory.SKY ?? '1', byCategory.PTY ?? '0'),
    };
  } catch {
    return null;
  }
}
