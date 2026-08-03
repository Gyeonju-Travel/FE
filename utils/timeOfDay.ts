export type GradientColors = readonly [string, string, ...string[]];
export type GradientLocations = readonly [number, number, ...number[]];

export interface SkyGradient {
  colors: GradientColors;
  locations?: GradientLocations;
}

export type TimeBucket = 'morning' | 'day' | 'dusk' | 'night';

export function getTimeBucket(hour: number): TimeBucket {
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

/** 시간대별 하늘 색 (위쪽 → 아래쪽 그라데이션) */
export function getSkyGradient(hour: number): SkyGradient {
  switch (getTimeBucket(hour)) {
    case 'morning':
      return { colors: ['#AEE0F7', '#EAF6FD'] };
    case 'day':
      return { colors: ['#7EC8F0', '#FFFFFF'] }; // 하늘색 → 흰색
    case 'dusk':
      // 남색 → 보라 → 뮤트 핑크 → 피치오렌지
      return {
        colors: ['#2B3467', '#6E6C9C', '#C79BAA', '#E8A97C'],
        locations: [0, 0.42, 0.7, 1],
      };
    case 'night':
      // 거의 검정 → 남색 → 별빛 보라
      return {
        colors: ['#030312', '#150F35', '#332264', '#493274'],
        locations: [0, 0.45, 0.75, 1],
      };
  }
}

export function isDaytime(hour: number) {
  const bucket = getTimeBucket(hour);
  return bucket === 'morning' || bucket === 'day';
}

export function isNight(hour: number) {
  return getTimeBucket(hour) === 'night';
}
