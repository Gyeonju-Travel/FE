import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

export interface AlertCardButton {
  label: string;
  onPress: () => void;
  variant?: 'outline' | 'filled';
  tone?: 'coral' | 'sage';
  loading?: boolean;
}

interface AlertCardProps {
  icon?: React.ReactNode;
  iconTone?: 'coral' | 'sage';
  /** 아이콘 자체에 원형 배경이 포함되어 있어 카드의 기본 원형 배경을 씌우지 않아야 할 때 */
  iconStandalone?: boolean;
  title: string;
  subtitle?: string;
  buttons: AlertCardButton[];
}

export default function AlertCard({
  icon,
  iconTone = 'coral',
  iconStandalone = false,
  title,
  subtitle,
  buttons,
}: AlertCardProps) {
  const isRow = buttons.length > 1;
  return (
    <View style={s.card}>
      {icon && iconStandalone && <View style={s.iconStandalone}>{icon}</View>}
      {icon && !iconStandalone && (
        <View style={[s.iconCircle, iconTone === 'sage' ? s.iconCircleSage : s.iconCircleCoral]}>
          {icon}
        </View>
      )}
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      <View style={isRow ? s.btnRow : s.btnColumn}>
        {buttons.map((btn, i) => {
          const filled = btn.variant !== 'outline';
          const tone = btn.tone ?? 'coral';
          return (
            <TouchableOpacity
              key={i}
              style={[
                s.btn,
                isRow ? s.btnFlex : s.btnFullWidth,
                filled ? (tone === 'sage' ? s.btnFilledSage : s.btnFilledCoral) : s.btnOutline,
              ]}
              activeOpacity={0.85}
              onPress={btn.onPress}
              disabled={btn.loading}
            >
              {btn.loading ? (
                <ActivityIndicator color={filled ? Colors.white : Colors.textBody1} />
              ) : (
                <Text style={filled ? s.btnFilledText : s.btnOutlineText}>{btn.label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.background,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#3A3330',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  iconCircleCoral: { backgroundColor: Colors.primaryTint },
  iconCircleSage: { backgroundColor: Colors.secondaryTint },
  iconStandalone: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: { fontSize: 18, fontWeight: '600', color: Colors.textBody1, textAlign: 'center', marginBottom: 8 },
  subtitle: {
    fontSize: 13,
    color: Colors.textBody2,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: Spacing.xl,
  },
  btnRow: { flexDirection: 'row', gap: Spacing.md, width: '100%', marginTop: Spacing.md },
  btnColumn: { width: '100%', marginTop: Spacing.md },
  btn: {
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFlex: { flex: 1 },
  btnFullWidth: { width: '100%' },
  btnOutline: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  btnOutlineText: { color: Colors.textBody1, fontSize: 15, fontWeight: '600' },
  btnFilledCoral: { backgroundColor: Colors.coral },
  btnFilledSage: { backgroundColor: Colors.secondary },
  btnFilledText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
});
