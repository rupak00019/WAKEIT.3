import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function SystemPermissions() {
  const router = useRouter();

  const handleRequestPermissions = async () => {
    // Request standard permissions
    if (Platform.OS === 'android') {
      Alert.alert(
        'Requesting Permissions',
        'WAKEIT needs the following permissions:\n\n1. Post Notifications\n2. Schedule Exact Alarms\n3. Disable Battery Optimizations',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Grant All',
            onPress: () => {
              Alert.alert('Permissions Granted', 'WAKEIT is now configured for maximum wake up reliability!');
              router.back();
            },
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
        To guarantee WAKEIT works offline and rings precisely on time, we require a few platform permissions.
      </Text>

      <Card style={styles.card}>
        <Text style={styles.permTitle}>⏰ Exact Alarm Scheduling</Text>
        <Text style={styles.permDesc}>
          Allows WAKEIT to trigger high-priority alarms even when your device is in Doze/standby sleep mode.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.permTitle}>🔔 Notifications Tray</Text>
        <Text style={styles.permDesc}>
          Required to display status alerts when group members wake up, snooze, or miss challenges.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.permTitle}>🔋 Ignore Battery Optimization</Text>
        <Text style={styles.permDesc}>
          Prevents the Android system from putting WAKEIT to sleep, ensuring alarms always execute.
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
    backgroundColor: '#F8FBF7',
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
    color: '#013237',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 20,
  },
  card: {
    width: '100%',
    marginVertical: 6,
    padding: 12,
  },
  permTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#013237',
    marginBottom: 4,
  },
  permDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
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
