import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import notifee, { EventType } from '@notifee/react-native';
import { useAuthStore } from '@/store/authStore';
import { syncOfflineCompletions } from '@/lib/sqlite';
import { supabase } from '@/lib/supabase';
import { getInitialAlarmId } from '@/lib/alarmManager';
import { Colors, Typography, Spacing } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function Splash() {
  const router = useRouter();
  const { session, loading } = useAuthStore();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
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

    // Network sync listener
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncOfflineCompletions(supabase);
      }
    });

    // FIX 4a: Check if this app launch was triggered by AlarmReceiver.
    // AlarmReceiver stores the alarm_id in SharedPreferences before firing the
    // full-screen intent. We read and clear it here, then navigate to /alarm/ring.
    // PRD Section 5.4 (Full Screen Alarm trigger sequence)
    const checkAlarmLaunch = async () => {
      try {
        const pendingAlarmId = await getInitialAlarmId();
        if (pendingAlarmId) {
          console.log('[Splash] Alarm launch detected, alarm_id =', pendingAlarmId);
          router.replace({
            pathname: '/alarm/ring',
            params: { alarmId: pendingAlarmId },
          });
          return; // Skip normal onboarding/auth navigation
        }
      } catch (err) {
        console.warn('[Splash] Failed to check initial alarm id:', err);
      }

      // Normal navigation flow (no alarm launch)
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

    // FIX 4b: Handle alarms that fire while app is already in the foreground.
    // notifee.onForegroundEvent catches the PRESS action on the full-screen notification
    // and navigates directly to the alarm ring screen.
    // PRD Section 5.4 (Full Screen Alarm trigger sequence)
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (
        (type === EventType.PRESS || type === EventType.DELIVERED) &&
        detail?.notification?.android?.channelId === 'wakeit_alarm'
      ) {
        const alarmId = detail?.notification?.data?.alarm_id as string | undefined;
        console.log('[Splash] Foreground alarm notification received, alarm_id =', alarmId);
        router.push({
          pathname: '/alarm/ring',
          params: { alarmId: alarmId ?? '' },
        });
      }
    });

    if (!loading) {
      checkAlarmLaunch();
    }

    return () => {
      unsubscribeNet();
      unsubscribeNotifee();
    };
  }, [session, loading]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Decorative concentric circles behind illustration */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.bgCircle3} />

      {/* Main Illustration */}
      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Image 
          source={require('../../assets/images/illustrations/alarm.png')} 
          style={styles.illustration}
          resizeMode="contain"
        />
        
        {/* WAKEIT Logo */}
        <View style={styles.logoTextContainer}>
          <Text style={styles.logoTextDark}>WAKE</Text>
          <Text style={styles.logoTextPrimary}>IT</Text>
        </View>
      </Animated.View>

      {/* Tagline */}
      <Animated.View
        style={[
          styles.taglineContainer,
          { opacity: taglineFade, transform: [{ translateY: taglineSlide }] },
        ]}
      >
        <Text style={styles.tagline}>Wake together. Achieve together.</Text>
      </Animated.View>

      {/* Skyline Background */}
      <Image 
        source={require('../../assets/images/illustrations/skyline.png')} 
        style={styles.skyline}
        resizeMode="cover"
      />
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
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: 'rgba(217, 232, 254, 0.1)', // Very faint accent
    top: '10%',
  },
  bgCircle2: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(217, 232, 254, 0.2)',
    top: '20%',
  },
  bgCircle3: {
    position: 'absolute',
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    backgroundColor: 'rgba(217, 232, 254, 0.3)',
    top: '28%',
  },
  logoContainer: {
    alignItems: 'center',
    zIndex: 10,
    marginTop: -50,
  },
  illustration: {
    width: 200,
    height: 200,
    marginBottom: Spacing.xl,
  },
  logoTextContainer: {
    flexDirection: 'row',
  },
  logoTextDark: {
    fontFamily: Typography.fonts.bold,
    fontSize: 48,
    color: Colors.dark,
    letterSpacing: 4,
  },
  logoTextPrimary: {
    fontFamily: Typography.fonts.bold,
    fontSize: 48,
    color: Colors.primary,
    letterSpacing: 4,
  },
  taglineContainer: {
    position: 'absolute',
    top: '65%',
    alignItems: 'center',
    zIndex: 10,
  },
  tagline: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.bodyLarge,
    color: Colors.textSecondary,
  },
  skyline: {
    position: 'absolute',
    bottom: 0,
    width: width,
    height: 150,
    opacity: 0.6,
  },
});
