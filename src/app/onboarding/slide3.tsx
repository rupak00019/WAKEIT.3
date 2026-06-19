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

const { width } = Dimensions.get('window');

export default function OnboardingSlide3() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const iconScale = useRef(new Animated.Value(0.7)).current;
  const checkAnim1 = useRef(new Animated.Value(0)).current;
  const checkAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(300, [
        Animated.spring(checkAnim1, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.spring(checkAnim2, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const handleFinish = async () => {
    await AsyncStorage.setItem('@onboarding_completed', 'true');
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.bgArc} />
      <View style={styles.bgCircle} />

      {/* No skip on last slide */}
      <View style={styles.topBar} />

      {/* Illustration */}
      <Animated.View style={[styles.illustrationArea, { transform: [{ scale: iconScale }] }]}>
        <View style={styles.mainCircle}>
          <Text style={styles.mainEmoji}>🔌</Text>
        </View>
        {/* Offline/online status cards */}
        <Animated.View style={[styles.statusCard, { opacity: checkAnim1, transform: [{ scale: checkAnim1 }] }]}>
          <Text style={styles.statusDot}>🔴</Text>
          <Text style={styles.statusCardText}>Offline — Alarm cached</Text>
        </Animated.View>
        <Animated.View style={[styles.statusCard, styles.statusCardOnline, { opacity: checkAnim2, transform: [{ scale: checkAnim2 }] }]}>
          <Text style={styles.statusDot}>🟢</Text>
          <Text style={styles.statusCardText}>Back online — Synced ✓</Text>
        </Animated.View>
      </Animated.View>

      {/* Text */}
      <Animated.View
        style={[
          styles.textContent,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>STEP 3 OF 3</Text>
        </View>
        <Text style={styles.title}>Offline{'\n'}Reliability</Text>
        <Text style={styles.description}>
          WAKEIT caches your groups' alarms locally in SQLite. Even if your internet goes down overnight, your alarm is guaranteed to ring!
        </Text>

        {/* Feature chips */}
        <View style={styles.featureList}>
          {[
            { icon: '💾', text: 'Local SQLite cache' },
            { icon: '🔔', text: 'Alarm guaranteed to fire' },
            { icon: '☁️', text: 'Auto-syncs when back online' },
          ].map((f) => (
            <View key={f.text} style={styles.featureChip}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.progressDots}>
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
        </View>
        <Button title="Get Started 🚀" onPress={handleFinish} style={styles.finishButton} />
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
  bgCircle: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    opacity: 0.07,
    bottom: 120,
    left: -30,
  },
  topBar: {
    paddingTop: 48,
    height: 100,
  },
  illustrationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 18,
    marginBottom: Spacing.lg,
  },
  mainEmoji: {
    fontSize: 64,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginTop: Spacing.sm,
    width: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  statusCardOnline: {
    borderColor: Colors.accent,
  },
  statusDot: {
    fontSize: 14,
    marginRight: 8,
  },
  statusCardText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
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
  featureList: {
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  featureIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  featureText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.dark,
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
  finishButton: {
    width: 160,
    height: 50,
  },
});
