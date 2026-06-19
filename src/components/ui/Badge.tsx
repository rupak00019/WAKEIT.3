import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Typography, Spacing } from '@/constants/theme';

interface BadgeProps {
  label: string;
  status?: 'completed' | 'pending' | 'missed' | 'default';
  style?: ViewStyle;
}

export default function Badge({ label, status = 'default', style }: BadgeProps) {
  const getBadgeStyle = (): ViewStyle => {
    if (status === 'default') {
      return {
        backgroundColor: Colors.accent,
        borderColor: Colors.accent,
      };
    }
    return {
      backgroundColor: Colors.status[status].bg,
      borderColor: Colors.status[status].bg,
    };
  };

  const getTextStyle = (): TextStyle => {
    if (status === 'default') {
      return {
        color: Colors.dark,
      };
    }
    return {
      color: Colors.status[status].text,
    };
  };

  return (
    <View style={[styles.badge, getBadgeStyle(), style]}>
      <Text style={[styles.text, getTextStyle()]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  text: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.bold,
  },
});
