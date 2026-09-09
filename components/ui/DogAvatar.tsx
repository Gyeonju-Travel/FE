import React, { useEffect, useState } from 'react';
import { Image, View, StyleProp, ImageStyle, ViewStyle } from 'react-native';
import DogPhotoBlank from '@/assets/mypage/dog-photo-blank.svg';

interface Props {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  placeholderStyle?: StyleProp<ViewStyle>;
  size: number;
}

/** 강아지 프로필 사진이 없거나 로드에 실패하면 기본 일러스트로 대체하는 아바타. */
export default function DogAvatar({ uri, style, placeholderStyle, size }: Props) {
  // uri가 있어도 깨진 링크/404면 Image가 조용히 빈 화면만 남기므로, 로드 실패 시에도 일러스트로 대체한다.
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    setLoadFailed(false);
  }, [uri]);

  // 프로필 이미지가 http://로 내려오면 iOS ATS가 로드를 막아 조용히 안 뜬다(PlaceThumbnail과 동일 이슈).
  // 이 도메인들은 https도 지원하므로 그냥 https로 바꿔서 요청한다.
  const httpsUri = uri?.replace(/^http:\/\//, 'https://');

  if (httpsUri && !loadFailed) {
    return (
      <Image source={{ uri: httpsUri }} style={style} resizeMode="cover" onError={() => setLoadFailed(true)} />
    );
  }
  return (
    <View style={placeholderStyle}>
      <DogPhotoBlank width={size} height={size} />
    </View>
  );
}
