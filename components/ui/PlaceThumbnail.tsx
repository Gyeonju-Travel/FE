import React from 'react';
import { Image, View, StyleSheet, StyleProp, ImageStyle, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import PlaceBlankIllustration from '@/assets/place/place-blank.svg';

interface Props {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
}

// place-blank.svg의 원본 비율 (1220x1010). 퍼센트 width/height는 react-native-svg에서
// 잘려 보이는 문제가 있어, 박스 크기에서 픽셀 값을 직접 계산해 넘긴다.
const ILLUSTRATION_RATIO = 1220 / 1010;

/** 장소 사진이 없을 때 기본 일러스트로 대체하는 썸네일. */
export default function PlaceThumbnail({ uri, style }: Props) {
  if (uri) {
    return <Image source={{ uri }} style={style} resizeMode="cover" />;
  }
  const flat = StyleSheet.flatten(style) ?? {};
  const boxWidth = typeof flat.width === 'number' ? flat.width : 64;
  const boxHeight = typeof flat.height === 'number' ? flat.height : 64;
  const illustrationWidth = Math.min(boxWidth, boxHeight) * 0.75;
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
