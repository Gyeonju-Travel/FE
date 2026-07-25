// Official 견주여행 color palette
export const Colors = {
  // 피치코랄 (Primary)
  primary: '#E8906A',
  primaryDark: '#C87050',
  primaryTint: '#FDF0E8',
  primaryBorder: '#F0C8A8',

  // 세이지그린 (Secondary)
  secondary: '#7F9E85',
  secondaryDark: '#3A6A4A',
  secondaryTint: '#EEF6F0',
  secondaryBorder: '#C0DDD0',

  // Text
  textBody1: '#3A3330',
  textBody2: '#A89E9C',
  muted: '#A89E9C',

  // Background & Border
  bg: '#FFFBF6',
  bgWarm: '#F4F0E8',
  border: '#E0DCD4',
  borderDark: '#A89E94',        
  white: '#FFFFFF',

  // Aliases
  coral: '#E8906A',
  coralDark: '#C87050',
  coralLight: '#FDF0E8',
  coralBorder: '#F0C8A8',
  sage: '#7F9E85',
  sageDark: '#3A6A4A',
  background: '#FFFBF6',
  tagBg: '#F4F0E8',
  tagText: '#A89E9C',
  cardBg: '#FFFFFF',
  selectedCardBg: '#FDF0E8',
  checkboxActive: '#E8906A',
  navActive: '#E8906A',
  navInactive: '#A89E9C',
  deleteBtn: '#3A3330',
  textPrimary: '#3A3330',
  textSecondary: '#A89E9C',
  textMuted: '#A89E9C',
};

export const Typography = {
  pageTitle: { fontSize: 22, fontWeight: '700' as const, color: Colors.textBody1 },
  sectionTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.textBody1 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.textBody1 },
  body: { fontSize: 13, fontWeight: '400' as const, color: Colors.textBody2 },
  caption: { fontSize: 11, fontWeight: '400' as const, color: Colors.muted },
  badge: { fontSize: 10, fontWeight: '500' as const, color: Colors.white },
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};
