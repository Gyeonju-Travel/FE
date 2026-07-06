import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Image as RNImage } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MapPlace } from '@/types/map';

const KAKAO_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY;

const DEFAULT_LAT = 35.8562;
const DEFAULT_LNG = 129.2247;

const pinUri = RNImage.resolveAssetSource(require('@/assets/icons/pin.png')).uri;

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

  const markersJson = JSON.stringify(
    markers.map((m) => ({ id: m.id, lat: m.latitude, lng: m.longitude }))
  );

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script type="text/javascript"
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false">
  </script>
  <script>
    kakao.maps.load(function() {
      var container = document.getElementById('map');
      var options = {
        center: new kakao.maps.LatLng(${centerLat}, ${centerLng}),
        level: ${level}
      };
      window.kakaoMap = new kakao.maps.Map(container, options);

      kakao.maps.event.addListener(window.kakaoMap, 'click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapClick' }));
        }
      });

      var places = ${markersJson};
      var markerImageSrc = '${pinUri}';
      var imageSize  = new kakao.maps.Size(44, 50);
      var imageOption = { offset: new kakao.maps.Point(22, 48) };
      var markerImage = new kakao.maps.MarkerImage(markerImageSrc, imageSize, imageOption);

      places.forEach(function(place) {
        var marker = new kakao.maps.Marker({
          map: window.kakaoMap,
          position: new kakao.maps.LatLng(place.lat, place.lng),
          image: markerImage,
        });

        kakao.maps.event.addListener(marker, 'click', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({ type: 'markerClick', id: place.id })
            );
          }
        });
      });
    });
  </script>
</body>
</html>
  `;

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
