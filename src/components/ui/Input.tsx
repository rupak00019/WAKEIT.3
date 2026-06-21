import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, TextInputProps, ViewStyle, StyleProp } from 'react-native';
import { Colors, Typography, Spacing } from '@/constants/theme';
import { Eye, EyeOff } from 'lucide-react-native';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  style?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
}

export default function Input({ label, error, secureTextEntry, style, leftIcon, ...props }: InputProps) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.borderFocused,
          !!error && styles.borderError,
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, leftIcon ? { paddingLeft: 0 } : {}]}
          secureTextEntry={isSecure}
          placeholderTextColor={Colors.textDisabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setIsSecure(!isSecure)} style={styles.toggleButton}>
            {isSecure ? (
              <EyeOff size={20} color={Colors.textSecondary} />
            ) : (
              <Eye size={20} color={Colors.textSecondary} />
            )}
          </Pressable>
        )}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: Typography.fonts.semibold,
    fontSize: Typography.sizes.caption,
    color: Colors.dark,
    marginBottom: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.divider,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    height: 52,
  },
  leftIconContainer: {
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.md,
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textPrimary,
  },
  borderFocused: {
    borderColor: Colors.primary,
  },
  borderError: {
    borderColor: Colors.error,
  },
  toggleButton: {
    paddingHorizontal: Spacing.md,
    height: '100%',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
});
