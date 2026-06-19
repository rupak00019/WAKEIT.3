import { Platform } from 'react-native';

export const Colors = {
  modes: {
    light: {
      text: '#013237',
      background: '#F8FBF7',
      backgroundElement: '#FFFFFF',
      backgroundSelected: '#C0E6BA',
      textSecondary: '#6B7280',
    },
    dark: {
      text: '#F8FBF7',
      background: '#013237',
      backgroundElement: '#013237',
      backgroundSelected: '#4CA771',
      textSecondary: '#9CA3AF',
    },
  },
  background: '#F8FBF7',
  surface: '#FFFFFF',
  primary: '#4CA771',
  dark: '#013237',
  accent: '#C0E6BA',
  error: '#EF4444',
  warning: '#F59E0B',
  textPrimary: '#013237',
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
