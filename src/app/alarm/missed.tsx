import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { stopAlarmSoundAndVibration } from '@/lib/alarmSound';

export default function AlarmMissed() {
  const router = useRouter();

  useEffect(() => {
    stopAlarmSoundAndVibration();
  }, []);

  const handleFinish = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.xmark}>❌</Text>
      <Text style={styles.title}>Alarm Missed</Text>
      <Text style={styles.subtitle}>You failed to solve the challenge within 5 minutes.</Text>

      <Card style={styles.card}>
        <Text style={styles.tipTitle}>Why this matters:</Text>
        <Text style={styles.tipText}>
          Missing alarms reduces your wake score and breaks your active wake streaks. Your group members have been notified that you did not wake up on time.
        </Text>
        <Text style={styles.motivationalQuote}>
          "Tomorrow is a fresh opportunity to conquer your morning. You've got this!"
        </Text>
      </Card>

      <Button title="Back to Home Dashboard" onPress={handleFinish} variant="danger" style={styles.finishBtn} />
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
  xmark: {
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
  card: {
    width: '100%',
    padding: 16,
    marginBottom: 40,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  motivationalQuote: {
    fontSize: 13,
    color: '#013237',
    fontStyle: 'italic',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    textAlign: 'center',
  },
  finishBtn: {
    width: '100%',
  },
});
