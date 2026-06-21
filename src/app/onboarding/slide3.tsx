import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing } from '@/constants/theme';
import Button from '@/components/ui/Button';

const { width } = Dimensions.get('window');

export default function OnboardingSlide3() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleFinish = async () => {
    await AsyncStorage.setItem('@onboarding_completed', 'true');
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Illustration area */}
      <View style={styles.illustrationArea}>
        <Image 
          source={require('../../assets/images/illustrations/math.png')}
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>

      {/* Text content */}
      <Animated.View
        style={[
          styles.textContent,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.titleRow}>
          <Text style={styles.titleDark}>Prove You're </Text>
          <Text style={styles.titlePrimary}>Awake.</Text>
        </View>
        
        <Text style={styles.description}>
          Solve a quick challenge{'\n'}to stop the alarm.
        </Text>

        <View style={styles.progressDots}>
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
        </View>

        <Button
          title="Get Started →"
          onPress={handleFinish}
          style={styles.nextButton}
        />
        
        <Button
          title="Skip"
          onPress={handleFinish}
          variant="link"
          style={styles.skipButton}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  illustrationArea: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Spacing.xl,
  },
  illustration: {
    width: width * 0.9,
    height: width * 0.9,
  },
  textContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  titleDark: {
    fontFamily: Typography.fonts.bold,
    fontSize: 28,
    color: Colors.dark,
    lineHeight: 36,
  },
  titlePrimary: {
    fontFamily: Typography.fonts.bold,
    fontSize: 28,
    color: Colors.primary,
    lineHeight: 36,
  },
  description: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.bodyLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.xxl,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    width: 18,
  },
  nextButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  skipButton: {
    marginTop: Spacing.xs,
  },
});
