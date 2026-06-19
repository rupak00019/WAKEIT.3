import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';

export default function Offline() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    setChecking(true);
    try {
      // Attempt a quick, lightweight query to see if network works
      const { error } = await supabase.from('users').select('id').limit(1);
      
      if (!error) {
        Alert.alert('Online!', 'Internet connection restored.', [
          { text: 'Go Home', onPress: () => router.replace('/(tabs)') }
        ]);
      } else {
        Alert.alert('Still Offline', 'Could not establish connection to the server. Please check your WiFi or mobile data.');
      }
    } catch {
      Alert.alert('Still Offline', 'Network request failed. Try again in a few moments.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.illustration}>🔌</Text>
      <Text style={styles.title}>No Internet Connection</Text>
      <Text style={styles.description}>
        Your scheduled alarms will still ring on time. Connect to the internet to sync new alarms or view other groups.
      </Text>
      <Button title="Retry Connection" onPress={handleRetry} loading={checking} style={styles.retryBtn} />
      <Button title="Continue Offline" onPress={() => router.replace('/(tabs)')} variant="link" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBF7',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustration: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#013237',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryBtn: {
    width: '100%',
    maxWidth: 300,
  },
});
