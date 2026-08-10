// 경주시청 기준 기상청 격자 좌표 (전국 5km 격자, LCC 투영법으로 변환한 값). 경주 날씨만 다루므로 고정값 사용.
export const GYEONGJU_NX = 101;
export const GYEONGJU_NY = 92;

export type SkyCondition = 'sunny' | 'cloudy' | 'overcast' | 'rain' | 'snow' | 'sleet';

export interface GyeongjuWeather {
  temperatureC: number;
  sky: SkyCondition;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 초단기예보(getUltraSrtFcst) 발표시각은 매시 30분 생성, :45 이후부터 조회 가능. */
export function getBaseDateTime(now: Date): { baseDate: string; baseTime: string } {
  const base = new Date(now);
  if (base.getMinutes() < 45) {
    base.setHours(base.getHours() - 1);
  }
  const baseDate = `${base.getFullYear()}${pad2(base.getMonth() + 1)}${pad2(base.getDate())}`;
  const baseTime = `${pad2(base.getHours())}30`;
  return { baseDate, baseTime };
}

export function skyFromCodes(sky: string, pty: string): SkyCondition {
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

/** 기상청 응답의 item 배열에서 가장 가까운 예보 시각의 기온·하늘상태를 뽑아낸다. */
export function parseWeatherItems(items: any[]): GyeongjuWeather | null {
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
}
