import { MapPlace } from '@/types/map';

export interface RouteMapPlace {
  id: string;
  lat: number;
  lng: number;
}

export interface RoutePathPoint {
  lat: number;
  lng: number;
}

interface BuildKakaoMapHtmlParams {
  kakaoJsKey?: string;
  centerLat: number;
  centerLng: number;
  level: number;
  markers: MapPlace[];
  categoryPinUri: Record<MapPlace['category'], string>;
  categoryPinUriSaved: Record<MapPlace['category'], string>;
  /** 저장(하트)한 장소 id 목록. 여기 포함된 마커는 세이지 그린 핀으로 표시된다. */
  likedPlaceIds?: string[];
  currentLocationImageUri: string;
  currentLocationLat?: number | null;
  currentLocationLng?: number | null;
  routePlaces?: RouteMapPlace[];
  /** 경로보기 지도의 출발지 핀 이미지. routePlaces[0]에 사용된다. */
  routeStartPinUri?: string;
  /** 경로보기 지도의 목적지 핀 이미지 (1~5번, 방문 순서대로). routePlaces[1]부터 순서대로 사용된다. */
  routeNumberPinUris?: string[];
  /** 인도를 따라가는 실제 보행 경로 좌표. 있으면 실선으로, 없으면 정류장 간 직선(점선)으로 대체 표시. */
  routePath?: RoutePathPoint[];
}

