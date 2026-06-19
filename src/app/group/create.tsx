import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useGroupStore } from '@/store/groupStore';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function CreateGroup() {
  const router = useRouter();
  const { createGroup } = useGroupStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [soundUrl, setSoundUrl] = useState('default_sound.mp3');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name) {
      Alert.alert('Validation Error', 'Group name is required.');
      return;
    }
    setLoading(true);
    try {
      const res = await createGroup(name, description, soundUrl);
      if (res.success && res.group_id) {
        Alert.alert(
          'Group Created!',
          `Invite Code: ${res.invite_code}\nShare this code with your members!`,
          [
            {
              text: 'Go to Dashboard',
              onPress: () => router.replace(`/group/${res.group_id}`),
            },
          ]
        );
      } else {
        Alert.alert('Creation Failed', res.error || 'Unknown error');
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
        <Text style={styles.title}>Create Group</Text>
        <Text style={styles.subtitle}>Set up a new accountability circle</Text>

        <Input
          label="Group Name"
          placeholder="E.g. Morning Hustlers"
          value={name}
          onChangeText={setName}
        />

        <Input
          label="Description"
          placeholder="E.g. Waking up at 6 AM daily for study session"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={styles.textArea}
        />

        <Input
          label="Default Alarm Sound (Url or Name)"
          placeholder="default_sound.mp3"
          value={soundUrl}
          onChangeText={setSoundUrl}
        />

        <Button title="Create Group" onPress={handleCreate} loading={loading} style={styles.createBtn} />
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  createBtn: {
    marginTop: 24,
  },
  cancelBtn: {
    marginTop: 8,
    alignSelf: 'center',
  },
});
