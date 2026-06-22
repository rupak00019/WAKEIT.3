import React from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { Link } from 'expo-router';
import { Alarm } from '@/store/alarmStore';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

interface AlarmsListProps {
  alarms: Alarm[];
  groupId: string;
}

export default function AlarmsList({ alarms, groupId }: AlarmsListProps) {
  // Bug 1 fix: alarm_time is a full ISO UTC string (e.g. "2026-06-22T07:30:00Z").
  // Must parse with new Date(), not split(':'), to get the correct local time.
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      const hour = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const getDifficultyStatus = (diff: string) => {
    switch (diff) {
      case 'easy': return 'completed';
      case 'medium': return 'pending';
      case 'hard': return 'missed';
      default: return 'default';
    }
  };

  // Bug 2 fix: Only show active/scheduled alarms. Cancelled and completed
  // alarms must not appear in the Group Dashboard list per PRD §5.3.
  const visibleAlarms = alarms.filter(
    (a) => a.status === 'scheduled' || a.status === 'active'
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Group Alarms</Text>
      {visibleAlarms.length === 0 ? (
        <Text style={styles.emptyText}>No alarms scheduled. Ask the Admin to add one!</Text>
      ) : (
        <FlatList
          data={visibleAlarms}
          keyExtractor={(item) => item.id}
          scrollEnabled={false} // Since it will be rendered inside screen ScrollView
          renderItem={({ item }) => (
            <Link href={`/group/${groupId}/alarm/${item.id}`} asChild>
              <Pressable>
                <Card style={styles.alarmCard}>
                  <View style={styles.left}>
                    <Text style={styles.time}>{formatTime(item.alarm_time)}</Text>
                    <Text style={styles.alarmTitle}>{item.title}</Text>
                    <Text style={styles.days}>
                      {item.is_recurring
                        ? `Repeats (Days: ${item.recurrence_days?.join(', ') || 'None'})`
                        : 'One-time Alarm'}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Badge label={item.difficulty.toUpperCase()} status={getDifficultyStatus(item.difficulty)} />
                    <Text style={[styles.statusText, styles[item.status]]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#013237',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    padding: 12,
    textAlign: 'center',
  },
  alarmCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  left: {
    flex: 1,
  },
  time: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#013237',
  },
  alarmTitle: {
    fontSize: 14,
    color: '#374151',
    marginTop: 2,
  },
  days: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  right: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 6,
  },
  scheduled: { color: '#4CA771' },
  active: { color: '#F59E0B' },
  completed: { color: '#10B981' },
  cancelled: { color: '#EF4444' },
});
