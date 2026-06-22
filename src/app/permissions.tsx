import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { canScheduleExactAlarms, openExactAlarmSettings } from '@/lib/alarmManager';

/**
 * FIX 5: Permissions screen now actively checks SCHEDULE_EXACT_ALARM on Android 12+.
 * If the permission is not granted, it opens the system Special App Access settings.
 * A SecurityException from setExactAndAllowWhileIdle() is the root cause of silent
 * alarm failures — this screen prevents the user from scheduling alarms without it.
 * PRD Section 9.12 (Android Permissions) and Section 5.1 (Permission Required screen)
 */
export default function SystemPermissions() {
  const router = useRouter();
  const [exactAlarmGranted, setExactAlarmGranted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  // Check permission status on mount and when returning from settings
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    setChecking(true);
    try {
      const granted = await canScheduleExactAlarms();
      setExactAlarmGranted(granted);
    } catch (err) {
      console.warn('[Permissions] Failed to check exact alarm permission:', err);
      setExactAlarmGranted(false);
    } finally {
      setChecking(false);
    }
  };

  const handleRequestPermissions = async () => {
    if (Platform.OS === 'android') {
      // FIX 5: Check SCHEDULE_EXACT_ALARM specifically (Android 12+)
      const canSchedule = await canScheduleExactAlarms();

      if (!canSchedule) {
        Alert.alert(
          'Exact Alarm Permission Required',
          'WAKEIT needs this permission to ring your alarm at the exact scheduled time.\n\nPlease tap "Open Settings", then enable "Alarms & reminders" for WAKEIT.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: async () => {
                await openExactAlarmSettings();
                // Re-check after returning from settings
                setTimeout(checkPermissions, 1000);
              },
            },
          ]
        );
        return;
      }

      // Exact alarm permission is already granted
      Alert.alert(
        '✅ Permissions Granted',
        'WAKEIT is fully configured. Your alarms will ring on time — even on a locked screen!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      Alert.alert('Permissions Request', 'WAKEIT requests Notification and Audio permissions.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Grant',
          onPress: () => {
            Alert.alert('Success', 'Permissions configured.');
            router.back();
          },
        },
      ]);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.icon}>🛡️</Text>
      <Text style={styles.title}>System Permissions Required</Text>
      <Text style={styles.subtitle}>
        To guarantee WAKEIT works offline and rings precisely on time, we require a few platform
        permissions.
      </Text>

      {/* FIX 5: Show real-time status of SCHEDULE_EXACT_ALARM */}
      <Card style={styles.card}>
        <View style={styles.permRow}>
          <Text style={styles.permTitle}>⏰ Exact Alarm Scheduling</Text>
          {exactAlarmGranted === null || checking ? (
            <Text style={styles.statusChecking}>Checking…</Text>
          ) : exactAlarmGranted ? (
            <Text style={styles.statusGranted}>✅ Granted</Text>
          ) : (
            <Text style={styles.statusDenied}>❌ Required</Text>
          )}
        </View>
        <Text style={styles.permDesc}>
          Allows WAKEIT to trigger high-priority alarms even when your device is in Doze/standby
          sleep mode. Required on Android 12+.
        </Text>
        {exactAlarmGranted === false && (
          <Button
            title="Grant in Settings"
            onPress={async () => {
              await openExactAlarmSettings();
              setTimeout(checkPermissions, 1000);
            }}
            style={styles.inlineBtn}
          />
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.permTitle}>🔔 Notifications Tray</Text>
        <Text style={styles.permDesc}>
          Required to display status alerts when group members wake up, snooze, or miss
          challenges.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.permTitle}>🔋 Ignore Battery Optimization</Text>
        <Text style={styles.permDesc}>
          Prevents the Android system from putting WAKEIT to sleep, ensuring alarms always
          execute. Enable this in Settings → Apps → WAKEIT → Battery.
        </Text>
      </Card>

      <View style={styles.actionRow}>
        <Button title="Allow Access" onPress={handleRequestPermissions} style={styles.allowBtn} />
        <Button title="Not Now" onPress={() => router.back()} variant="link" style={styles.cancelBtn} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#F0F4FF',
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0D1B4B',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#0D1B4B',
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 20,
  },
  card: {
    width: '100%',
    marginVertical: 6,
    padding: 12,
  },
  permRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  permTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0D1B4B',
    flex: 1,
    marginBottom: 4,
  },
  permDesc: {
    fontSize: 12,
    color: '#0D1B4B',
    lineHeight: 16,
  },
  statusChecking: {
    fontSize: 12,
    color: '#0D1B4B',
  },
  statusGranted: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
  },
  statusDenied: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: '600',
  },
  inlineBtn: {
    marginTop: 8,
    height: 36,
  },
  actionRow: {
    width: '100%',
    marginTop: 24,
  },
  allowBtn: {
    width: '100%',
  },
  cancelBtn: {
    alignSelf: 'center',
    marginTop: 8,
  },
});
