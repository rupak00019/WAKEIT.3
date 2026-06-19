import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Pressable,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { Colors, Typography, Spacing } from '@/constants/theme';

interface MenuItem {
  icon: string;
  label: string;
  href: string;
  danger?: boolean;
}

export default function Profile() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const [avgWakeScore, setAvgWakeScore] = useState<number>(100);
  const [bestStreak, setBestStreak] = useState<number>(0);

  const fetchUserStats = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('wake_score, current_streak')
        .eq('user_id', profile.id)
        .eq('is_active', true);

      if (!error && data && data.length > 0) {
        const scores = data.map((m) => m.wake_score || 0);
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const maxStreak = Math.max(...data.map((m) => m.current_streak || 0));
        setAvgWakeScore(avg);
        setBestStreak(maxStreak);
      }
    } catch (err) {
      console.warn('Failed to fetch user stats:', err);
    }
  };

  useEffect(() => { fetchUserStats(); }, [profile]);

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/(auth)/login');
          } catch (err: any) {
            Alert.alert('Logout Error', err.message);
          }
        },
      },
    ]);
  };

  const getPlanLabel = () => {
    switch (profile?.plan_type) {
      case 'admin': return { label: 'Admin', color: Colors.dark };
      case 'member': return { label: 'Member', color: Colors.primary };
      case 'free_trial': return { label: 'Free Trial', color: Colors.warning };
      default: return { label: 'Free', color: Colors.textDisabled };
    }
  };

  const plan = getPlanLabel();

  const menuItems: MenuItem[] = [
    { icon: '⚙️', label: 'Account Settings', href: '/settings' },
    { icon: '🔔', label: 'Notifications', href: '/notifications' },
    { icon: '🔐', label: 'System Permissions', href: '/permissions' },
    { icon: '💳', label: 'Manage Plan', href: '/(auth)/plans' },
    { icon: '❓', label: 'Help & Support', href: '/help' },
  ];

  const wakeScoreColor = avgWakeScore >= 80 ? Colors.primary : avgWakeScore >= 60 ? Colors.warning : Colors.error;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Profile hero */}
      <View style={styles.hero}>
        <View style={styles.avatarWrapper}>
          <Avatar
            name={profile?.full_name || profile?.email}
            url={profile?.avatar_url}
            size={88}
          />
          <View style={[styles.planBadge, { backgroundColor: plan.color }]}>
            <Text style={styles.planBadgeText}>{plan.label}</Text>
          </View>
        </View>
        <Text style={styles.name}>{profile?.full_name || 'WAKEIT User'}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        {profile?.plan_type === 'free_trial' && profile.trial_ends_at && (
          <View style={styles.trialWarning}>
            <Text style={styles.trialWarningText}>
              🕐 Trial ends {new Date(profile.trial_ends_at).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: wakeScoreColor }]}>
            {Math.round(avgWakeScore)}%
          </Text>
          <Text style={styles.statLabel}>Wake Score</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.primary }]}>{bestStreak}</Text>
          <Text style={styles.statLabel}>Best Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.dark }]}>🏆</Text>
          <Text style={styles.statLabel}>Rank</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menuSection}>
        <Text style={styles.menuTitle}>Account</Text>
        {menuItems.map((item) => (
          <Link key={item.label} href={item.href as any} asChild>
            <Pressable>
              {({ pressed }) => (
                <View style={[styles.menuItem, pressed && styles.menuItemPressed]}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                  <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>
                    {item.label}
                  </Text>
                  <Text style={styles.menuChevron}>›</Text>
                </View>
              )}
            </Pressable>
          </Link>
        ))}
      </View>

      {/* Logout */}
      <Button
        title="Log Out"
        onPress={handleLogout}
        variant="danger"
        style={styles.logoutBtn}
      />

      <Text style={styles.version}>WAKEIT v1.0.0</Text>
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
  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  planBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  planBadgeText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.surface,
    letterSpacing: 0.5,
  },
  name: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h1,
    fontWeight: '700',
    color: Colors.dark,
    marginBottom: 4,
  },
  email: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  trialWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  trialWarningText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statItem: {
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
    marginTop: 4,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.divider,
  },
  // Menu
  menuSection: {
    marginBottom: Spacing.lg,
  },
  menuTitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  menuItemPressed: {
    opacity: 0.8,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: Spacing.md,
  },
  menuLabel: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    fontWeight: '500',
    color: Colors.dark,
    flex: 1,
  },
  menuLabelDanger: {
    color: Colors.error,
  },
  menuChevron: {
    fontSize: 20,
    color: Colors.textDisabled,
  },
  logoutBtn: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  version: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    color: Colors.textDisabled,
    textAlign: 'center',
  },
});
