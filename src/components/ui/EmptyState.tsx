import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing } from '@/constants/theme';
import Button from './Button';
import { HelpCircle } from 'lucide-react-native';

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export default function EmptyState({
  title,
  description,
  actionText,
  onAction,
  icon,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        {icon || <HelpCircle size={48} color={Colors.primary} />}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionText && onAction && (
        <Button title={actionText} onPress={onAction} style={styles.button} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderColor: Colors.divider,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  iconContainer: {
    marginBottom: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  description: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  button: {
    minWidth: 150,
  },
});
