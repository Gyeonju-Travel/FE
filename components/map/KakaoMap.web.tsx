import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapPlace } from '@/types/map';
import {
  categoryPinUri,
  categoryPinUriSaved,
  currentLocationUri,
  routeStartPinUri,
  routeNumberPinUris,
} from './kakaoMapAssets';
import { RouteMapPlace, RoutePathPoint } from './kakaoMapHtml';

const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY;

const DEFAULT_LAT = 35.8562;
const DEFAULT_LNG = 129.2247;

export interface KakaoMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  moveTo: (lat: number, lng: number) => void;
  updateMyLocation: (lat: number, lng: number) => void;
}

interface Props {
  latitude?: number;
  longitude?: number;
  level?: number;
  markers?: MapPlace[];
  /** 저장(하트)한 장소 id 목록. 세이지 그린 핀으로 표시된다. */
  likedPlaceIds?: string[];
  currentLocation?: { lat: number; lng: number } | null;
  routePlaces?: RouteMapPlace[];
  routePath?: RoutePathPoint[];
  onMarkerPress?: (id: string) => void;
  onMapPress?: () => void;
  onMapReady?: () => void;
}

const KakaoMap = forwardRef<KakaoMapHandle, Props>(function KakaoMap(
  {
    latitude = DEFAULT_LAT,
    longitude = DEFAULT_LNG,
    level = 4,
    markers = [],
    likedPlaceIds = [],
    currentLocation = null,
    routePlaces = [],
    routePath = [],
    onMarkerPress,
    onMapPress,
    onMapReady,
  },
  ref
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const postToIframe = (data: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(data), '*');
  };

  useImperativeHandle(ref, () => ({
    zoomIn() {
      postToIframe({ type: 'zoomIn' });
    },
    zoomOut() {
      postToIframe({ type: 'zoomOut' });
    },
    moveTo(lat: number, lng: number) {
      postToIframe({ type: 'moveTo', lat, lng });
    },
    updateMyLocation(lat: number, lng: number) {
      postToIframe({ type: 'updateMyLocation', lat, lng });
    },
  }));

  const centerLat = routePlaces.length > 0
    ? routePlaces[0].lat
    : markers.length > 0 ? markers[0].latitude : latitude;
  const centerLng = routePlaces.length > 0
    ? routePlaces[0].lng
    : markers.length > 0 ? markers[0].longitude : longitude;

  const likedPlaceIdSet = new Set(likedPlaceIds);
  const markersJson = JSON.stringify(
    markers.map((m) => ({
      id: m.id,
      lat: m.latitude,
      lng: m.longitude,
      category: m.category,
      liked: likedPlaceIdSet.has(m.id),
    }))
  );
  const routePlacesJson = JSON.stringify(routePlaces);
  const routePathJson = JSON.stringify(routePath);

  const src =
    '/kakao-map.html?' +
    new URLSearchParams({
      key: KAKAO_JS_KEY ?? '',
      lat: String(centerLat),
      lng: String(centerLng),
      level: String(level),
      markers: markersJson,
      pinCafe: categoryPinUri['카페'],
      pinRestaurant: categoryPinUri['식당'],
      pinTour: categoryPinUri['관광지'],
      pinCafeSaved: categoryPinUriSaved['카페'],
      pinRestaurantSaved: categoryPinUriSaved['식당'],
      pinTourSaved: categoryPinUriSaved['관광지'],
      myLoc: currentLocationUri,
      ...(currentLocation
        ? { myLocLat: String(currentLocation.lat), myLocLng: String(currentLocation.lng) }
        : {}),
      routePlaces: routePlacesJson,
      routeStartPin: routeStartPinUri,
      routeNumberPins: JSON.stringify(routeNumberPinUris),
      routePath: routePathJson,
    }).toString();

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'markerClick') {
          onMarkerPress?.(data.id);
        } else if (data.type === 'mapClick') {
          onMapPress?.();
        } else if (data.type === 'mapReady') {
          onMapReady?.();
        }
      } catch (_) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMarkerPress, onMapPress, onMapReady]);

  return (
    <View style={styles.map}>
      <iframe
        ref={iframeRef}
        src={src}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </View>
  );
});

export default KakaoMap;

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
