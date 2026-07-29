import React from 'react';
import { View, Text, TextInput, TextInputProps, TouchableOpacity, StyleSheet } from 'react-native';
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
  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.row, error && styles.rowError]}>
        {Icon && (
          <View style={styles.iconBox}>
            <Icon width={16} height={16} color={Colors.textMuted} />
          </View>
        )}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.textMuted}
          {...inputProps}
        />
        {trailing}
      </View>
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
