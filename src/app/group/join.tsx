import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useGroupStore } from '@/store/groupStore';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function JoinGroup() {
  const router = useRouter();
  const { joinGroup } = useGroupStore();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode || inviteCode.trim().length < 6) {
      Alert.alert('Validation Error', 'Please enter a valid 6-character invite code.');
      return;
    }
    setLoading(true);
    try {
      const res = await joinGroup(inviteCode.trim().toUpperCase());
      if (res.success && res.group_id) {
        Alert.alert(
          'Joined!',
          `You have successfully joined "${res.group_name || 'the group'}"!`,
          [
            {
              text: 'Go to Dashboard',
              onPress: () => router.replace(`/group/${res.group_id}`),
            },
          ]
        );
      } else {
        Alert.alert('Join Failed', res.error || 'Check the invite code and try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Join Group</Text>
        <Text style={styles.subtitle}>Enter the invite code shared by the group admin</Text>

        <Input
          label="Invite Code"
          placeholder="E.g. ABCXYZ"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
          maxLength={6}
        />

        <Button title="Join Group" onPress={handleJoin} loading={loading} style={styles.joinBtn} />
        <Button title="Cancel" onPress={() => router.back()} variant="link" style={styles.cancelBtn} />
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
    justifyContent: 'center',
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#013237',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  joinBtn: {
    marginTop: 24,
  },
  cancelBtn: {
    marginTop: 8,
    alignSelf: 'center',
  },
});
