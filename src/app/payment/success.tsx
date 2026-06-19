import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function PaymentSuccess() {
  const router = useRouter();

  const handleStart = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.checkmark}>🎉</Text>
      <Text style={styles.title}>You're All Set!</Text>
      <Text style={styles.subtitle}>Subscription activated successfully.</Text>

      <Card style={styles.card}>
        <Text style={styles.tierTitle}>Premium Membership Enabled</Text>
        <Text style={styles.bullet}>✓ Unlimited group alarms</Text>
        <Text style={styles.bullet}>✓ Full wake statistics tracking</Text>
        <Text style={styles.bullet}>✓ Group administration & creation features</Text>
        <Text style={styles.bullet}>✓ Priority offline backup syncing</Text>
      </Card>

      <Button title="Start Using WAKEIT" onPress={handleStart} style={styles.startBtn} />
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
  checkmark: {
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#013237',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
  },
  card: {
    width: '100%',
    padding: 16,
    marginBottom: 32,
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CA771',
    marginBottom: 12,
  },
  bullet: {
    fontSize: 14,
    color: '#374151',
    marginVertical: 4,
  },
  startBtn: {
    width: '100%',
  },
});
