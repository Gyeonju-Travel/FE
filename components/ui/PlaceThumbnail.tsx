import React, { useEffect, useState } from 'react';
import { Image, View, StyleSheet, StyleProp, ImageStyle, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import PlaceBlankIllustration from '@/assets/place/place-blank.svg';

interface Props {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  /** 기본 일러스트 크기 배율(박스 대비). 기본값 0.75. */
  illustrationScale?: number;
}

// place-blank.svg의 원본 비율 (1220x1010). 퍼센트 width/height는 react-native-svg에서
// 잘려 보이는 문제가 있어, 박스 크기에서 픽셀 값을 직접 계산해 넘긴다.
const ILLUSTRATION_RATIO = 1220 / 1010;
const DEFAULT_ILLUSTRATION_SCALE = 0.75;

/** 장소 사진이 없을 때 기본 일러스트로 대체하는 썸네일. */
export default function PlaceThumbnail({ uri, style, illustrationScale = DEFAULT_ILLUSTRATION_SCALE }: Props) {
  // uri가 있어도 깨진 링크/404면 Image가 조용히 빈 화면만 남기므로, 로드 실패 시에도 일러스트로 대체한다.
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    setLoadFailed(false);
  }, [uri]);

  // 관광지 이미지(한국관광공사 tong.visitkorea.or.kr)가 http://로 내려오는데, iOS는 기본적으로
  // http 이미지 로드를 막는다(ATS). 이 도메인은 https도 지원하므로 그냥 https로 바꿔서 요청한다.
  const httpsUri = uri?.replace(/^http:\/\//, 'https://');

  if (httpsUri && !loadFailed) {
    return (
      <Image
        source={{ uri: httpsUri }}
        style={style}
        resizeMode="cover"
        onError={() => setLoadFailed(true)}
      />
    );
  }
  const flat = StyleSheet.flatten(style) ?? {};
  const boxWidth = typeof flat.width === 'number' ? flat.width : 64;
  const boxHeight = typeof flat.height === 'number' ? flat.height : 64;
  const illustrationWidth = Math.min(boxWidth, boxHeight) * illustrationScale;
  const illustrationHeight = illustrationWidth / ILLUSTRATION_RATIO;

  return (
    <View style={[style as StyleProp<ViewStyle>, styles.fallback]}>
      <PlaceBlankIllustration width={illustrationWidth} height={illustrationHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: Colors.bgWarm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
