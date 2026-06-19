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

export default function OnboardingSlide1() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const iconScale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSkip = async () => {
    await AsyncStorage.setItem('@onboarding_completed', 'true');
    router.replace('/(auth)/login');
  };

  const handleNext = () => router.push('/onboarding/slide2');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Background decoration */}
      <View style={styles.bgArc} />
      <View style={styles.bgDot1} />
      <View style={styles.bgDot2} />

      {/* Skip button top-right */}
      <View style={styles.topBar}>
        <Button title="Skip" onPress={handleSkip} variant="link" />
      </View>

      {/* Illustration area */}
      <Animated.View style={[styles.illustrationArea, { transform: [{ scale: iconScale }] }]}>
        <View style={styles.illustrationCircle}>
          <Text style={styles.illustrationEmoji}>👥</Text>
        </View>
        {/* Member dots */}
        <View style={styles.memberDots}>
          {['🧑', '👩', '👨'].map((emoji, i) => (
            <View key={i} style={[styles.memberBubble, { marginLeft: i === 0 ? 0 : -10 }]}>
              <Text style={styles.memberEmoji}>{emoji}</Text>
            </View>
          ))}
          <View style={styles.memberCount}>
            <Text style={styles.memberCountText}>+3</Text>
          </View>
        </View>
      </Animated.View>

      {/* Text content */}
      <Animated.View
        style={[
          styles.textContent,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>STEP 1 OF 3</Text>
        </View>
        <Text style={styles.title}>Group Accountability</Text>
        <Text style={styles.description}>
          Set alarms with your study group, roommates, or family. Everyone gets woken up together — keeping each other honest.
        </Text>
      </Animated.View>

      {/* Bottom section */}
      <View style={styles.footer}>
        <View style={styles.progressDots}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
        </View>
        <Button
          title="Next →"
          onPress={handleNext}
          style={styles.nextButton}
        />
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
  bgDot1: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    opacity: 0.4,
    top: height * 0.18,
    left: 30,
  },
  bgDot2: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.dark,
    opacity: 0.15,
    top: height * 0.25,
    right: 40,
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
    paddingTop: Spacing.xl,
  },
  illustrationCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 18,
  },
  illustrationEmoji: {
    fontSize: 72,
  },
  memberDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  memberBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  memberEmoji: {
    fontSize: 20,
  },
  memberCount: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  memberCountText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.background,
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
