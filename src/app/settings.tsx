import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function Settings() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateEmail = async () => {
    if (!newEmail) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'Verification email sent to confirm your new email.');
        setNewEmail('');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'Password updated successfully!');
        setNewPassword('');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '🚨 Danger Zone: Delete Account',
      'Are you absolutely sure you want to delete your account? This will erase all your streaks, wake scores, and group history. This is permanent.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Delete user row from database
              if (profile?.id) {
                const { error } = await supabase
                  .from('users')
                  .delete()
                  .eq('id', profile.id);
                
                if (error) throw error;
              }
              // Sign out and redirect
              await signOut();
              Alert.alert('Deleted', 'Your account has been deleted.');
              router.replace('/(auth)/signup');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete account');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Account Settings</Text>

        {/* Change Email */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Update Email</Text>
          <Text style={styles.currentEmail}>Current Email: {profile?.email}</Text>
          <Input
            label="New Email Address"
            placeholder="newemail@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={newEmail}
            onChangeText={setNewEmail}
          />
          <Button title="Update Email" onPress={handleUpdateEmail} loading={loading} style={styles.saveBtn} />
        </Card>

        {/* Change Password */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <Input
            label="New Password"
            placeholder="Min 6 characters"
            secureTextEntry
            autoCapitalize="none"
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <Button title="Update Password" onPress={handleUpdatePassword} loading={loading} style={styles.saveBtn} />
        </Card>

        {/* Info */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>About WAKEIT</Text>
          <Text style={styles.aboutText}>App Version: 1.0.0 (Expo v56)</Text>
          <Button title="Privacy Policy" onPress={() => Alert.alert('Privacy Policy', 'WAKEIT respects your privacy.')} variant="link" style={styles.linkBtn} />
          <Button title="Terms of Service" onPress={() => Alert.alert('Terms of Service', 'WAKEIT terms of usage.')} variant="link" style={styles.linkBtn} />
        </Card>

        {/* Danger zone */}
        <Card style={[styles.sectionCard, styles.dangerCard]}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <Text style={styles.dangerText}>Once deleted, your account cannot be recovered.</Text>
          <Button title="Delete Account" onPress={handleDeleteAccount} variant="danger" loading={loading} />
        </Card>

        <Button title="Go Back" onPress={() => router.back()} variant="secondary" style={styles.backBtn} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBF7',
  },
  scrollContent: {
    padding: 24,
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#013237',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionCard: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#013237',
    marginBottom: 8,
  },
  currentEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 13,
    color: '#6B7280',
    marginVertical: 4,
  },
  linkBtn: {
    alignSelf: 'flex-start',
    padding: 0,
    marginVertical: 4,
    minHeight: 0,
  },
  dangerCard: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 4,
  },
  dangerText: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 16,
  },
  saveBtn: {
    marginTop: 8,
  },
  backBtn: {
    marginVertical: 24,
    marginBottom: 48,
  },
});
