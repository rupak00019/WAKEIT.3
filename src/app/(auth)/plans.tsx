import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Pressable,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import { Colors, Typography, Spacing } from '@/constants/theme';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PlanCardProps {
  name: string;
  price: string;
  period: string;
  features: PlanFeature[];
  recommended?: boolean;
  onSelect: () => void;
  loading: boolean;
  ctaLabel: string;
  accentColor: string;
}

function PlanCard({ name, price, period, features, recommended, onSelect, loading, ctaLabel, accentColor }: PlanCardProps) {
  return (
    <Pressable style={[styles.planCard, recommended && styles.planCardHighlighted]} onPress={onSelect}>
      {recommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedText}>⭐ MOST POPULAR</Text>
        </View>
      )}
      <View style={styles.planHeader}>
        <Text style={[styles.planName, recommended && styles.planNameLight]}>{name}</Text>
        <View style={styles.priceRow}>
          <Text style={[styles.planPrice, { color: recommended ? Colors.surface : accentColor }]}>{price}</Text>
          <Text style={[styles.planPeriod, recommended && styles.planPeriodLight]}>/{period}</Text>
        </View>
      </View>
      <View style={styles.planFeatures}>
        {features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={[styles.featureCheck, { color: f.included ? (recommended ? Colors.accent : Colors.primary) : Colors.textDisabled }]}>
              {f.included ? '✓' : '✗'}
            </Text>
            <Text style={[styles.featureText, !f.included && styles.featureTextDisabled, recommended && f.included && styles.featureTextLight]}>
              {f.text}
            </Text>
          </View>
        ))}
      </View>
      <Button
        title={ctaLabel}
        onPress={onSelect}
        loading={loading}
        variant={recommended ? 'secondary' : 'primary'}
        style={[styles.planCTA, recommended && styles.planCTALight]}
      />
    </Pressable>
  );
}

