import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

interface SkeletonLoaderProps {
  variant?: 'card' | 'member' | 'item' | 'custom';
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function SkeletonLoader({
  variant = 'custom',
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonLoaderProps) {
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [fadeAnim]);

  const renderSkeletonBlock = (blockWidth: number | string, blockHeight: number, radius: number, blockStyle?: ViewStyle) => (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: blockWidth as any,
          height: blockHeight,
          borderRadius: radius,
          opacity: fadeAnim,
        },
        blockStyle,
      ]}
    />
  );

  if (variant === 'card') {
    return (
      <View style={[styles.cardContainer, style]}>
        {renderSkeletonBlock('40%', 20, 6, { marginBottom: Spacing.sm })}
        {renderSkeletonBlock('80%', 16, 4, { marginBottom: Spacing.sm })}
        {renderSkeletonBlock('100%', 12, 4, { marginBottom: Spacing.xs })}
        {renderSkeletonBlock('60%', 12, 4)}
      </View>
    );
  }

  if (variant === 'member') {
    return (
      <View style={[styles.memberContainer, style]}>
        {renderSkeletonBlock(40, 40, 20, { marginRight: Spacing.md })}
        <View style={styles.memberTextContainer}>
          {renderSkeletonBlock('50%', 16, 4, { marginBottom: Spacing.xs })}
          {renderSkeletonBlock('30%', 12, 4)}
        </View>
      </View>
    );
  }

  if (variant === 'item') {
    return (
      <View style={[styles.itemContainer, style]}>
        {renderSkeletonBlock('90%', 16, 4, { marginBottom: Spacing.xs })}
        {renderSkeletonBlock('40%', 12, 4)}
      </View>
    );
  }

  return renderSkeletonBlock(width, height, borderRadius, style);
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.divider,
  },
  cardContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  memberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  memberTextContainer: {
    flex: 1,
  },
  itemContainer: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
});
