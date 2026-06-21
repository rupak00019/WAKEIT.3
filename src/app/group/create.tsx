import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGroupStore } from '@/store/groupStore';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function CreateGroup() {
  const router = useRouter();
  const { createGroup } = useGroupStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [soundUrl, setSoundUrl] = useState('radar');
  const [soundLabel, setSoundLabel] = useState('Radar Sirens');
  const [loading, setLoading] = useState(false);

  // Load sound selection made on the sound screen
  useFocusEffect(
    React.useCallback(() => {
      const loadSound = async () => {
        const stored = await AsyncStorage.getItem('@selected_alarm_sound');
        const storedMeta = await AsyncStorage.getItem('@selected_alarm_sound_meta');
        if (stored) setSoundUrl(stored);
        if (storedMeta) {
          try {
            const meta = JSON.parse(storedMeta);
            setSoundLabel(meta.name || stored || 'Radar Sirens');
          } catch {}
        }
      };
      loadSound();
    }, [])
  );

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

        {/* Sound picker row — navigates to the same sound selection screen */}
        <View style={styles.soundRow}>
          <View style={styles.soundIconBg}>
            <Text style={styles.soundIcon}>🎵</Text>
          </View>
          <View style={styles.soundInfo}>
            <Text style={styles.soundLabel}>Default Alarm Sound</Text>
            <Text style={styles.soundName} numberOfLines={1}>{soundLabel}</Text>
          </View>
          <Pressable
            style={styles.soundChangeBtn}
            onPress={() => router.push('/group/sound-global')}
          >
            <Text style={styles.soundChangeBtnText}>Change</Text>
          </Pressable>
        </View>

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
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  soundIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#C0E6BA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundIcon: {
    fontSize: 20,
  },
  soundInfo: {
    flex: 1,
  },
  soundLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  soundName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#013237',
    marginTop: 1,
  },
  soundChangeBtn: {
    backgroundColor: '#4CA771',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  soundChangeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  createBtn: {
    marginTop: 24,
  },
  cancelBtn: {
    marginTop: 8,
    alignSelf: 'center',
  },
});
