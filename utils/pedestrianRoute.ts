export interface LatLng {
  lat: number;
  lng: number;
}

export interface PedestrianRouteResult {
  distanceMeters: number;
  durationMinutes: number;
  path: LatLng[];
}

const TMAP_APP_KEY = process.env.EXPO_PUBLIC_TMAP_APP_KEY;

/** Tmap 보행자 경로안내 API로 실제 인도/골목을 따라가는 도보 경로를 가져온다. 키가 없거나 요청이 실패하면 null. */
export async function fetchPedestrianRoute(
  start: LatLng,
  end: LatLng
): Promise<PedestrianRouteResult | null> {
  if (!TMAP_APP_KEY) return null;

  try {
    const response = await fetch(
      'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          appKey: TMAP_APP_KEY,
        },
        body: JSON.stringify({
          startX: String(start.lng),
          startY: String(start.lat),
          endX: String(end.lng),
          endY: String(end.lat),
          startName: 'start',
          endName: 'end',
          reqCoordType: 'WGS84GEO',
          resCoordType: 'WGS84GEO',
          searchOption: '0',
        }),
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    const features: any[] = data?.features ?? [];
    if (features.length === 0) return null;

    let distanceMeters = 0;
    let durationSeconds = 0;
    const path: LatLng[] = [];

    for (const feature of features) {
      const props = feature.properties ?? {};
      if (typeof props.totalDistance === 'number') distanceMeters = props.totalDistance;
      if (typeof props.totalTime === 'number') durationSeconds = props.totalTime;

      if (feature.geometry?.type === 'LineString') {
        for (const [lng, lat] of feature.geometry.coordinates) {
          path.push({ lat, lng });
        }
      } else if (feature.geometry?.type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates;
        path.push({ lat, lng });
      }
    }

    if (path.length === 0 || distanceMeters === 0) return null;
    return {
      distanceMeters,
      durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
      path,
    };
  } catch {
    return null;
  }
}
