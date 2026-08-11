import type { FC } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Stamp01Welcome from '@/assets/mypage/stamps/stamp-01-welcome.svg';
import Stamp02Gyochon from '@/assets/mypage/stamps/stamp-02-gyochon.svg';
import Stamp03Hwangridan from '@/assets/mypage/stamps/stamp-03-hwangridan.svg';
import Stamp04Gyerim from '@/assets/mypage/stamps/stamp-04-gyerim.svg';
import Stamp05Woljeonggyo from '@/assets/mypage/stamps/stamp-05-woljeonggyo.svg';
import Stamp06Eupseong from '@/assets/mypage/stamps/stamp-06-eupseong.svg';
import Stamp07Cheomseongdae from '@/assets/mypage/stamps/stamp-07-cheomseongdae.svg';
import Stamp08Complete from '@/assets/mypage/stamps/stamp-08-complete.svg';
import Stamp09Master from '@/assets/mypage/stamps/stamp-09-master.svg';
import Stamp10Locked from '@/assets/mypage/stamps/stamp-10-locked.svg';

export type StampIcon = FC<{ width?: number | string; height?: number | string }>;

// 1번(웰컴)은 회원가입 시 지급. 2~7번은 아래 GEOFENCE_ATTRACTIONS에 매핑된 실제 관광지에
// 도착하면 그 자리에서 지급. 8번(완벽한여행)은 하루 일정을 전부 완주하면 지급, 9번(경주마스터)은
// 2~7번(관광지 6개)을 모두 모으면 자동 지급.
export const STAMP_ICONS: StampIcon[] = [
  Stamp01Welcome,
  Stamp02Gyochon,
  Stamp03Hwangridan,
  Stamp04Gyerim,
  Stamp05Woljeonggyo,
  Stamp06Eupseong,
  Stamp07Cheomseongdae,
  Stamp08Complete,
  Stamp09Master,
];
export const STAMP_LOCKED_ICON: StampIcon = Stamp10Locked;
export const TOTAL_STAMP_COUNT = STAMP_ICONS.length;

// STAMP_ICONS의 인덱스(0-based) 기준. 좌표는 실제 배포 서버의 /api/places 검색 결과에서
// 가져왔다 (2026-08-10 기준). 황리단길은 거리 전체라 특정 place 하나로 등록돼 있지 않아서,
// 그 상권을 대표하는 실제 장소(샬로우커피 황리단길점)의 좌표를 대신 사용한다.
export interface GeofenceAttraction {
  stampIndex: number;
  name: string;
  placeId: number | null;
  latitude: number;
  longitude: number;
  /** true면 placeId가 실제 이 관광지의 상세정보가 아니라 좌표만 빌려온 대역(예: 황리단길의
   * 상권 대표 카페)이라는 뜻 — 카드를 눌렀을 때 그 장소 상세로 보내면 안 되고 지도만 이동시켜야 한다. */
  isProxyLocation?: boolean;
}

export const GEOFENCE_ATTRACTIONS: GeofenceAttraction[] = [
  { stampIndex: 1, name: '교촌마을', placeId: 64, latitude: 35.8296308266303, longitude: 129.214693367401 },
  { stampIndex: 2, name: '황리단길', placeId: 39, latitude: 35.83676179, longitude: 129.21001, isProxyLocation: true },
  { stampIndex: 3, name: '계림', placeId: 72, latitude: 35.8326469552, longitude: 129.218997827 },
  { stampIndex: 4, name: '월정교', placeId: 73, latitude: 35.8279335447, longitude: 129.2161732088 },
  { stampIndex: 5, name: '경주읍성', placeId: 81, latitude: 35.8473202021, longitude: 129.2139061887 },
  { stampIndex: 6, name: '첨성대', placeId: 82, latitude: 35.8343745291, longitude: 129.2185644826 },
];

// 8번(완벽한여행, index 7)은 하루 일정을 전부 완주했을 때 지급 — locationTracking.ts가
// 일정 장소를 다 돌았는지 확인하고 awardStamp(PERFECT_TRIP_STAMP_INDEX)를 직접 호출한다.
export const PERFECT_TRIP_STAMP_INDEX = 7;
// 9번(경주마스터, index 8)은 관광지 스탬프 6개(index 1~6)를 전부 모으면 이 파일에서 자동 지급한다.
const GYEONGJU_MASTER_STAMP_INDEX = 8;
const NAMED_ATTRACTION_INDICES = GEOFENCE_ATTRACTIONS.map((a) => a.stampIndex);

const EARNED_STAMPS_KEY = 'gyeonjutravel.earnedStampIndices';

// TODO: 실제 획득 현황을 백엔드에서 내려주는 API가 생기면 이 로컬 저장 값을 대체한다.
export async function getEarnedStampIndices(): Promise<Set<number>> {
  const indices = new Set<number>([0]); // 1번(웰컴)은 항상 획득한 상태
  const raw = await AsyncStorage.getItem(EARNED_STAMPS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((n) => {
          if (typeof n === 'number' && n >= 0 && n < TOTAL_STAMP_COUNT) indices.add(n);
        });
      }
    } catch {
      // 저장된 값이 손상됐으면 웰컴 스탬프만 있는 기본 상태로 취급한다.
    }
  }
  return indices;
}

export async function getEarnedStampCount(): Promise<number> {
  const indices = await getEarnedStampIndices();
  return indices.size;
}

/** 특정 번호의 스탬프를 지급한다 (지오펜싱 도착 시 사용). 새로 지급됐으면 true. */
export async function awardStamp(stampIndex: number): Promise<boolean> {
  if (stampIndex <= 0 || stampIndex >= TOTAL_STAMP_COUNT) return false;
  const indices = await getEarnedStampIndices();
  if (indices.has(stampIndex)) return false;

  indices.add(stampIndex);
  if (NAMED_ATTRACTION_INDICES.every((i) => indices.has(i))) {
    indices.add(GYEONGJU_MASTER_STAMP_INDEX);
  }
  await AsyncStorage.setItem(EARNED_STAMPS_KEY, JSON.stringify([...indices]));
  return true;
}
