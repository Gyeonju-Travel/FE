import { Image as RNImage, Platform } from 'react-native';
import { MapPlace } from '@/types/map';

const pinCafeAsset = require('@/assets/icons/pin_cafe.png');
const pinRestaurantAsset = require('@/assets/icons/pin_restaurant.png');
const pinTourAsset = require('@/assets/icons/pin_tour.png');
const currentLocationAsset = require('@/assets/icons/current-location.png');

function resolveUri(asset: unknown): string {
  return Platform.OS === 'web'
    ? (asset as { uri: string }).uri
    : RNImage.resolveAssetSource(asset as number).uri;
}

export const currentLocationUri = resolveUri(currentLocationAsset);

export const categoryPinUri: Record<MapPlace['category'], string> = {
  카페: resolveUri(pinCafeAsset),
  식당: resolveUri(pinRestaurantAsset),
  관광지: resolveUri(pinTourAsset),
};
