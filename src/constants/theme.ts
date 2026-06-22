import { Platform } from 'react-native';

export const Colors = {
  modes: {
    light: {
      text: '#0D1B4B',
      background: '#F0F4FF',
      backgroundElement: '#EEF2FF',
      backgroundSelected: '#EEF2FF',
      textSecondary: '#0D1B4B',
    },
    dark: {
      text: '#0D1B4B',
      background: '#F0F4FF',
      backgroundElement: '#EEF2FF',
      backgroundSelected: '#EEF2FF',
      textSecondary: '#0D1B4B',
    },
  },
  background: '#F0F4FF',
  surface: '#EEF2FF',
  primary: '#3B6FF0',
  dark: '#0D1B4B',
  accent: '#EEF2FF',
  error: '#E53935',
  warning: '#E53935',
  textPrimary: '#0D1B4B',
  textSecondary: '#0D1B4B',
  textDisabled: '#0D1B4B',
  divider: '#EEF2FF',
  status: {
    completed: { bg: '#EEF2FF', text: '#22C55E' },
    pending: { bg: '#EEF2FF', text: '#3B6FF0' },
    missed: { bg: '#EEF2FF', text: '#E53935' },
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

export const BorderRadius = {
  button: 14,
  input: 12,
  card: 16,
} as const;

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
export const Fonts = {
  mono: Platform.select({ ios: 'CourierNewPSMT', android: 'monospace', default: 'monospace' }),
};
