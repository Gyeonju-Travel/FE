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
  /** 'paw'면 점선 대신 경로를 따라 발자국 아이콘을 일정 간격으로 찍는다. 기본은 점선('dash'). */
  routeLineStyle?: 'dash' | 'paw';
  /** routeLineStyle이 'paw'일 때 쓰는 발바닥 아이콘. */
  pawTrailUri?: string;
  /** 경로 전체가 보이도록 맞출 때 가장자리에 남기는 여백(px). 기본 80. */
  routeBoundsPadding?: number;
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
  routeLineStyle = 'dash',
  pawTrailUri = '',
  routeBoundsPadding = 80,
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
      pointer-events: none;
    }
    /* 실제 눈에 보이는 핀 크기보다 넓은 72x82 박스 전체가 클릭됐었다 — 핀끼리 가까이 있으면
       뒤쪽 핀을 아예 못 누르는 문제가 있어서, 핀 모양에 가까운 작은 영역만 클릭되게 한다. */
    .place-marker .hit-area {
      position: absolute;
      left: 50%;
      bottom: 0;
      width: 38px;
      height: 50px;
      margin-left: -19px;
      pointer-events: auto;
      cursor: pointer;
      z-index: 2;
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
          '<img src="' + pinUri + '" />' +
          '<div class="hit-area"></div>';
        el.querySelector('.hit-area').addEventListener('click', function() {
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
      var routeLineStyle = '${routeLineStyle}';
      var pawTrailUri = '${pawTrailUri}';
      if (routePlaces.length > 0) {
        var hasRealPath = routePathPoints.length > 0;
        var linePath = (hasRealPath ? routePathPoints : routePlaces).map(function(p) {
          return new kakao.maps.LatLng(p.lat, p.lng);
        });

        if (routeLineStyle === 'paw' && linePath.length > 1) {
          // 점선 대신 실제 보행 경로를 따라 일정 간격(미터 기준)으로 발자국 아이콘을 지그재그로 찍는다.
          var plainPath = linePath.map(function(ll) { return { lat: ll.getLat(), lng: ll.getLng() }; });
          function haversineMeters(a, b) {
            var R = 6371000;
            var dLat = (b.lat - a.lat) * Math.PI / 180;
            var dLng = (b.lng - a.lng) * Math.PI / 180;
            var s = Math.sin(dLat / 2) * Math.sin(dLat / 2)
              + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
            return 2 * R * Math.asin(Math.sqrt(s));
          }
          var segLens = [];
          var totalLen = 0;
          for (var si = 0; si < plainPath.length - 1; si++) {
            var segLen = haversineMeters(plainPath[si], plainPath[si + 1]);
            segLens.push(segLen);
            totalLen += segLen;
          }
          // 경로 길이가 다양해서(수백m~수km) 고정 간격을 쓰면 짧은 구간은 겹쳐서 실선처럼 뭉치고
          // 긴 구간은 너무 듬성듬성해진다. 전체 길이를 발자국 약 18개로 나눈 간격을 쓰되,
          // 너무 촘촘해지지 않도록 최소 간격을 둔다.
          var PAW_SPACING_M = Math.max(12, totalLen / 18);
          var PAW_SIDE_OFFSET_M = Math.min(4, PAW_SPACING_M * 0.2);
          var pawSide = 1;
          for (var dist = PAW_SPACING_M / 2; dist < totalLen; dist += PAW_SPACING_M) {
            var remaining = dist;
            var segIndex = 0;
            while (segIndex < segLens.length && remaining > segLens[segIndex]) {
              remaining -= segLens[segIndex];
              segIndex++;
            }
            if (segIndex >= segLens.length) break;
            var from = plainPath[segIndex];
            var to = plainPath[segIndex + 1];
            var t = remaining / (segLens[segIndex] || 1);
            var lat = from.lat + (to.lat - from.lat) * t;
            var lng = from.lng + (to.lng - from.lng) * t;
            var bearing = Math.atan2(to.lng - from.lng, to.lat - from.lat);
            var perp = bearing + Math.PI / 2;
            var mPerDegLat = 111320;
            var mPerDegLng = 111320 * Math.cos(lat * Math.PI / 180);
            var offsetLat = (Math.cos(perp) * PAW_SIDE_OFFSET_M * pawSide) / mPerDegLat;
            var offsetLng = (Math.sin(perp) * PAW_SIDE_OFFSET_M * pawSide) / mPerDegLng;

            var pawEl = document.createElement('img');
            pawEl.src = pawTrailUri;
            pawEl.style.width = '14px';
            pawEl.style.height = '13px';
            // bearing은 정북 기준 시계방향 각도라 CSS rotate()와 기준이 같다(0deg=진행방향 그대로).
            pawEl.style.transform = 'rotate(' + (bearing * 180 / Math.PI) + 'deg)';
            new kakao.maps.CustomOverlay({
              map: window.kakaoMap,
              position: new kakao.maps.LatLng(lat + offsetLat, lng + offsetLng),
              content: pawEl,
              xAnchor: 0.5,
              yAnchor: 0.5,
              zIndex: 2,
            });
            pawSide *= -1;
          }
        } else {
          new kakao.maps.Polyline({
            map: window.kakaoMap,
            path: linePath,
            strokeWeight: 2,
            strokeColor: '#E8906A',
            strokeOpacity: 0.9,
            strokeStyle: 'shortdash',
          });
        }

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
        window.kakaoMap.setBounds(bounds, ${routeBoundsPadding}, ${routeBoundsPadding}, ${routeBoundsPadding}, ${routeBoundsPadding});
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
