import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

interface UseScrapCaptureResult {
  isSaving: boolean;
  isSharing: boolean;
  saveToGallery: () => Promise<void>;
  shareImage: () => Promise<void>;
}

/**
 * 웹 전용 버전. expo-media-library는 네이티브 전용(웹 진입점이 없어 import만 해도 크래시남)이라
 * 갤러리 저장 대신 브라우저 다운로드로 대체한다. 공유는 expo-sharing이 웹을 지원해 그대로 쓴다.
 */
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
    return captureRef(targetRef, { format: 'png', quality: 1, result: 'data-uri' });
  }, [targetRef]);

  const saveToGallery = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const uri = await capture();
      const link = document.createElement('a');
      link.href = uri;
      link.download = '스탬프_앨범.png';
      link.click();
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
        Alert.alert('공유 불가', '이 브라우저에서는 공유 기능을 사용할 수 없어요.');
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
        await Sharing.shareAsync(uri);
      } catch {
        // 사용자가 공유 시트를 취소한 경우 등 - 오류로 표시하지 않음
      }
    } finally {
      if (isMountedRef.current) setIsSharing(false);
    }
  }, [capture, isSharing]);

  return { isSaving, isSharing, saveToGallery, shareImage };
}
