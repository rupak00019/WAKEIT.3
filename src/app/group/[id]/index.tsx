import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  StatusBar,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { useGroupStore, Group } from '@/store/groupStore';
import { useAlarmStore } from '@/store/alarmStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import CountdownTimer from '@/components/group/CountdownTimer';
import AlarmsList from '@/components/alarm/AlarmsList';
import MemberStatusGrid from '@/components/group/MemberStatusGrid';
import { Colors, Typography, Spacing } from '@/constants/theme';

export default function GroupDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { profile } = useAuthStore();
  const { members, fetchMembers, subscribeToCompletions, unsubscribeFromCompletions } = useGroupStore();
  const { alarms, fetchAlarms, subscribeToAlarms, unsubscribeFromAlarms } = useAlarmStore();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGroupDetails = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase.from('groups').select('*').eq('id', id).single();
      if (error) throw error;
      setGroup(data);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to retrieve group details.');
    }
  };

  const loadAllData = async () => {
    if (!id) return;
    setLoading(true);
    await Promise.all([loadGroupDetails(), fetchAlarms(id), fetchMembers(id)]);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (id) {
      loadAllData();
      subscribeToAlarms(id);
      subscribeToCompletions(id);
    }
    return () => {
      unsubscribeFromAlarms();
      unsubscribeFromCompletions();
    };
  }, [id]);

  const isAdmin = profile?.id === group?.admin_id;

  const getNextAlarmTime = () => {
    if (alarms.length === 0) return null;
    const now = new Date();
    const scheduled = alarms
      .filter((a) => a.status === 'scheduled')
      .map((a) => {
        let alarmDate = new Date();
        if (a.alarm_time.includes('T')) {
          alarmDate = new Date(a.alarm_time);
        } else {
          const [hours, minutes] = a.alarm_time.split(':');
          alarmDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
          if (alarmDate < now) alarmDate.setDate(alarmDate.getDate() + 1);
        }
        return { ...a, parsedTime: alarmDate };
      })
      .sort((a, b) => a.parsedTime.getTime() - b.parsedTime.getTime());
    return scheduled.length > 0 ? scheduled[0].parsedTime.toISOString() : null;
  };

  const nextAlarmIso = getNextAlarmTime();
  const activeAlarms = alarms.filter((a) => a.status === 'scheduled').length;

  if (loading && !group) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingEmoji}>⏳</Text>
        <Text style={styles.loadingText}>Loading group...</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingEmoji}>❌</Text>
        <Text style={styles.loadingText}>Group not found</Text>
        <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: Spacing.md }} />
      </View>
    );
  }

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

      {/* Group header card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.groupIconCircle}>
            <Text style={styles.groupIconEmoji}>👥</Text>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description && (
              <Text style={styles.groupDesc}>{group.description}</Text>
            )}
            <View style={styles.inviteRow}>
              <Text style={styles.inviteLabel}>Code: </Text>
              <Text style={styles.inviteCode}>{group.invite_code}</Text>
            </View>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{members.length}</Text>
            <Text style={styles.heroStatLabel}>Members</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{activeAlarms}</Text>
            <Text style={styles.heroStatLabel}>Active Alarms</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: isAdmin ? Colors.primary : Colors.textSecondary }]}>
              {isAdmin ? '👑' : '👤'}
            </Text>
            <Text style={styles.heroStatLabel}>{isAdmin ? 'Admin' : 'Member'}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.heroActions}>
          <Link href={`/group/${id}/members`} asChild>
            <Button title="Roster" onPress={() => {}} variant="secondary" style={styles.heroBtn} />
          </Link>
          {isAdmin && (
            <Link href={`/group/${id}/alarm/create`} asChild>
              <Button title="+ Add Alarm" onPress={() => {}} style={styles.heroBtn} />
            </Link>
          )}
        </View>
      </View>

      {/* Countdown section */}
      {nextAlarmIso ? (
        <View style={styles.countdownSection}>
          <Text style={styles.sectionTitle}>⏰ Next Alarm</Text>
          <CountdownTimer nextAlarmTime={nextAlarmIso} />
        </View>
      ) : (
        <View style={styles.noAlarmBanner}>
          <Text style={styles.noAlarmEmoji}>😴</Text>
          <Text style={styles.noAlarmText}>No alarms scheduled for this group</Text>
          {isAdmin && (
            <Link href={`/group/${id}/alarm/create`} asChild>
              <Button title="Schedule First Alarm" onPress={() => {}} style={{ marginTop: Spacing.md, width: 200 }} />
            </Link>
          )}
        </View>
      )}

      {/* Alarms list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Group Alarms</Text>
        <AlarmsList alarms={alarms} groupId={group.id} />
      </View>

      {/* Member status grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🟢 Member Status</Text>
        <MemberStatusGrid members={members} />
      </View>

      <View style={{ height: 48 }} />
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
    paddingBottom: 24,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  loadingText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
  },
  // Hero card
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 5,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  groupIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  groupIconEmoji: {
    fontSize: 26,
  },
  heroInfo: {
    flex: 1,
  },
  groupName: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h2,
    fontWeight: '700',
    color: Colors.dark,
    marginBottom: 4,
  },
  groupDesc: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    marginBottom: 6,
    lineHeight: 18,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteLabel: {
    fontFamily: Typography.fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  inviteCode: {
    fontFamily: Typography.fonts.regular,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h2,
    fontWeight: '700',
    color: Colors.dark,
  },
  heroStatLabel: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.divider,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
  },
  heroBtn: {
    flex: 1,
  },
  // Countdown
  countdownSection: {
    marginBottom: Spacing.lg,
  },
  noAlarmBanner: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    borderStyle: 'dashed',
  },
  noAlarmEmoji: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  noAlarmText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h3,
    fontWeight: '700',
    color: Colors.dark,
    marginBottom: Spacing.md,
  },
});
