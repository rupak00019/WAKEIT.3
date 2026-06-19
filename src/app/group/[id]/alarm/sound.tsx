import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

const PRESETS = [
  { id: 'radar', name: '🚨 Radar Sirens', file: 'radar.mp3' },
  { id: 'chimes', name: '🔔 Retro Chimes', file: 'chimes.mp3' },
  { id: 'forest', name: '🌲 Peaceful Forest', file: 'forest.mp3' },
  { id: 'digital', name: '⌚ Digital Beeps', file: 'digital.mp3' },
  { id: 'rooster', name: '🐓 Morning Rooster', file: 'rooster.mp3' },
];

export default function SoundSelection() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'record'>('presets');
  const [selectedSound, setSelectedSound] = useState<string>('radar.mp3');
  
  // Record states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedFile, setRecordedFile] = useState<string | null>(null);

  // Upload states
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const handleSelectPreset = async (fileName: string) => {
    setSelectedSound(fileName);
    await AsyncStorage.setItem('@selected_alarm_sound', fileName);
    Alert.alert('Sound Selected', `Selected preset: ${fileName}`, [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const handleMockUpload = async () => {
    const mockFileName = 'custom_uploaded_sound_' + Math.floor(Math.random() * 1000) + '.wav';
    setUploadedFile(mockFileName);
    await AsyncStorage.setItem('@selected_alarm_sound', mockFileName);
    Alert.alert('Upload Successful', `Uploaded sound file: ${mockFileName}`, [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      setIsRecording(true);
      // Mock start recording
    } else {
      setIsRecording(false);
      const mockRecName = 'voice_memo_' + Date.now() + '.m4a';
      setRecordedFile(mockRecName);
      await AsyncStorage.setItem('@selected_alarm_sound', mockRecName);
      Alert.alert('Recording Saved', `Voice recorded sound: ${mockRecName}`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Alarm Sound Selection</Text>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['presets', 'upload', 'record'] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content based on Active Tab */}
      {activeTab === 'presets' && (
        <View style={styles.tabContent}>
          <Text style={styles.label}>Choose a Preset Sound</Text>
          {PRESETS.map((preset) => (
            <Card key={preset.id} style={styles.soundCard}>
              <View style={styles.soundRow}>
                <Text style={styles.soundName}>{preset.name}</Text>
                <Button
                  title={selectedSound === preset.file ? 'Selected' : 'Select'}
                  onPress={() => handleSelectPreset(preset.file)}
                  variant={selectedSound === preset.file ? 'primary' : 'secondary'}
                  style={styles.selectBtn}
                />
              </View>
            </Card>
          ))}
        </View>
      )}

      {activeTab === 'upload' && (
        <View style={styles.tabContent}>
          <Text style={styles.label}>Upload Audio File</Text>
          <Card style={styles.uploadCard}>
            <Text style={styles.infoText}>Upload MP3, WAV or M4A audio files. Max 5MB size limit.</Text>
            {uploadedFile && (
              <Text style={styles.fileStatus}>Selected File: {uploadedFile}</Text>
            )}
            <Button title="Choose File (Mock)" onPress={handleMockUpload} />
          </Card>
        </View>
      )}

      {activeTab === 'record' && (
        <View style={styles.tabContent}>
          <Text style={styles.label}>Record Custom Wake-up Message</Text>
          <Card style={styles.recordCard}>
            <Text style={styles.infoText}>Record a voice message to play when the alarm triggers.</Text>
            <Text style={styles.recordStatus}>
              {isRecording ? '🔴 Recording...' : recordedFile ? `✓ Saved: ${recordedFile}` : 'Ready to record'}
            </Text>
            <Button
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
              onPress={toggleRecording}
              variant={isRecording ? 'danger' : 'primary'}
            />
          </Card>
        </View>
      )}

      <Button title="Back" onPress={() => router.back()} variant="link" style={styles.backBtn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FBF7',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#013237',
    textAlign: 'center',
    marginVertical: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabBtnActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#4CA771',
  },
  tabText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#4CA771',
  },
  tabContent: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#013237',
    marginBottom: 12,
  },
  soundCard: {
    marginVertical: 6,
    padding: 12,
  },
  soundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soundName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#013237',
  },
  selectBtn: {
    height: 38,
    width: 100,
    marginVertical: 0,
  },
  uploadCard: {
    alignItems: 'center',
    padding: 24,
  },
  infoText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  fileStatus: {
    fontSize: 14,
    color: '#4CA771',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  recordCard: {
    alignItems: 'center',
    padding: 24,
  },
  recordStatus: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#013237',
    marginVertical: 16,
  },
  backBtn: {
    marginVertical: 24,
    alignSelf: 'center',
  },
});