export default function Plans() {
  const router = useRouter();
  const { user, setProfile, toggleMockEntitlements, setMockEntitlements, mockEntitlementsEnabled, mockEntitlements } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const startTrial = async () => {
    if (!user) {
      Alert.alert('Authentication required', 'Please sign in first.');
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      const ends = new Date();
      ends.setDate(ends.getDate() + 3);
      const { data: updatedProfile, error } = await supabase
        .from('users')
        .update({ plan_type: 'free_trial', trial_started_at: now.toISOString(), trial_ends_at: ends.toISOString() })
        .eq('id', user.id)
        .select()
        .single();
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setProfile(updatedProfile);
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start trial');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseMock = async (tier: 'member' | 'admin') => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: updatedProfile, error } = await supabase
        .from('users')
        .update({ plan_type: tier })
        .eq('id', user.id)
        .select()
        .single();
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setProfile(updatedProfile);
        toggleMockEntitlements(true);
        if (tier === 'admin') {
          setMockEntitlements({ wakeit_admin: true, wakeit_member: false });
        } else {
          setMockEntitlements({ wakeit_admin: false, wakeit_member: true });
        }
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const restorePurchases = () => {
    toggleMockEntitlements(true);
    setMockEntitlements({ wakeit_member: true });
    Alert.alert('Restored', 'Entitlements restored.');
    router.replace('/(tabs)');
  };

  const memberFeatures: PlanFeature[] = [
    { text: 'Join unlimited accountability groups', included: true },
    { text: 'Complete wake-up math challenges', included: true },
    { text: 'Live member status tracking', included: true },
    { text: 'Create and manage your own groups', included: false },
    { text: 'Schedule & modify group-wide alarms', included: false },
  ];

  const adminFeatures: PlanFeature[] = [
    { text: 'Join unlimited accountability groups', included: true },
    { text: 'Complete wake-up math challenges', included: true },
    { text: 'Live member status tracking', included: true },
    { text: 'Create and manage your own groups', included: true },
    { text: 'Schedule & modify group-wide alarms', included: true },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>
          Unlock group alarms and accountability challenges
        </Text>
      </View>

      {/* Debug mock toggle — only shown in dev */}
      {__DEV__ && (
        <View style={styles.mockCard}>
          <View style={styles.mockRow}>
            <View>
              <Text style={styles.mockTitle}>🛠 Debug Mode</Text>
              <Text style={styles.mockSubtitle}>Bypass billing for testing</Text>
            </View>
            <Switch
              value={mockEntitlementsEnabled}
              onValueChange={(val) => {
                toggleMockEntitlements(val);
                if (val) setMockEntitlements({ wakeit_member: true });
              }}
              trackColor={{ false: Colors.divider, true: Colors.primary }}
              thumbColor={mockEntitlementsEnabled ? Colors.surface : '#f4f3f4'}
            />
          </View>
          {mockEntitlementsEnabled && (
            <Text style={styles.mockStatus}>
              Active: {JSON.stringify(mockEntitlements)}
            </Text>
          )}
        </View>
      )}

      {/* Member Plan */}
      <PlanCard
        name="WAKEIT Member"
        price="$4.99"
        period="month"
        features={memberFeatures}
        recommended={false}
        onSelect={() => handlePurchaseMock('member')}
        loading={loading}
        ctaLabel="Subscribe Member"
        accentColor={Colors.primary}
      />

      {/* Admin Plan */}
      <PlanCard
        name="WAKEIT Admin"
        price="$9.99"
        period="month"
        features={adminFeatures}
        recommended
        onSelect={() => handlePurchaseMock('admin')}
        loading={loading}
        ctaLabel="Subscribe Admin"
        accentColor={Colors.surface}
      />

      {/* Trial CTA */}
      <View style={styles.trialSection}>
        <Text style={styles.trialLabel}>Not sure yet?</Text>
        <Button
          title="Start 3-Day Free Trial"
          onPress={startTrial}
          variant="secondary"
          loading={loading}
          style={styles.trialButton}
        />
        <Text style={styles.trialNote}>No credit card required. Cancel anytime.</Text>
      </View>

      <Button
        title="Restore Purchases"
        onPress={restorePurchases}
        variant="link"
        style={styles.restoreButton}
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
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.display,
    fontWeight: '700',
    color: Colors.dark,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Debug mock card
  mockCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  mockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mockTitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  mockSubtitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  mockStatus: {
    fontFamily: Typography.fonts.regular,
    fontSize: 10,
    color: '#B45309',
    marginTop: Spacing.sm,
  },
  // Plan cards
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  planCardHighlighted: {
    backgroundColor: Colors.dark,
    borderColor: Colors.dark,
    shadowOpacity: 0.2,
    elevation: 12,
  },
  recommendedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: Spacing.md,
  },
  recommendedText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.surface,
    letterSpacing: 1,
  },
  planHeader: {
    marginBottom: Spacing.md,
  },
  planName: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.h2,
    fontWeight: '700',
    color: Colors.dark,
    marginBottom: 4,
  },
  planNameLight: {
    color: Colors.surface,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontFamily: Typography.fonts.regular,
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
  },
  planPeriod: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  planPeriodLight: {
    color: Colors.accent,
  },
  planFeatures: {
    marginBottom: Spacing.lg,
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureCheck: {
    fontFamily: Typography.fonts.regular,
    fontSize: 14,
    fontWeight: '700',
    width: 16,
  },
  featureText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 13,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  featureTextLight: {
    color: Colors.background,
  },
  featureTextDisabled: {
    color: Colors.textDisabled,
    textDecorationLine: 'line-through',
  },
  planCTA: {
    marginTop: 0,
  },
  planCTALight: {
    borderColor: Colors.surface,
  },
  // Trial section
  trialSection: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  trialLabel: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  trialButton: {
    width: '100%',
    marginBottom: Spacing.sm,
  },
  trialNote: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    color: Colors.textDisabled,
    textAlign: 'center',
  },
  restoreButton: {
    alignSelf: 'center',
  },
});