export function buildKakaoMapHtml({
  kakaoJsKey,
  centerLat,
  centerLng,
  level,
  markers,
  categoryPinUri,
  categoryPinUriSaved,
  likedPlaceIds = [],
  currentLocationImageUri,
  currentLocationLat,
  currentLocationLng,
  routePlaces = [],
  routeStartPinUri = '',
  routeNumberPinUris = [],
  routePath = [],
}: BuildKakaoMapHtmlParams): string {
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
  const categoryPinJson = JSON.stringify(categoryPinUri);
  const categoryPinSavedJson = JSON.stringify(categoryPinUriSaved);
  const routePlacesJson = JSON.stringify(routePlaces);
  const routeNumberPinUrisJson = JSON.stringify(routeNumberPinUris);
  const routePathJson = JSON.stringify(routePath);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .my-location {
      position: relative;
      width: 52px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .my-location .pulse {
      position: absolute;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: rgba(90, 138, 106, 0.45);
      animation: my-location-pulse 2.2s ease-out infinite;
    }
    .my-location img {
      position: relative;
      width: 46px;
      height: 46px;
      z-index: 1;
    }
    @keyframes my-location-pulse {
      0% { transform: scale(1); opacity: 0.65; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    .place-marker {
      position: relative;
      width: 72px;
      height: 82px;
      cursor: pointer;
    }
    .place-marker .pulse {
      position: absolute;
      left: 50%;
      bottom: 27px;
      width: 28px;
      height: 28px;
      margin-left: -14px;
      border-radius: 50%;
      animation: my-location-pulse 2.2s ease-out infinite;
    }
    .place-marker img {
      position: absolute;
      left: 50%;
      bottom: 0;
      width: 72px;
      height: 72px;
      margin-left: -36px;
      z-index: 1;
    }
    .place-marker--카페 .pulse { background: rgba(201, 123, 94, 0.5); }
    .place-marker--식당 .pulse { background: rgba(184, 118, 46, 0.5); }
    .place-marker--관광지 .pulse { background: rgba(90, 138, 106, 0.5); }
    .route-marker { width: 40px; height: 48px; cursor: pointer; }
    .route-marker img { width: 40px; height: 48px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script type="text/javascript"
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJsKey}&autoload=false">
  </script>
  <script>
    function sendMessage(data) {
      var json = JSON.stringify(data);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(json);
      } else if (window.parent) {
        window.parent.postMessage(json, '*');
      }
    }

    kakao.maps.load(function() {
      var container = document.getElementById('map');
      var options = {
        center: new kakao.maps.LatLng(${centerLat}, ${centerLng}),
        level: ${level}
      };
      window.kakaoMap = new kakao.maps.Map(container, options);

      kakao.maps.event.addListener(window.kakaoMap, 'click', function() {
        sendMessage({ type: 'mapClick' });
      });

      kakao.maps.event.addListener(window.kakaoMap, 'tilesloaded', function() {
        sendMessage({ type: 'mapReady' });
      });

      var places = ${markersJson};
      var categoryPinUri = ${categoryPinJson};
      var categoryPinUriSaved = ${categoryPinSavedJson};

      places.forEach(function(place) {
        var el = document.createElement('div');
        el.className = 'place-marker place-marker--' + place.category;
        var pinUri = place.liked
          ? categoryPinUriSaved[place.category]
          : categoryPinUri[place.category];
        el.innerHTML =
          '<div class="pulse"></div>' +
          '<img src="' + pinUri + '" />';
        el.addEventListener('click', function() {
          sendMessage({ type: 'markerClick', id: place.id });
        });

        new kakao.maps.CustomOverlay({
          map: window.kakaoMap,
          position: new kakao.maps.LatLng(place.lat, place.lng),
          content: el,
          xAnchor: 0.5,
          yAnchor: 1,
          zIndex: 3,
        });
      });

      var routePlaces = ${routePlacesJson};
      var routeStartPinUri = '${routeStartPinUri}';
      var routeNumberPinUris = ${routeNumberPinUrisJson};
      var routePathPoints = ${routePathJson};
      if (routePlaces.length > 0) {
        var hasRealPath = routePathPoints.length > 0;
        var linePath = (hasRealPath ? routePathPoints : routePlaces).map(function(p) {
          return new kakao.maps.LatLng(p.lat, p.lng);
        });
        new kakao.maps.Polyline({
          map: window.kakaoMap,
          path: linePath,
          strokeWeight: 2,
          strokeColor: '#E8906A',
          strokeOpacity: 0.9,
          strokeStyle: 'shortdash',
        });

        routePlaces.forEach(function(place, idx) {
          var pinUri = idx === 0 ? routeStartPinUri : routeNumberPinUris[idx - 1];
          var el = document.createElement('div');
          el.className = 'route-marker';
          el.innerHTML = '<img src="' + pinUri + '" />';
          el.addEventListener('click', function() {
            sendMessage({ type: 'markerClick', id: place.id });
          });

          new kakao.maps.CustomOverlay({
            map: window.kakaoMap,
            position: new kakao.maps.LatLng(place.lat, place.lng),
            content: el,
            xAnchor: 0.5,
            yAnchor: 1,
            zIndex: idx === 0 ? 6 : 4,
          });
        });

        var bounds = new kakao.maps.LatLngBounds();
        linePath.forEach(function(pos) { bounds.extend(pos); });
        window.kakaoMap.setBounds(bounds, 80, 80, 80, 80);
      }

      ${
        currentLocationLat != null && currentLocationLng != null
          ? `
      var myLocationContent =
        '<div class="my-location"><div class="pulse"></div>' +
        '<img src="${currentLocationImageUri}" /></div>';
      window.myLocationOverlay = new kakao.maps.CustomOverlay({
        map: window.kakaoMap,
        position: new kakao.maps.LatLng(${currentLocationLat}, ${currentLocationLng}),
        content: myLocationContent,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 5,
      });
      `
          : ''
      }

      window.addEventListener('message', function(event) {
        var data = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) { return; }
        }
        if (!data || !window.kakaoMap) return;
        if (data.type === 'zoomIn') {
          window.kakaoMap.setLevel(window.kakaoMap.getLevel() - 1, { animate: true });
        } else if (data.type === 'zoomOut') {
          window.kakaoMap.setLevel(window.kakaoMap.getLevel() + 1, { animate: true });
        } else if (data.type === 'moveTo') {
          window.kakaoMap.panTo(new kakao.maps.LatLng(data.lat, data.lng));
        }
      });
    });
  </script>
</body>
</html>
  `;
}
