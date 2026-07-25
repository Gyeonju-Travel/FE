import { Image as RNImage, Platform } from 'react-native';
import { MapPlace } from '@/types/map';

const pinCafeAsset = require('@/assets/pin/pin_cafe.png');
const pinRestaurantAsset = require('@/assets/pin/pin_restaurant.png');
const pinTourAsset = require('@/assets/pin/pin_tour.png');
const pinStartAsset = require('@/assets/pin/pin_start.png');
const pinNumberAssets = [
  require('@/assets/pin/pin_1.png'),
  require('@/assets/pin/pin_2.png'),
  require('@/assets/pin/pin_3.png'),
  require('@/assets/pin/pin_4.png'),
  require('@/assets/pin/pin_5.png'),
];
const currentLocationAsset = require('@/assets/icons/current-location.png');

function resolveUri(asset: unknown): string {
  return Platform.OS === 'web'
    ? (asset as { uri: string }).uri
    : RNImage.resolveAssetSource(asset as number).uri;
}

export const currentLocationUri = resolveUri(currentLocationAsset);
/** 경로보기 지도의 출발지 핀. */
export const routeStartPinUri = resolveUri(pinStartAsset);
/** 경로보기 지도의 목적지 핀 (1~5번, 방문 순서대로). */
export const routeNumberPinUris = pinNumberAssets.map(resolveUri);

export const categoryPinUri: Record<MapPlace['category'], string> = {
  카페: resolveUri(pinCafeAsset),
  식당: resolveUri(pinRestaurantAsset),
  관광지: resolveUri(pinTourAsset),
};
