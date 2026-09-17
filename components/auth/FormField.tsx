import React, { useRef } from 'react';
import { View, Text, TextInput, TextInputProps, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

type IconComponent = React.FC<{ width?: number; height?: number; color?: string }>;

interface FormFieldProps extends TextInputProps {
  label?: string;
  Icon?: IconComponent;
  trailing?: React.ReactNode;
  /** 값이 유효성 조건에 맞지 않을 때 보여줄 안내문. 없으면 표시 안 함. */
  error?: string | null;
}

export default function FormField({ label, Icon, trailing, style, error, ...inputProps }: FormFieldProps) {
  const inputRef = useRef<TextInput>(null);
  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      {/* 아이콘/여백 부분은 TextInput 밖이라 그 자리를 눌러도 포커스가 안 잡히던 문제가 있어서,
          박스 전체를 눌렀을 때 TextInput에 포커스를 주도록 감쌌다. trailing(눈 아이콘 등 버튼)은
          안쪽 터치 컴포넌트가 자기 터치를 먼저 처리하므로 이 onPress와 겹치지 않는다. */}
      <Pressable style={[styles.row, error && styles.rowError]} onPress={() => inputRef.current?.focus()}>
        {Icon && (
          <View style={styles.iconBox}>
            <Icon width={16} height={16} color={Colors.textMuted} />
          </View>
        )}
        <TextInput
          ref={inputRef}
          style={[styles.input, style]}
          placeholderTextColor={Colors.textMuted}
          {...inputProps}
        />
        {trailing}
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export function EyeToggle({ visible, onPress, Icon }: { visible: boolean; onPress: () => void; Icon: IconComponent }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.trailingBtn}>
      <Icon width={18} height={12} color={visible ? Colors.coral : Colors.textMuted} />
    </TouchableOpacity>
  );
}

export function InlineActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.inlineBtn, disabled && styles.inlineBtnDisabled]}
    >
      <Text style={[styles.inlineBtnText, disabled && styles.inlineBtnTextDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textBody1, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    height: 52,
    gap: 10,
  },
  rowError: { borderColor: '#D14343' },
  errorText: { fontSize: 12, color: '#D14343', marginTop: 6 },
  iconBox: { width: 16, alignItems: 'center' },
  input: { flex: 1, fontSize: 14, color: Colors.textBody1, padding: 0 },
  trailingBtn: { padding: 4 },
  inlineBtn: {
    backgroundColor: Colors.coral,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineBtnDisabled: { backgroundColor: Colors.border },
  inlineBtnText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  inlineBtnTextDisabled: { color: Colors.textMuted },
});
