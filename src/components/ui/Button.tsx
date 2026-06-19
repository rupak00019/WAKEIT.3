import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { Colors, Typography, Spacing } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
  style?: StyleProp<ViewStyle>;
}

export default function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
}: ButtonProps) {
  const isInteractionDisabled = disabled || loading;

  const getSpinnerColor = () => {
    if (variant === 'secondary' || variant === 'link') return Colors.primary;
    return Colors.surface;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isInteractionDisabled}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        isInteractionDisabled && (variant === 'link' ? styles.disabledLink : styles.disabled),
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getSpinnerColor()} />
      ) : (
        <Text style={[styles.text, styles[`text_${variant}` as keyof typeof styles] as TextStyle]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    height: 52,
    marginVertical: Spacing.xs,
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: Colors.primary,
    borderWidth: 0,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  danger: {
    backgroundColor: Colors.error,
    borderWidth: 0,
  },
  link: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    height: 'auto' as any,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  disabled: {
    backgroundColor: Colors.textDisabled,
    borderColor: Colors.textDisabled,
  },
  disabledLink: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  // Text styles — use specific Poppins weight font families
  text: {
    fontFamily: Typography.fonts.semibold,    // Poppins_600SemiBold
    fontSize: Typography.sizes.button,
    letterSpacing: 0.3,
  },
  text_primary: {
    color: Colors.surface,
  },
  text_secondary: {
    color: Colors.primary,
  },
  text_danger: {
    color: Colors.surface,
  },
  text_link: {
    fontFamily: Typography.fonts.medium,      // Poppins_500Medium
    color: Colors.primary,
    fontSize: Typography.sizes.body,
    textDecorationLine: 'underline',
  },
});
