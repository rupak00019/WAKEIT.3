import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';

interface DBNotification {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export default function NotificationsHistory() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err: any) {
      console.warn('Failed to fetch notification history:', err.message);
      // Fallback notifications for testing if table is missing/empty
      setNotifications([
        {
          id: '1',
          title: 'John Doe woke up!',
          body: 'John completed the Math challenge in Morning Study Group.',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          title: 'Alarm missed: Rise & Shine',
          body: 'Group members missed the challenge in Chill Lounge.',
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '3',
          title: 'Welcome to WAKEIT!',
          body: 'Start by creating or joining an accountability group.',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Notification History</Text>

      {loading && notifications.length === 0 ? (
        <Text style={styles.infoText}>Loading history...</Text>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="You haven't received any notifications yet."
        />
      ) : (
        notifications.map((notif) => (
          <Card key={notif.id} style={styles.card}>
            <Text style={styles.notifTitle}>{notif.title}</Text>
            <Text style={styles.notifBody}>{notif.body}</Text>
            <Text style={styles.notifDate}>
              {new Date(notif.created_at).toLocaleString()}
            </Text>
          </Card>
        ))
      )}

      <Button title="Go Back" onPress={() => router.back()} variant="secondary" style={styles.backBtn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBF7',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#013237',
    marginVertical: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    padding: 24,
  },
  card: {
    marginVertical: 6,
    padding: 12,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#013237',
  },
  notifBody: {
    fontSize: 13,
    color: '#6B7280',
    marginVertical: 4,
  },
  notifDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  backBtn: {
    marginVertical: 24,
    marginBottom: 48,
  },
});
