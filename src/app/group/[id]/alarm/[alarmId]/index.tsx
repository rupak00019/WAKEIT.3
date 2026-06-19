import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { useAlarmStore, Alarm, AlarmCompletion } from '@/store/alarmStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { Colors, Typography, Spacing } from '@/constants/theme';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AlarmDetails() {
  const { id: groupId, alarmId } = useLocalSearchParams<{ id: string; alarmId: string }>();
  const router = useRouter();

  const { profile } = useAuthStore();
  const { deleteAlarm, completions, fetchCompletions } = useAlarmStore();

  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);

  const fetchAlarmAndGroup = async () => {
    if (!alarmId || !groupId) return;
    try {
      // 1. Fetch alarm details
      const { data: alarmData, error: alarmErr } = await supabase
        .from('alarms')
        .select('*')
        .eq('id', alarmId)
        .single();

      if (alarmErr) throw alarmErr;
      setAlarm(alarmData);

      // 2. Fetch group details to get admin_id
      const { data: groupData } = await supabase
        .from('groups')
        .select('admin_id')
        .eq('id', groupId)
        .single();
      if (groupData) {
        setAdminId(groupData.admin_id);
      }

      // 3. Fetch completions
      await fetchCompletions(alarmId);
    } catch (err: any) {
      console.warn('Failed to fetch alarm details:', err.message);
      Alert.alert('Error', 'Failed to retrieve alarm details.');
    }
  };

  const loadData = async () => {
    setLoading(true);
    await fetchAlarmAndGroup();
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlarmAndGroup();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [alarmId]);

  const handleDelete = () => {
    if (!alarm || !alarmId) return;
    Alert.alert(
      `Delete ${alarm.title}?`,
      'All members will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteAlarm(alarmId);
            if (res.success) {
              Alert.alert('Success', 'Alarm has been deleted.', [
                { text: 'OK', onPress: () => router.replace(`/group/${groupId}`) }
              ]);
            } else {
              Alert.alert('Error', res.error || 'Failed to delete alarm.');
            }
          },
        },
      ]
    );
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const hour = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    } catch {
      return isoString || '';
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString || '';
    }
  };

  const getRecurrenceText = (days?: number[]) => {
    if (!days || days.length === 0) return 'None';
    return days.map(d => DAY_LABELS[d]).join(', ');
  };

  if (loading && !alarm) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.infoText}>Loading alarm details...</Text>
      </View>
    );
  }

  if (!alarm) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.infoText}>Alarm not found.</Text>
        <Button title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  const isAdmin = profile?.id === adminId;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card style={styles.detailsCard}>
        <View style={styles.headerRow}>
          <Text style={styles.time}>{formatTime(alarm.alarm_time)}</Text>
          <Badge label={alarm.difficulty.toUpperCase()} status={alarm.difficulty === 'easy' ? 'completed' : alarm.difficulty === 'medium' ? 'pending' : 'missed'} />
        </View>

        <Text style={styles.alarmTitle}>{alarm.title}</Text>
        <Text style={styles.meta}>Scheduled Date: {formatDate(alarm.alarm_time)}</Text>
        <Text style={styles.meta}>
          Recurrence: {alarm.is_recurring ? `Yes (${getRecurrenceText(alarm.recurrence_days)})` : 'One-time'}
        </Text>
        {alarm.recurrence_end_date && (
          <Text style={styles.meta}>Ends on: {alarm.recurrence_end_date}</Text>
        )}
        {alarm.sound_url && <Text style={styles.meta}>Sound preset: {alarm.sound_url}</Text>}
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Badge label={alarm.status.toUpperCase()} status={alarm.status === 'completed' || alarm.status === 'scheduled' ? 'completed' : alarm.status === 'active' ? 'pending' : 'missed'} />
        </View>

        {isAdmin && (
          <View style={styles.adminRow}>
            <Link href={`/group/${groupId}/alarm/${alarmId}/edit`} asChild>
              <Button title="Edit Alarm" onPress={() => {}} variant="secondary" style={styles.actionBtn} />
            </Link>
            <Button title="Delete Alarm" onPress={handleDelete} variant="danger" style={styles.actionBtn} />
          </View>
        )}
      </Card>

      {/* Completion Status List */}
      <View style={styles.completionSection}>
        <Text style={styles.sectionTitle}>Completion Roster</Text>
        {completions.length === 0 ? (
          <Text style={styles.emptyText}>No completion records found.</Text>
        ) : (
          completions.map((comp) => {
            const userName = comp.user?.full_name || 'Group Member';
            return (
              <Card key={comp.id} style={styles.compCard}>
                <View style={styles.compRow}>
                  <View style={styles.userInfo}>
                    <Avatar name={userName} url={comp.user?.avatar_url} size={36} />
                    <Text style={styles.userName}>{userName}</Text>
                  </View>
                  <View style={styles.statusInfo}>
                    <Badge label={comp.status.toUpperCase()} status={comp.status === 'completed' ? 'completed' : comp.status === 'pending' ? 'pending' : 'missed'} />
                    {comp.completed_at && (
                      <Text style={styles.compTime}>
                        {new Date(comp.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </View>

      <Button title="Back to Group Dashboard" onPress={() => router.replace(`/group/${groupId}`)} variant="link" style={styles.backLink} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
  },
  detailsCard: {
    marginVertical: 12,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontFamily: Typography.fonts.semibold,
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.dark,
  },
  alarmTitle: {
    fontFamily: Typography.fonts.semibold,
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark,
    marginVertical: 8,
  },
  meta: {
    fontFamily: Typography.fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    marginVertical: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  statusLabel: {
    fontFamily: Typography.fonts.semibold,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  adminRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
  },
  completionSection: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontFamily: Typography.fonts.semibold,
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark,
    marginBottom: 12,
  },
  compCard: {
    marginVertical: 4,
    padding: 12,
  },
  compRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontFamily: Typography.fonts.semibold,
    fontSize: 14,
    color: Colors.dark,
  },
  statusInfo: {
    alignItems: 'flex-end',
  },
  compTime: {
    fontFamily: Typography.fonts.regular,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  emptyText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    padding: 12,
    textAlign: 'center',
  },
  backLink: {
    marginVertical: 24,
    alignSelf: 'center',
  },
});
