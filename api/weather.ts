// 기상청 API허브(apihub.kma.go.kr)는 브라우저 CORS를 허용하지 않아서, 웹 배포본에서는
// 클라이언트가 직접 호출하지 못한다. 이 서버리스 함수가 서버 사이드에서 대신 호출해준다
// (네이티브 앱은 CORS 제약이 없어서 utils/weather.ts에서 그대로 직접 호출한다).
export default async function handler(req: any, res: any) {
  const authKey = process.env.EXPO_PUBLIC_KMA_API_KEY;
  if (!authKey) {
    res.status(500).json({ error: 'EXPO_PUBLIC_KMA_API_KEY가 설정되지 않았습니다.' });
    return;
  }

  const { base_date, base_time, nx, ny } = req.query;
  if (!base_date || !base_time) {
    res.status(400).json({ error: 'base_date, base_time이 필요합니다.' });
    return;
  }

  const params = new URLSearchParams({
    authKey,
    pageNo: '1',
    numOfRows: '100',
    dataType: 'JSON',
    base_date: String(base_date),
    base_time: String(base_time),
    nx: String(nx ?? '101'),
    ny: String(ny ?? '92'),
  });

  try {
    const upstream = await fetch(
      `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getUltraSrtFcst?${params.toString()}`
    );
    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: '기상청 API 호출에 실패했습니다.' });
  }
}
