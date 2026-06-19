import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Alert } from 'react-native';
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

// Keep the native splash screen visible until fonts + auth are ready
SplashScreen.preventAutoHideAsync();

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

    // 2. Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          initializeRevenueCat(session.user.id);
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
