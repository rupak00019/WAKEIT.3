import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  Pressable,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useGroupStore } from '@/store/groupStore';
import { useAuthStore } from '@/store/authStore';
import GroupCard from '@/components/group/GroupCard';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Colors, Typography, Spacing } from '@/constants/theme';

export default function GroupsList() {
  const router = useRouter();
  const { groups, fetchGroups, loading } = useGroupStore();
  const { canCreateGroups } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadGroups = async () => { await fetchGroups(); };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGroups();
    setRefreshing(false);
  };

  useEffect(() => { loadGroups(); }, []);

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

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Groups</Text>
        <Text style={styles.subtitle}>
          {groups.length > 0 ? `${groups.length} accountability group${groups.length > 1 ? 's' : ''}` : 'No groups yet'}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <Link href="/group/join" asChild>
          <Button
            title="Join Group"
            onPress={() => {}}
            variant="secondary"
            style={styles.actionBtn}
          />
        </Link>
        {canCreateGroups() && (
          <Link href="/group/create" asChild>
            <Button
              title="+ Create Group"
              onPress={() => {}}
              style={styles.actionBtn}
            />
          </Link>
        )}
      </View>

      {/* Stats row */}
      {groups.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{groups.length}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {groups.reduce((sum, g) => sum + (g.member_count || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{groups.filter(g => g.admin_id).length}</Text>
            <Text style={styles.statLabel}>Admin</Text>
          </View>
        </View>
      )}

      {/* Group list */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>All Groups</Text>

        {loading && groups.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading groups...</Text>
          </View>
        ) : groups.length === 0 ? (
          <EmptyState
            title="No groups found"
            description="Join a group with an invite code, or create a new group to get started."
            actionText="Join a Group"
            onAction={() => router.push('/group/join')}
          />
        ) : (
          groups.map((group) => <GroupCard key={group.id} group={group} />)
        )}
      </View>
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
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.display,
    fontWeight: '700',
    color: Colors.dark,
  },
  subtitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h1,
    fontWeight: '700',
    color: Colors.dark,
  },
  statLabel: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.divider,
  },
  listSection: {
    marginTop: 0,
  },
  sectionTitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h3,
    fontWeight: '700',
    color: Colors.dark,
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  loadingText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
  },
});
