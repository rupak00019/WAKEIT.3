import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CountdownTimerProps {
  nextAlarmTime: string | null; // ISO string or time string e.g. "2026-06-17T07:30:00"
}

export default function CountdownTimer({ nextAlarmTime }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('00:00:00');

  useEffect(() => {
    if (!nextAlarmTime) {
      setTimeLeft('--:--:--');
      return;
    }

    const calculateTimeLeft = () => {
      const difference = new Date(nextAlarmTime).getTime() - new Date().getTime();
      
      if (difference <= 0) {
        setTimeLeft('00:00:00');
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      const formatted = [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0')
      ].join(':');

      setTimeLeft(formatted);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [nextAlarmTime]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Countdown to Next Alarm</Text>
      <Text style={styles.timer}>{timeLeft}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 12,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timer: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#013237',
  },
});
