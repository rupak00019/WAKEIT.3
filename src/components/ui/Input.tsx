import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, TextInputProps, ViewStyle, StyleProp } from 'react-native';
import { Colors, Typography, Spacing } from '@/constants/theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  style?: StyleProp<ViewStyle>;
}

export default function Input({ label, error, secureTextEntry, style, ...props }: InputProps) {
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
        <TextInput
          style={styles.input}
          secureTextEntry={isSecure}
          placeholderTextColor={Colors.textDisabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setIsSecure(!isSecure)} style={styles.toggleButton}>
            <Text style={styles.toggleText}>{isSecure ? 'Show' : 'Hide'}</Text>
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
    fontFamily: Typography.fonts.semibold,   // Poppins_600SemiBold
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.divider,
    borderRadius: 12,
    backgroundColor: Colors.background,
    height: 52,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.md,
    fontFamily: Typography.fonts.regular,    // Poppins_400Regular
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
  toggleText: {
    fontFamily: Typography.fonts.medium,     // Poppins_500Medium
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
  },
  errorText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
});
