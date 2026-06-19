import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, BackHandler } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Button from '@/components/ui/Button';
import { startAlarmSoundAndVibration } from '@/lib/alarmSound';
import { getAlarm } from '@/lib/sqlite';

export default function AlarmRing() {
  const router = useRouter();
  const { alarmId, alarmTitle, groupName } = useLocalSearchParams<{
    alarmId: string;
    alarmTitle: string;
    groupName: string;
  }>();

  const [currentTime, setCurrentTime] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [alarmTime, setAlarmTime] = useState('');

  useEffect(() => {
    if (alarmId) {
      getAlarm(alarmId).then((alarm) => {
        if (alarm) {
          if (alarm.difficulty === 'easy' || alarm.difficulty === 'medium' || alarm.difficulty === 'hard') {
            setDifficulty(alarm.difficulty);
          }
          setAlarmTime(alarm.alarm_time_utc);
        }
      }).catch((err) => {
        console.warn('Failed to fetch alarm details from sqlite:', err);
      });
    }
  }, [alarmId]);

  useEffect(() => {
    // 1. Update clock time every second
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    // 2. Start heavy continuous vibration pattern and sound loop
    startAlarmSoundAndVibration();

    // 3. Disable hardware back button on Android
    const backAction = () => {
      return true; // prevent back action
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      clearInterval(interval);
      backHandler.remove();
    };
  }, []);

  const handleStopAlarm = () => {
    router.replace({
      pathname: '/alarm/challenge',
      params: {
        alarmId,
        alarmTitle,
        groupName,
        difficulty,
        alarmTime: alarmTime || new Date().toISOString()
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.ringingText}>⏰ ALARM RINGING</Text>
        <Text style={styles.groupName}>{groupName || 'Accountability Group'}</Text>
        <Text style={styles.title}>{alarmTitle || 'Wake Up!'}</Text>
      </View>

      <Text style={styles.time}>{currentTime}</Text>

      <View style={styles.footer}>
        <Text style={styles.warningText}>No snooze button. Complete the challenge to silence.</Text>
        <Button
          title="I'm Awake — Show Challenge"
          onPress={handleStopAlarm}
          style={styles.actionBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#013237', // Dark background for alarm screen
    padding: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 48,
  },
  ringingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
    letterSpacing: 2,
    marginBottom: 8,
  },
  groupName: {
    fontSize: 18,
    color: '#C0E6BA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
    textAlign: 'center',
  },
  time: {
    fontSize: 54,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 48,
  },
  warningText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16,
    textAlign: 'center',
  },
  actionBtn: {
    width: '100%',
    height: 60,
  },
});
