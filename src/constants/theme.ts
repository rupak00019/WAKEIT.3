import { Platform } from 'react-native';

export const Colors = {
  modes: {
    light: {
      text: '#0A1C40',
      background: '#FAFBFC',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#D9E8FE',
      textSecondary: '#6B7280',
    },
    dark: {
      text: '#FAFBFC',
      background: '#0A1C40',
      backgroundElement: '#0A1C40',
      backgroundSelected: '#2A7AF2',
      textSecondary: '#9CA3AF',
    },
  },
  background: '#FAFBFC',
  surface: '#FFFFFF',
  primary: '#2A7AF2',
  dark: '#0A1C40',
  accent: '#D9E8FE',
  error: '#EF4444',
  warning: '#F59E0B',
  textPrimary: '#0A1C40',
  textSecondary: '#6B7280',
  textDisabled: '#9CA3AF',
  divider: '#E5E7EB',
  status: {
    completed: { bg: '#DCFCE7', text: '#16A34A' },
    pending: { bg: '#FEF3C7', text: '#D97706' },
    missed: { bg: '#FEE2E2', text: '#DC2626' },
  },
} as const;

export type ThemeColor = 'text' | 'background' | 'backgroundElement' | 'backgroundSelected' | 'textSecondary';

/**
 * Typography — uses @expo-google-fonts/poppins loaded in _layout.tsx.
 * The fontFamily strings MUST match the export key from the package exactly.
 */
export const Typography = {
  // Base family — regular weight (used as default fallback)
  fontFamily: 'Poppins_400Regular',
  fonts: {
    regular: 'Poppins_400Regular',
    medium: 'Poppins_500Medium',
    semibold: 'Poppins_600SemiBold',
    bold: 'Poppins_700Bold',
  },
  sizes: {
    display: 32,
    h1: 24,
    h2: 20,
    h3: 16,
    bodyLarge: 16,
    body: 14,
    caption: 12,
    button: 16,
  },
  weights: {
    regular: 'normal' as const,
    semibold: '600' as const,
    bold: 'bold' as const,
  },
  lineHeight: 1.5,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
export const Fonts = {
  mono: Platform.select({ ios: 'CourierNewPSMT', android: 'monospace', default: 'monospace' }),
};
