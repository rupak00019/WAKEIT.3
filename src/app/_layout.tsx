// FIX 2: Import FCM module FIRST — registers setBackgroundMessageHandler
// immediately when the bundle loads, including headless/background launch.
// PRD Section 9.5 (FCM Headless Task)
import '@/lib/fcm';

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Alert, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_300Light,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { initializeRevenueCat } from '@/lib/revenuecat';
import messaging from '@react-native-firebase/messaging';

// Keep the native splash screen visible until fonts + auth are ready
SplashScreen.preventAutoHideAsync();

/**
 * FIX 1: Register the device FCM token to Supabase device_tokens table.
 * Runs on every authenticated app open (PRD Section 9.5 — "Refreshed on every app open").
 */
async function registerFCMToken(userId: string) {
  try {
    const token = await messaging().getToken();
    if (!token) {
      console.warn('[FCM] No token received from messaging().getToken()');
      return;
    }
    const platform = Platform.OS === 'android' ? 'android' : 'ios';
    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        {
          user_id: userId,
          platform,
          fcm_token: token,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform' }
      );
    if (error) {
      console.error('[FCM] Failed to upsert device token:', error.message);
    } else {
      console.log('[FCM] Device token registered successfully for user', userId);
    }
  } catch (err) {
    console.error('[FCM] Error during token registration:', err);
  }
}

export default function RootLayout() {
  const { setUser, setSession, setProfile, setLoading } = useAuthStore();

  // Load Poppins font variants
  const [fontsLoaded, fontError] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  // Auth listener effect
  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        initializeRevenueCat(session.user.id);
        // FIX 1: Register/refresh FCM token every app open while authenticated
        registerFCMToken(session.user.id);
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (!error && profile) {
          setProfile(profile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // FIX 1: Listen for FCM token refreshes and re-upsert whenever it changes
    // PRD Section 9.5 — token must be kept current in device_tokens table
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const platform = Platform.OS === 'android' ? 'android' : 'ios';
        const { error } = await supabase
          .from('device_tokens')
          .upsert(
            {
              user_id: session.user.id,
              platform,
              fcm_token: newToken,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,platform' }
          );
        if (error) {
          console.error('[FCM] Failed to refresh device token:', error.message);
        } else {
          console.log('[FCM] Device token refreshed successfully');
        }
      }
    });

    // 2. Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          initializeRevenueCat(session.user.id);
          // FIX 1: Also register token on sign-in event
          registerFCMToken(session.user.id);
          const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (!error && profile) {
            setProfile(profile);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      unsubscribeTokenRefresh();
    };
  }, []);

  // Auto-Update Checker Effect
  useEffect(() => {
    async function checkAndApplyUpdates() {
      try {
        if (Updates.isEnabled && !__DEV__) {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            Alert.alert(
              'Update Available',
              'A new version of WAKEIT is ready. Restart the app to apply the update.',
              [
                {
                  text: 'Restart Now',
                  onPress: async () => {
                    await Updates.reloadAsync();
                  },
                },
              ],
              { cancelable: false }
            );
          }
        }
      } catch (error) {
        console.warn('Auto-update check failed:', error);
      }
    }

    checkAndApplyUpdates();
  }, []);

  // Hide native splash once fonts are loaded (or errored)
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Don't render anything until fonts are ready —
  // this prevents the "invisible text / no buttons" issue
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Root Splash Screen */}
      <Stack.Screen name="index" />
      {/* Auth Group */}
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/signup" />
      <Stack.Screen name="(auth)/forgot-password" />
      <Stack.Screen name="(auth)/plans" />
      {/* Onboarding */}
      <Stack.Screen name="onboarding/slide1" />
      <Stack.Screen name="onboarding/slide2" />
      <Stack.Screen name="onboarding/slide3" />
      {/* Main App Tabs */}
      <Stack.Screen name="(tabs)" />
      {/* Group screens */}
      <Stack.Screen name="group/create" />
      <Stack.Screen name="group/join" />
      <Stack.Screen name="group/[id]/index" />
      <Stack.Screen name="group/[id]/members" />
      <Stack.Screen name="group/[id]/alarm/create" />
      <Stack.Screen name="group/[id]/alarm/sound" />
      <Stack.Screen name="group/[id]/alarm/[alarmId]/index" />
      <Stack.Screen name="group/[id]/alarm/[alarmId]/edit" />
      {/* System screens */}
      <Stack.Screen name="settings" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="offline" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="help" />
      <Stack.Screen name="payment/success" />
      {/* Alarm ring screens — no back gesture */}
      <Stack.Screen name="alarm/ring" options={{ gestureEnabled: false }} />
      <Stack.Screen name="alarm/challenge" options={{ gestureEnabled: false }} />
      <Stack.Screen name="alarm/success" options={{ gestureEnabled: false }} />
      <Stack.Screen name="alarm/missed" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
