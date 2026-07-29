import React, { useEffect, useState } from 'react';
import { Modal, View, Image, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import AlertCard from './AlertCard';

interface AlertState {
  title: string;
  message?: string;
}

let trigger: ((state: AlertState) => void) | null = null;

/** Alert.alert(title, message)를 대체하는 앱 전용 카드 스타일 알림. */
export function showAlert(title: string, message?: string) {
  trigger?.({ title, message });
}

export function AppAlertHost() {
  const [state, setState] = useState<AlertState | null>(null);

  useEffect(() => {
    trigger = setState;
    return () => {
      trigger = null;
    };
  }, []);

  return (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={() => setState(null)}>
      <View style={s.backdrop}>
        {state && (
          <AlertCard
            icon={
              <Image
                source={require('@/assets/icons/pets.png')}
                style={s.icon}
                resizeMode="contain"
              />
            }
            title={state.title}
            subtitle={state.message}
            buttons={[{ label: '확인', onPress: () => setState(null) }]}
          />
        )}
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
  icon: { width: 28, height: 28, tintColor: Colors.coral },
});
