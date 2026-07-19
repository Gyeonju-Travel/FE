import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MapPlace } from '@/types/map';
import { categoryPinUri, currentLocationUri } from './kakaoMapAssets';
import { buildKakaoMapHtml } from './kakaoMapHtml';

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
  const webViewRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    zoomIn() {
      webViewRef.current?.injectJavaScript(
        'if(window.kakaoMap){window.kakaoMap.setLevel(window.kakaoMap.getLevel()-1,{animate:true});}true;'
      );
    },
    zoomOut() {
      webViewRef.current?.injectJavaScript(
        'if(window.kakaoMap){window.kakaoMap.setLevel(window.kakaoMap.getLevel()+1,{animate:true});}true;'
      );
    },
    moveTo(lat: number, lng: number) {
      webViewRef.current?.injectJavaScript(
        `if(window.kakaoMap){window.kakaoMap.panTo(new kakao.maps.LatLng(${lat},${lng}));}true;`
      );
    },
  }));

  const centerLat = markers.length > 0 ? markers[0].latitude : latitude;
  const centerLng = markers.length > 0 ? markers[0].longitude : longitude;

  const html = buildKakaoMapHtml({
    kakaoJsKey: KAKAO_JS_KEY,
    centerLat,
    centerLng,
    level,
    markers,
    categoryPinUri,
    currentLocationImageUri: currentLocationUri,
    currentLocationLat: DEFAULT_LAT,
    currentLocationLng: DEFAULT_LNG,
  });

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'markerClick') {
        onMarkerPress?.(data.id);
      } else if (data.type === 'mapClick') {
        onMapPress?.();
      }
    } catch (_) {}
  };

  return (
    <WebView
      ref={webViewRef}
      style={styles.map}
      source={{ html }}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      onMessage={handleMessage}
    />
  );
});

export default KakaoMap;

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
