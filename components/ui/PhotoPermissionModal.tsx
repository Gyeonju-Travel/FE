import React from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import AlertCard from './AlertCard';
import CameraIcon from '@/assets/icons/edit-camera.svg';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onOpenSettings: () => void;
}

/** 사진 보관함 접근 권한이 없을 때 설정으로 안내하는 모달. */
export default function PhotoPermissionModal({ visible, onCancel, onOpenSettings }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <AlertCard
          icon={<CameraIcon width={26} height={22} color={Colors.secondaryDark} />}
          iconTone="sage"
          title="사진 보관함 접근 권한이 필요해요!"
          subtitle={"설정 화면에서 사진 보관함 접근 권한을\n허용해주세요"}
          buttons={[
            { label: '확인', onPress: onCancel, variant: 'outline' },
            { label: '설정하러 가기', onPress: onOpenSettings, tone: 'sage' },
          ]}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(58,51,48,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
