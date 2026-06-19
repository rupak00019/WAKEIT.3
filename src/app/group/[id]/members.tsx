import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGroupStore } from '@/store/groupStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { Colors, Typography, Spacing } from '@/constants/theme';

export default function GroupMembers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { profile } = useAuthStore();
  const { members, fetchMembers, removeMember } = useGroupStore();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAdminId = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('admin_id')
        .eq('id', id)
        .single();
      if (!error && data) setAdminId(data.admin_id);
    } catch (err) {
      console.warn('Failed to fetch group admin:', err);
    }
  };

  useEffect(() => {
    if (id) {
      fetchMembers(id);
      fetchAdminId();
    }
  }, [id]);

  const currentUserIsAdmin = profile?.id === adminId;

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!id) return;
    Alert.alert(
      'Remove Member',
      `Remove ${userName} from this group? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const res = await removeMember(id, userId);
            setLoading(false);
            if (res.success) {
              Alert.alert('Done', 'Member has been removed.');
              fetchMembers(id);
            } else {
              Alert.alert('Error', res.error || 'Failed to remove member.');
            }
          },
        },
      ]
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return Colors.primary;
    if (score >= 60) return Colors.warning;
    return Colors.error;
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Group Roster</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{members.length} members</Text>
        </View>
      </View>

      {members.map((member) => {
        const isSelf = member.user_id === profile?.id;
        const isMemberAdmin = member.user_id === adminId;
        const displayName = member.user?.full_name || member.user?.email || 'Unknown';
        const wakeScore = Math.round(member.wake_score || 0);
        const scoreColor = getScoreColor(wakeScore);

        return (
          <View key={member.id} style={[styles.memberCard, isSelf && styles.memberCardSelf]}>
            <View style={styles.memberTop}>
              <Avatar name={displayName} url={member.user?.avatar_url} size={52} />
              <View style={styles.memberInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName}>
                    {displayName}
                    {isSelf ? ' (You)' : ''}
                  </Text>
                  {isMemberAdmin && (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>ADMIN</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.memberEmail}>{member.user?.email}</Text>
              </View>
              {/* Wake score badge */}
              <View style={[styles.scoreBadge, { borderColor: scoreColor }]}>
                <Text style={[styles.scoreValue, { color: scoreColor }]}>{wakeScore}%</Text>
                <Text style={styles.scoreLabel}>score</Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>🔥 {member.current_streak}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>🏆 {member.longest_streak}</Text>
                <Text style={styles.statLabel}>Best</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>✓ {member.total_completed}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>📊 {member.total_alarms_received}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>

            {/* Remove button (admin only, not for self or admin) */}
            {currentUserIsAdmin && !isMemberAdmin && (
              <Button
                title="Remove from Group"
                onPress={() => handleRemoveMember(member.user_id, displayName)}
                variant="danger"
                disabled={loading}
                style={styles.removeBtn}
              />
            )}
          </View>
        );
      })}

      <Button
        title="← Back"
        onPress={() => router.back()}
        variant="secondary"
        style={styles.backBtn}
      />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: 10,
  },
  title: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.display,
    fontWeight: '700',
    color: Colors.dark,
  },
  countPill: {
    backgroundColor: Colors.accent,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  memberCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  memberCardSelf: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  memberTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  memberInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberName: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    fontWeight: '700',
    color: Colors.dark,
  },
  adminBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adminBadgeText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.surface,
    letterSpacing: 0.5,
  },
  memberEmail: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scoreBadge: {
    alignItems: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
  },
  scoreValue: {
    fontFamily: Typography.fonts.regular,
    fontSize: 13,
    fontWeight: '700',
  },
  scoreLabel: {
    fontFamily: Typography.fonts.regular,
    fontSize: 8,
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: Typography.fonts.regular,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark,
  },
  statLabel: {
    fontFamily: Typography.fonts.regular,
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  removeBtn: {
    marginTop: Spacing.sm,
    height: 42,
  },
  backBtn: {
    marginTop: Spacing.md,
  },
});
