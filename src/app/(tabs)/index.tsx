import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  StatusBar,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useGroupStore } from '@/store/groupStore';
import { supabase } from '@/lib/supabase';
import { getFutureAlarms, insertOrUpdateAlarm, LocalAlarm } from '@/lib/sqlite';
import CountdownTimer from '@/components/group/CountdownTimer';
import Button from '@/components/ui/Button';
import { Colors, Typography, Spacing } from '@/constants/theme';

interface DBNotification {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export default function HomeDashboard() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { groups, fetchGroups } = useGroupStore();
  const [refreshing, setRefreshing] = useState(false);
  const [nextAlarm, setNextAlarm] = useState<LocalAlarm | null>(null);
  const [recentNotifications, setRecentNotifications] = useState<DBNotification[]>([]);

  const syncAlarmsAndFetch = async () => {
    try {
      await fetchGroups();
      const { data: userGroups } = await supabase
        .from('groups')
        .select('id, name')
        .eq('is_active', true);

      if (userGroups && userGroups.length > 0) {
        for (const grp of userGroups) {
          const { data: groupAlarms } = await supabase
            .from('alarms')
            .select('*')
            .eq('group_id', grp.id)
            .eq('status', 'scheduled');

          if (groupAlarms) {
            for (const alarm of groupAlarms) {
              await insertOrUpdateAlarm({
                alarm_id: alarm.id,
                group_id: alarm.group_id,
                group_name: grp.name,
                alarm_time_utc: new Date(alarm.alarm_time).toISOString(),
                // Convert UTC from Supabase to device local time for display (PRD §5.3)
                alarm_time_local: new Date(alarm.alarm_time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                }),
                difficulty: alarm.difficulty,
                sound_path: alarm.sound_url || undefined,
                is_recurring: alarm.is_recurring ? 1 : 0,
                recurrence_days: alarm.recurrence_days ? JSON.stringify(alarm.recurrence_days) : undefined,
                recurrence_end: alarm.recurrence_end_date || undefined,
                status: alarm.status,
              });
            }
          }
        }
      }

      const localAlarms = await getFutureAlarms();
      setNextAlarm(localAlarms && localAlarms.length > 0 ? localAlarms[0] : null);

      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

      if (notifs) setRecentNotifications(notifs);
    } catch (err) {
      console.warn('Sync or fetch error:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await syncAlarmsAndFetch();
    setRefreshing(false);
  };

  useEffect(() => { syncAlarmsAndFetch(); }, []);

  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'there';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header greeting */}
      <View style={styles.header}>
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.name}>{firstName} 👋</Text>
          </View>
          <Link href="/notifications" asChild>
            <Pressable style={styles.notifBtn}>
              <Text style={styles.notifIcon}>🔔</Text>
              {recentNotifications.length > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{recentNotifications.length}</Text>
                </View>
              )}
            </Pressable>
          </Link>
        </View>
      </View>

      {/* Next Alarm Card */}
      {nextAlarm ? (
        <View style={styles.nextAlarmCard}>
          <View style={styles.nextAlarmLabel}>
            <View style={styles.alarmDot} />
            <Text style={styles.nextAlarmLabelText}>NEXT ALARM</Text>
          </View>
          <Text style={styles.alarmGroupName}>{nextAlarm.group_name || 'Group Alarm'}</Text>
          <Text style={styles.alarmTime}>{nextAlarm.alarm_time_local}</Text>
          <CountdownTimer nextAlarmTime={nextAlarm.alarm_time_utc} />
        </View>
      ) : (
        <View style={styles.noAlarmCard}>
          <Text style={styles.noAlarmEmoji}>😴</Text>
          <Text style={styles.noAlarmTitle}>No Upcoming Alarms</Text>
          <Text style={styles.noAlarmSub}>Join a group or create one to schedule alarms.</Text>
          <Link href="/(tabs)/groups" asChild>
            <Button title="View Groups" onPress={() => {}} variant="secondary" style={styles.noAlarmBtn} />
          </Link>
        </View>
      )}

      {/* Groups Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Groups</Text>
          <Link href="/(tabs)/groups" asChild>
            <Button title="See All" onPress={() => {}} variant="link" style={styles.seeAllBtn} />
          </Link>
        </View>

        {groups.slice(0, 3).map((group) => (
          <Link key={group.id} href={`/group/${group.id}`} asChild>
            <Pressable>
              {({ pressed }) => (
                <View style={[styles.groupCard, pressed && styles.groupCardPressed]}>
                  <View style={styles.groupIconBox}>
                    <Text style={styles.groupIcon}>👥</Text>
                  </View>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupMeta}>{group.member_count} members</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              )}
            </Pressable>
          </Link>
        ))}

        {groups.length === 0 && (
          <View style={styles.emptyGroups}>
            <Text style={styles.emptyGroupsText}>You're not in any groups yet</Text>
          </View>
        )}
      </View>

      {/* Recent Notifications */}
      {recentNotifications.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <Link href="/notifications" asChild>
              <Button title="See All" onPress={() => {}} variant="link" style={styles.seeAllBtn} />
            </Link>
          </View>

          {recentNotifications.map((notif) => (
            <View key={notif.id} style={styles.notifCard}>
              <View style={styles.notifDot} />
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle}>{notif.title}</Text>
                <Text style={styles.notifBody}>{notif.body}</Text>
                <Text style={styles.notifDate}>
                  {new Date(notif.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 48,
    paddingBottom: 48,
  },
  // Header
  header: {
    marginBottom: Spacing.lg,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
  },
  name: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h1,
    fontWeight: '700',
    color: Colors.dark,
    marginTop: 2,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
    position: 'relative',
  },
  notifIcon: {
    fontSize: 20,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.surface,
  },
  // Next Alarm card
  nextAlarmCard: {
    backgroundColor: Colors.dark,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: Colors.dark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
  },
  nextAlarmLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  alarmDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: 6,
  },
  nextAlarmLabelText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
  },
  alarmGroupName: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.accent,
    marginBottom: 4,
  },
  alarmTime: {
    fontFamily: Typography.fonts.regular,
    fontSize: 44,
    fontWeight: '700',
    color: Colors.surface,
    letterSpacing: -1,
  },
  // No alarm card
  noAlarmCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    borderStyle: 'dashed',
  },
  noAlarmEmoji: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  noAlarmTitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h3,
    fontWeight: '600',
    color: Colors.dark,
    marginBottom: Spacing.xs,
  },
  noAlarmSub: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  noAlarmBtn: {
    width: 160,
  },
  // Section
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h3,
    fontWeight: '700',
    color: Colors.dark,
  },
  seeAllBtn: {
    marginVertical: 0,
    padding: 0,
    minHeight: 0,
    height: 'auto',
  },
  // Group cards
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  groupCardPressed: {
    opacity: 0.85,
  },
  groupIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  groupIcon: {
    fontSize: 20,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    fontWeight: '600',
    color: Colors.dark,
  },
  groupMeta: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: Colors.textDisabled,
  },
  emptyGroups: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  emptyGroupsText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
  },
  // Notification cards
  notifCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 5,
    marginRight: Spacing.md,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    fontWeight: '600',
    color: Colors.dark,
    marginBottom: 2,
  },
  notifBody: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  notifDate: {
    fontFamily: Typography.fonts.regular,
    fontSize: 10,
    color: Colors.textDisabled,
  },
});
