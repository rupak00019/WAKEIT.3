import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { stopAlarmSoundAndVibration } from '@/lib/alarmSound';

export default function ChallengeSuccess() {
  const router = useRouter();
  const { wakeScore, currentStreak, offline } = useLocalSearchParams<{
    wakeScore: string;
    currentStreak: string;
    offline?: string;
  }>();

  useEffect(() => {
    stopAlarmSoundAndVibration();
  }, []);

  const handleFinish = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.checkmark}>✅</Text>
      <Text style={styles.title}>Challenge Complete!</Text>
      <Text style={styles.subtitle}>You successfully stopped the alarm.</Text>

      {offline === 'true' && (
        <Card style={styles.offlineCard}>
          <Text style={styles.offlineTitle}>Offline Mode Active</Text>
          <Text style={styles.offlineText}>
            Your completion has been saved locally. We will automatically sync and update your wake score and streak once you reconnect.
          </Text>
        </Card>
      )}

      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Wake Score</Text>
          <Text style={styles.statValue}>{wakeScore || '100'}%</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Current Streak</Text>
          <Text style={styles.statValue}>{currentStreak || '1'} days</Text>
        </Card>
      </View>

      <Button title="Go to Home Dashboard" onPress={handleFinish} style={styles.finishBtn} />
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
    fontSize: 84,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#013237',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  offlineCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#fef3c7',
    borderWidth: 1,
    marginBottom: 20,
    width: '100%',
  },
  offlineTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#d97706',
    marginBottom: 4,
  },
  offlineText: {
    fontSize: 12,
    color: '#b45309',
    lineHeight: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    marginBottom: 40,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CA771',
  },
  finishBtn: {
    width: '100%',
  },
});
