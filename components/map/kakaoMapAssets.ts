import { Image as RNImage, Platform } from 'react-native';

const pinAsset = require('@/assets/icons/pin.png');
const currentLocationAsset = require('@/assets/icons/current-location.png');

export const pinUri =
  Platform.OS === 'web'
    ? (pinAsset as { uri: string }).uri
    : RNImage.resolveAssetSource(pinAsset).uri;

export const currentLocationUri =
  Platform.OS === 'web'
    ? (currentLocationAsset as { uri: string }).uri
    : RNImage.resolveAssetSource(currentLocationAsset).uri;
