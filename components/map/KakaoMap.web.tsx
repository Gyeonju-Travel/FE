import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapPlace } from '@/types/map';
import { categoryPinUri, currentLocationUri } from './kakaoMapAssets';

const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY;

const DEFAULT_LAT = 35.8562;
const DEFAULT_LNG = 129.2247;

export interface KakaoMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  moveTo: (lat: number, lng: number) => void;
}

interface Props {
  latitude?: number;
  longitude?: number;
  level?: number;
  markers?: MapPlace[];
  onMarkerPress?: (id: string) => void;
  onMapPress?: () => void;
}

const KakaoMap = forwardRef<KakaoMapHandle, Props>(function KakaoMap(
  {
    latitude = DEFAULT_LAT,
    longitude = DEFAULT_LNG,
    level = 4,
    markers = [],
    onMarkerPress,
    onMapPress,
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
  }));

  const centerLat = markers.length > 0 ? markers[0].latitude : latitude;
  const centerLng = markers.length > 0 ? markers[0].longitude : longitude;

  const markersJson = JSON.stringify(
    markers.map((m) => ({ id: m.id, lat: m.latitude, lng: m.longitude, category: m.category }))
  );

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
      myLoc: currentLocationUri,
      myLocLat: String(DEFAULT_LAT),
      myLocLng: String(DEFAULT_LNG),
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
        }
      } catch (_) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMarkerPress, onMapPress]);

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
