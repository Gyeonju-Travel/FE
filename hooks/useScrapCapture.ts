import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

interface UseScrapCaptureResult {
  isSaving: boolean;
  isSharing: boolean;
  saveToGallery: () => Promise<void>;
  shareImage: () => Promise<void>;
}

/** 지정된 View를 PNG로 캡처해서 갤러리 저장 / OS 공유 시트로 내보내는 훅. */
export function useScrapCapture(targetRef: React.RefObject<View | null>): UseScrapCaptureResult {
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const capture = useCallback(async (): Promise<string> => {
    if (!targetRef.current) {
      throw new Error('캡처할 영역을 찾을 수 없어요.');
    }
    return captureRef(targetRef, { format: 'png', quality: 1, result: 'tmpfile' });
  }, [targetRef]);

  const saveToGallery = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '사진 보관함 접근 권한을 허용해주세요.');
        return;
      }
      const uri = await capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('저장 완료', '스탬프 앨범이 사진 보관함에 저장됐어요.');
    } catch {
      Alert.alert('저장 실패', '이미지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      if (isMountedRef.current) setIsSaving(false);
    }
  }, [capture, isSaving]);

  const shareImage = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('공유 불가', '이 기기에서는 공유 기능을 사용할 수 없어요.');
        return;
      }

      let uri: string;
      try {
        uri = await capture();
      } catch {
        Alert.alert('공유 실패', '이미지를 만들지 못했어요. 잠시 후 다시 시도해주세요.');
        return;
      }

      try {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      } catch {
        // 사용자가 공유 시트를 취소한 경우 등 - 오류로 표시하지 않음
      }
    } finally {
      if (isMountedRef.current) setIsSharing(false);
    }
  }, [capture, isSharing]);

  return { isSaving, isSharing, saveToGallery, shareImage };
}
