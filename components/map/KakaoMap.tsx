import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MapPlace } from '@/types/map';
import {
  categoryPinUri,
  categoryPinUriSaved,
  currentLocationUri,
  routeStartPinUri,
  routeNumberPinUris,
} from './kakaoMapAssets';
import { buildKakaoMapHtml, RouteMapPlace, RoutePathPoint } from './kakaoMapHtml';

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
    updateMyLocation(lat: number, lng: number) {
      webViewRef.current?.injectJavaScript(`
        if (window.kakaoMap) {
          var pos = new kakao.maps.LatLng(${lat}, ${lng});
          if (window.myLocationOverlay) {
            window.myLocationOverlay.setPosition(pos);
          } else {
            var el = document.createElement('div');
            el.className = 'my-location';
            el.innerHTML = '<div class="pulse"></div><img src="${currentLocationUri}" />';
            window.myLocationOverlay = new kakao.maps.CustomOverlay({
              map: window.kakaoMap,
              position: pos,
              content: el,
              xAnchor: 0.5,
              yAnchor: 0.5,
              zIndex: 5,
            });
          }
        }
        true;
      `);
    },
  }));

  const centerLat = routePlaces.length > 0
    ? routePlaces[0].lat
    : markers.length > 0 ? markers[0].latitude : latitude;
  const centerLng = routePlaces.length > 0
    ? routePlaces[0].lng
    : markers.length > 0 ? markers[0].longitude : longitude;

  const html = buildKakaoMapHtml({
    kakaoJsKey: KAKAO_JS_KEY,
    centerLat,
    centerLng,
    level,
    markers,
    categoryPinUri,
    categoryPinUriSaved,
    likedPlaceIds,
    currentLocationImageUri: currentLocationUri,
    currentLocationLat: currentLocation?.lat,
    currentLocationLng: currentLocation?.lng,
    routePlaces,
    routeStartPinUri,
    routeNumberPinUris,
    routePath,
  });

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'markerClick') {
        onMarkerPress?.(data.id);
      } else if (data.type === 'mapClick') {
        onMapPress?.();
      } else if (data.type === 'mapReady') {
        onMapReady?.();
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
