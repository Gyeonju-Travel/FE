import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MapPlace } from '@/types/map';
import {
  categoryPinUri,
  categoryPinUriSaved,
  currentLocationUri,
  routeStartPinUri,
  routeNumberPinUris,
  pawTrailUri,
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
  /** 'paw'면 점선 대신 경로를 따라 발자국 아이콘을 찍는다. 기본은 점선('dash'). */
  routeLineStyle?: 'dash' | 'paw';
  /** 경로 전체가 보이도록 맞출 때 가장자리에 남기는 여백(px). 기본 80 — 작을수록 더 확대돼 보인다. */
  routeBoundsPadding?: number;
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
    routeLineStyle = 'dash',
    routeBoundsPadding = 80,
    onMarkerPress,
    onMapPress,
    onMapReady,
  },
  ref
) {
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);

  const updateMyLocation = (lat: number, lng: number) => {
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
  };

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
    updateMyLocation,
  }));

  // currentLocation prop이 바뀔 때(위치 권한 최초 허용, 위치 갱신 등)도 오버레이가 따라가도록,
  // 지도가 준비된 뒤에는 이 effect로도 한 번 더 반영해둔다 (버튼을 누르지 않아도 갱신됨).
  useEffect(() => {
    if (mapReady && currentLocation) {
      updateMyLocation(currentLocation.lat, currentLocation.lng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, currentLocation?.lat, currentLocation?.lng]);

  const centerLat = routePlaces.length > 0
    ? routePlaces[0].lat
    : markers.length > 0 ? markers[0].latitude : latitude;
  const centerLng = routePlaces.length > 0
    ? routePlaces[0].lng
    : markers.length > 0 ? markers[0].longitude : longitude;

  // currentLocation은 최초 1회만 html에 반영한다. 이후 위치가 갱신될 때마다 이 값을 html에
  // 반영하면 WebView의 source.html이 바뀌어 페이지 전체가 리로드되면서, 같은 타이밍에 호출한
  // moveTo()의 panTo 이동이 새로 로드된(원래 중심으로 되돌아간) 지도에 의해 무효화된다.
  // 이후 위치 갱신은 updateMyLocation()으로 오버레이만 이동시켜 리로드 없이 처리한다.
  const initialCurrentLocationRef = useRef(currentLocation);

  // likedPlaceIds도 같은 이유로 최초 1회만 html에 반영한다 — 안 그러면 지도에서 바로 좋아요를
  // 누를 때마다 WebView가 리로드되면서 panTo로 옮겨둔 위치가 초기 중심으로 되돌아간다.
  // 이후 좋아요 상태 변경은 아래 effect가 syncLikedPlaceIds로 핀 이미지만 갱신한다.
  const initialLikedPlaceIdsRef = useRef(likedPlaceIds);

  const html = useMemo(
    () =>
      buildKakaoMapHtml({
        kakaoJsKey: KAKAO_JS_KEY,
        centerLat,
        centerLng,
        level,
        markers,
        categoryPinUri,
        categoryPinUriSaved,
        likedPlaceIds: initialLikedPlaceIdsRef.current,
        currentLocationImageUri: currentLocationUri,
        currentLocationLat: initialCurrentLocationRef.current?.lat,
        currentLocationLng: initialCurrentLocationRef.current?.lng,
        routePlaces,
        routeStartPinUri,
        routeNumberPinUris,
        routePath,
        routeLineStyle,
        pawTrailUri,
        routeBoundsPadding,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [centerLat, centerLng, level, markers, routePlaces, routePath, routeLineStyle, routeBoundsPadding]
  );

  // 좋아요 상태가 바뀌면(하트 토글) 리로드 없이 해당 마커 핀 이미지만 갱신한다.
  useEffect(() => {
    if (mapReady) {
      webViewRef.current?.injectJavaScript(
        `if(window.syncLikedPlaceIds){window.syncLikedPlaceIds(${JSON.stringify(likedPlaceIds)});}true;`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, likedPlaceIds.join(',')]);

  // html이 바뀌면 WebView가 통째로 리로드되어 window.kakaoMap이 새로 생성되므로,
  // 다음 'mapReady' 메시지가 올 때까지는 준비 안 된 상태로 취급한다.
  useEffect(() => {
    setMapReady(false);
  }, [html]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'markerClick') {
        onMarkerPress?.(data.id);
      } else if (data.type === 'mapClick') {
        onMapPress?.();
      } else if (data.type === 'mapReady') {
        setMapReady(true);
        onMapReady?.();
      }
    } catch (_) {}
  };

  return (
    <WebView
      ref={webViewRef}
      style={styles.map}
      source={{ html, baseUrl: 'https://gyeonju-travel.vercel.app' }}
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
