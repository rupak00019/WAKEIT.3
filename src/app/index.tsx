import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '@/store/authStore';
import { syncOfflineCompletions } from '@/lib/sqlite';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, Spacing } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function Splash() {
  const router = useRouter();
  const { session, loading } = useAuthStore();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;
  const taglineSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Tagline fade-in after logo
      Animated.parallel([
        Animated.timing(taglineFade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(taglineSlide, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    });

    // Pulse ring animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Network sync listener
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncOfflineCompletions(supabase);
      }
    });

    const checkNavigation = async () => {
      try {
        const onboardingCompleted = await AsyncStorage.getItem('@onboarding_completed');
        await new Promise((resolve) => setTimeout(resolve, 2800));
        if (onboardingCompleted !== 'true') {
          router.replace('/onboarding/slide1');
        } else if (!session) {
          router.replace('/(auth)/login');
        } else {
          router.replace('/(tabs)');
        }
      } catch {
        router.replace('/(auth)/login');
      }
    };

    if (!loading) {
      checkNavigation();
    }

    return () => { unsubscribeNet(); };
  }, [session, loading]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Decorative circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* Pulse ring behind logo */}
      <Animated.View
        style={[
          styles.pulseRing,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.logoCircle}>
          <Text style={styles.logoIcon}>⏰</Text>
        </View>
        <Text style={styles.logoText}>WAKEIT</Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View
        style={[
          styles.taglineContainer,
          { opacity: taglineFade, transform: [{ translateY: taglineSlide }] },
        ]}
      >
        <Text style={styles.tagline}>Group Wake-up Accountability</Text>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgCircle1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.accent,
    opacity: 0.25,
    top: -80,
    right: -80,
  },
  bgCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.primary,
    opacity: 0.1,
    bottom: -60,
    left: -60,
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: Colors.primary,
    opacity: 0.3,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
  },
  logoIcon: {
    fontSize: 52,
  },
  logoText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 40,
    fontWeight: '700',
    color: Colors.dark,
    letterSpacing: 6,
  },
  taglineContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
  },
  tagline: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.divider,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 18,
  },
});
