import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing } from '@/constants/theme';
import Button from '@/components/ui/Button';

const { width, height } = Dimensions.get('window');

export default function OnboardingSlide2() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const iconScale = useRef(new Animated.Value(0.7)).current;
  const keyAnim1 = useRef(new Animated.Value(0)).current;
  const keyAnim2 = useRef(new Animated.Value(0)).current;
  const keyAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start(() => {
      // Staggered keypad button animations
      Animated.stagger(120, [
        Animated.spring(keyAnim1, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.spring(keyAnim2, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.spring(keyAnim3, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const handleSkip = async () => {
    await AsyncStorage.setItem('@onboarding_completed', 'true');
    router.replace('/(auth)/login');
  };

  const handleNext = () => router.push('/onboarding/slide3');

  const keyAnims = [keyAnim1, keyAnim2, keyAnim3];
  const keyLabels = ['7', '8', '9'];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.bgArc} />
      <View style={styles.bgAccent} />

      <View style={styles.topBar}>
        <Button title="Skip" onPress={handleSkip} variant="link" />
      </View>

      {/* Illustration */}
      <Animated.View style={[styles.illustrationArea, { transform: [{ scale: iconScale }] }]}>
        <View style={styles.illustrationCircle}>
          <Text style={styles.equationText}>3 × 7 + 2</Text>
          <Text style={styles.equationAnswer}>= 23</Text>
        </View>

        {/* Mini keypad buttons */}
        <View style={styles.keypadRow}>
          {keyLabels.map((label, i) => (
            <Animated.View
              key={i}
              style={[
                styles.keypadBtn,
                {
                  opacity: keyAnims[i],
                  transform: [{ scale: keyAnims[i] }],
                },
              ]}
            >
              <Text style={styles.keypadBtnText}>{label}</Text>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      {/* Text */}
      <Animated.View
        style={[
          styles.textContent,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>STEP 2 OF 3</Text>
        </View>
        <Text style={styles.title}>Cognitive Math{'\n'}Challenges</Text>
        <Text style={styles.description}>
          No snooze button here! Solve easy, medium, or hard arithmetic on a custom keypad to silence your alarm.
        </Text>
        {/* Difficulty badges */}
        <View style={styles.difficultyRow}>
          {[
            { label: 'Easy', color: '#16A34A', bg: '#DCFCE7' },
            { label: 'Medium', color: '#D97706', bg: '#FEF3C7' },
            { label: 'Hard', color: '#DC2626', bg: '#FEE2E2' },
          ].map((d) => (
            <View key={d.label} style={[styles.diffBadge, { backgroundColor: d.bg }]}>
              <Text style={[styles.diffBadgeText, { color: d.color }]}>{d.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.progressDots}>
          <View style={styles.progressDot} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
        </View>
        <Button title="Next →" onPress={handleNext} style={styles.nextButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  bgArc: {
    position: 'absolute',
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: width * 0.7,
    backgroundColor: Colors.accent,
    opacity: 0.2,
    top: -width * 0.6,
    alignSelf: 'center',
  },
  bgAccent: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    opacity: 0.08,
    bottom: 160,
    right: -30,
  },
  topBar: {
    paddingTop: 48,
    paddingHorizontal: Spacing.lg,
    alignItems: 'flex-end',
  },
  illustrationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.md,
  },
  illustrationCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.dark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 18,
  },
  equationText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.accent,
  },
  equationAnswer: {
    fontFamily: Typography.fonts.regular,
    fontSize: 26,
    fontWeight: '700',
    color: Colors.background,
    marginTop: 4,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.lg,
  },
  keypadBtn: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  keypadBtnText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 22,
    fontWeight: '600',
    color: Colors.dark,
  },
  textContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    marginBottom: Spacing.md,
  },
  badgeText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.display,
    fontWeight: '700',
    color: Colors.dark,
    marginBottom: Spacing.md,
    lineHeight: 40,
  },
  description: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.bodyLarge,
    color: Colors.textSecondary,
    lineHeight: 26,
    marginBottom: Spacing.md,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  diffBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  diffBadgeText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.divider,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  nextButton: {
    width: 130,
    height: 50,
  },
});
