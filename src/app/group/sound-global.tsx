/**
 * Global Sound Selection — used from Create Group screen.
 * Re-exports the same SoundSelection component as the alarm-scoped version.
 * This file exists at /group/sound-global so it's accessible without an alarm [id] param.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  StatusBar,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, Spacing } from '@/constants/theme';

const PRESETS = [
  {
    id: 'radar',
    name: 'Radar Sirens',
    emoji: '🚨',
    uri: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    desc: 'Urgent digital siren',
  },
  {
    id: 'gentle',
    name: 'Gentle Rise',
    emoji: '🌅',
    uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
    desc: 'Soft ascending tone',
  },
  {
    id: 'chimes',
    name: 'Retro Chimes',
    emoji: '🔔',
    uri: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg',
    desc: 'Classic bell chime',
  },
  {
    id: 'digital',
    name: 'Digital Beeps',
    emoji: '⌚',
    uri: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg',
    desc: 'Sharp electronic beeps',
  },
  {
    id: 'rooster',
    name: 'Morning Rooster',
    emoji: '🐓',
    uri: 'https://actions.google.com/sounds/v1/animals/chicken_clucking.ogg',
    desc: 'Natural wake-up sound',
  },
];

const STORAGE_KEY = '@selected_alarm_sound';
const STORAGE_KEY_META = '@selected_alarm_sound_meta';
const SUPABASE_BUCKET = 'audio-alarms';

type Tab = 'presets' | 'upload' | 'record';

function PresetRow({
  preset,
  isSelected,
  onSelect,
}: {
  preset: (typeof PRESETS)[0];
  isSelected: boolean;
  onSelect: (p: (typeof PRESETS)[0]) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const player = useAudioPlayer({ uri: preset.uri });

  const togglePreview = async () => {
    try {
      if (playing) {
        player.pause();
        player.seekTo(0);
        setPlaying(false);
      } else {
        player.seekTo(0);
        player.play();
        setPlaying(true);
        setTimeout(() => {
          try { player.pause(); player.seekTo(0); } catch {}
          setPlaying(false);
        }, 5000);
      }
    } catch {}
  };

  return (
    <Pressable
      style={[styles.presetRow, isSelected && styles.presetRowSelected]}
      onPress={() => onSelect(preset)}
      android_ripple={{ color: Colors.accent }}
    >
      <View style={[styles.presetEmojiBg, isSelected && styles.presetEmojiBgSelected]}>
        <Text style={styles.presetEmoji}>{preset.emoji}</Text>
      </View>
      <View style={styles.presetInfo}>
        <Text style={[styles.presetName, isSelected && styles.presetNameSelected]}>{preset.name}</Text>
        <Text style={styles.presetDesc}>{preset.desc}</Text>
      </View>
      <Pressable
        style={[styles.playBtn, playing && styles.playBtnActive]}
        onPress={togglePreview}
        hitSlop={8}
      >
        <Text style={[styles.playBtnText, playing && styles.playBtnTextActive]}>
          {playing ? '⏹' : '▶'}
        </Text>
      </Pressable>
      {isSelected && (
        <View style={styles.checkBadge}>
          <Text style={styles.checkBadgeText}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function SoundGlobal() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('presets');
  const [selectedPreset, setSelectedPreset] = useState<string>('radar');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadProgressAnim = useRef(new Animated.Value(0)).current;
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingUploading, setRecordingUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_META).then((v) => {
      if (v) {
        try {
          const meta = JSON.parse(v);
          if (meta.type === 'preset') setSelectedPreset(meta.id);
        } catch {}
      }
    });
    AudioModule.requestRecordingPermissionsAsync();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const saveSelection = async (soundValue: string, meta: Record<string, string>) => {
    await AsyncStorage.setItem(STORAGE_KEY, soundValue);
    await AsyncStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
  };

  const uploadFileToSupabase = async (localUri: string, fileName: string, mimeType: string): Promise<string | null> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const storagePath = `alarm_sounds/${Date.now()}_${fileName}`;
      const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(storagePath, bytes.buffer as ArrayBuffer, { contentType: mimeType, upsert: false });
      if (error) return null;
      const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
      return urlData?.publicUrl ?? null;
    } catch { return null; }
  };

  const handleSelectPreset = async (preset: (typeof PRESETS)[0]) => {
    setSelectedPreset(preset.id);
    await saveSelection(preset.uri, { type: 'preset', id: preset.id, name: preset.name });
    Alert.alert('✅ Sound Selected', `"${preset.name}" will be used as the default alarm sound.`, [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const { uri, name, mimeType, size } = result.assets[0];
      if (size && size > 10 * 1024 * 1024) { Alert.alert('File Too Large', 'Please choose a file under 10 MB.'); return; }
      setUploading(true);
      Animated.timing(uploadProgressAnim, { toValue: 1, duration: 2500, useNativeDriver: false }).start();
      const publicUrl = await uploadFileToSupabase(uri, name ?? `upload_${Date.now()}.mp3`, mimeType ?? 'audio/mpeg');
      setUploading(false);
      uploadProgressAnim.setValue(0);
      if (!publicUrl) { Alert.alert('Upload Failed', 'Could not upload file. Please try again.'); return; }
      const displayName = name ?? 'Custom Sound';
      setUploadedFileName(displayName);
      await saveSelection(publicUrl, { type: 'upload', name: displayName, url: publicUrl });
      Alert.alert('✅ Upload Successful', `"${displayName}" uploaded and selected.`, [{ text: 'Done', onPress: () => router.back() }]);
    } catch (err: any) { setUploading(false); Alert.alert('Error', err.message); }
  };

  const startRecording = async () => {
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (err: any) { Alert.alert('Recording Error', err.message); }
  };

  const stopRecording = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try {
      await audioRecorder.stop();
      if (audioRecorder.uri) setRecordingUri(audioRecorder.uri);
    } catch (err: any) { Alert.alert('Recording Error', err.message); }
  };

  const handleSaveRecording = async () => {
    if (!recordingUri) return;
    setRecordingUploading(true);
    const fileName = `voice_memo_${Date.now()}.m4a`;
    const publicUrl = await uploadFileToSupabase(recordingUri, fileName, 'audio/x-m4a');
    setRecordingUploading(false);
    if (!publicUrl) { Alert.alert('Upload Failed', 'Could not upload recording.'); return; }
    await saveSelection(publicUrl, { type: 'record', name: 'Voice Recording', url: publicUrl });
    Alert.alert('✅ Recording Saved', 'Your voice recording will be used as the alarm sound.', [{ text: 'Done', onPress: () => router.back() }]);
  };

  const formatSeconds = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const uploadProgressWidth = uploadProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Alarm Sound</Text>
        <View style={{ width: 60 }} />
      </View>
      <View style={styles.tabBar}>
        {(['presets', 'upload', 'record'] as Tab[]).map((tab) => (
          <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === 'presets' ? '🎵 Presets' : tab === 'upload' ? '📁 Upload' : '🎙 Record'}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {activeTab === 'presets' && (
          <View>
            <Text style={styles.sectionHint}>Tap ▶ to preview. Tap the row to select.</Text>
            {PRESETS.map((p) => <PresetRow key={p.id} preset={p} isSelected={selectedPreset === p.id} onSelect={handleSelectPreset} />)}
          </View>
        )}
        {activeTab === 'upload' && (
          <View style={styles.centeredSection}>
            <View style={styles.uploadIllustration}><Text style={styles.uploadIllustrationIcon}>📁</Text></View>
            <Text style={styles.uploadTitle}>Upload Audio File</Text>
            <Text style={styles.uploadSubtitle}>Choose an MP3, WAV, or M4A file.{'\n'}Maximum file size: 10 MB.</Text>
            {uploadedFileName && <View style={styles.uploadedBadge}><Text style={styles.uploadedBadgeText}>✓ {uploadedFileName}</Text></View>}
            {uploading ? (
              <View style={styles.progressContainer}>
                <Text style={styles.progressLabel}>Uploading…</Text>
                <View style={styles.progressTrack}><Animated.View style={[styles.progressBar, { width: uploadProgressWidth }]} /></View>
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />
              </View>
            ) : (
              <Pressable style={styles.uploadPickerBtn} onPress={handlePickFile}>
                <Text style={styles.uploadPickerBtnText}>Choose File</Text>
              </Pressable>
            )}
          </View>
        )}
        {activeTab === 'record' && (
          <View style={styles.centeredSection}>
            {!recordingUri ? (
              <>
                <View style={[styles.recordOrb, recorderState.isRecording && styles.recordOrbActive]}>
                  <Text style={styles.recordOrbIcon}>{recorderState.isRecording ? '🔴' : '🎙'}</Text>
                </View>
                <Text style={styles.recordTitle}>{recorderState.isRecording ? 'Recording…' : 'Record Wake-up Message'}</Text>
                <Text style={styles.recordSubtitle}>{recorderState.isRecording ? formatSeconds(recordingSeconds) : 'Record a custom voice message for your alarm.'}</Text>
                <Pressable style={[styles.recordBtn, recorderState.isRecording && styles.recordBtnStop]} onPress={recorderState.isRecording ? stopRecording : startRecording}>
                  <Text style={styles.recordBtnText}>{recorderState.isRecording ? '⏹ Stop' : '● Start Recording'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.recordSavedOrb}><Text style={styles.recordOrbIcon}>✅</Text></View>
                <Text style={styles.recordTitle}>Recording Complete</Text>
                <Text style={styles.recordSubtitle}>Duration: {formatSeconds(recordingSeconds)}</Text>
                <View style={styles.recordActions}>
                  <Pressable style={styles.discardBtn} onPress={() => { setRecordingUri(null); setRecordingSeconds(0); }}>
                    <Text style={styles.discardBtnText}>↩ Redo</Text>
                  </Pressable>
                  {recordingUploading ? (
                    <View style={styles.savingContainer}><ActivityIndicator size="small" color={Colors.primary} /><Text style={styles.savingText}>Uploading…</Text></View>
                  ) : (
                    <Pressable style={styles.saveRecordingBtn} onPress={handleSaveRecording}>
                      <Text style={styles.saveRecordingBtnText}>💾 Use This Sound</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
            <Text style={styles.recordHint}>Recordings are securely stored in the cloud.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: 48, paddingBottom: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  backBtn: { width: 60 },
  backBtnText: { fontFamily: Typography.fonts.medium, fontSize: Typography.sizes.body, color: Colors.primary },
  headerTitle: { fontFamily: Typography.fonts.bold, fontSize: Typography.sizes.h2, color: Colors.dark },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontFamily: Typography.fonts.semibold, fontSize: 13, color: Colors.textSecondary },
  tabLabelActive: { color: Colors.primary },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.md, paddingBottom: 48 },
  sectionHint: { fontFamily: Typography.fonts.regular, fontSize: Typography.sizes.caption, color: Colors.textSecondary, marginBottom: Spacing.md, textAlign: 'center' },
  presetRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1.5, borderColor: Colors.divider, gap: 12, elevation: 2 },
  presetRowSelected: { borderColor: Colors.primary, backgroundColor: '#F0FAF4' },
  presetEmojiBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  presetEmojiBgSelected: { backgroundColor: Colors.primary },
  presetEmoji: { fontSize: 22 },
  presetInfo: { flex: 1 },
  presetName: { fontFamily: Typography.fonts.semibold, fontSize: Typography.sizes.body, color: Colors.dark },
  presetNameSelected: { color: Colors.primary },
  presetDesc: { fontFamily: Typography.fonts.regular, fontSize: Typography.sizes.caption, color: Colors.textSecondary, marginTop: 2 },
  playBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.divider, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  playBtnActive: { backgroundColor: Colors.error, borderColor: Colors.error },
  playBtnText: { fontSize: 16, color: Colors.dark },
  playBtnTextActive: { color: Colors.surface },
  checkBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkBadgeText: { color: Colors.surface, fontSize: 13, fontWeight: '700' },
  centeredSection: { alignItems: 'center', paddingTop: Spacing.md },
  uploadIllustration: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  uploadIllustrationIcon: { fontSize: 44 },
  uploadTitle: { fontFamily: Typography.fonts.bold, fontSize: Typography.sizes.h2, color: Colors.dark, marginBottom: Spacing.sm },
  uploadSubtitle: { fontFamily: Typography.fonts.regular, fontSize: Typography.sizes.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg },
  uploadedBadge: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.md },
  uploadedBadgeText: { fontFamily: Typography.fonts.semibold, fontSize: Typography.sizes.body, color: '#166534' },
  progressContainer: { width: '100%', alignItems: 'center', marginBottom: Spacing.md },
  progressLabel: { fontFamily: Typography.fonts.regular, fontSize: Typography.sizes.caption, color: Colors.textSecondary, marginBottom: 8 },
  progressTrack: { width: '100%', height: 6, backgroundColor: Colors.divider, borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  uploadPickerBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center', elevation: 6 },
  uploadPickerBtnText: { fontFamily: Typography.fonts.bold, fontSize: Typography.sizes.button, color: Colors.surface },
  recordOrb: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, borderWidth: 3, borderColor: Colors.divider },
  recordOrbActive: { backgroundColor: '#FEE2E2', borderColor: Colors.error },
  recordSavedOrb: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, borderWidth: 3, borderColor: Colors.primary },
  recordOrbIcon: { fontSize: 52 },
  recordTitle: { fontFamily: Typography.fonts.bold, fontSize: Typography.sizes.h2, color: Colors.dark, marginBottom: Spacing.sm, textAlign: 'center' },
  recordSubtitle: { fontFamily: Typography.fonts.regular, fontSize: Typography.sizes.body, color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: 'center' },
  recordBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', elevation: 6, marginBottom: Spacing.md },
  recordBtnStop: { backgroundColor: Colors.error },
  recordBtnText: { fontFamily: Typography.fonts.bold, fontSize: Typography.sizes.button, color: Colors.surface },
  recordActions: { flexDirection: 'row', gap: 12, marginBottom: Spacing.md },
  discardBtn: { borderWidth: 1.5, borderColor: Colors.divider, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  discardBtnText: { fontFamily: Typography.fonts.semibold, fontSize: Typography.sizes.body, color: Colors.textSecondary },
  savingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 24 },
  savingText: { fontFamily: Typography.fonts.regular, fontSize: Typography.sizes.body, color: Colors.textSecondary },
  saveRecordingBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', elevation: 6 },
  saveRecordingBtnText: { fontFamily: Typography.fonts.bold, fontSize: Typography.sizes.body, color: Colors.surface },
  recordHint: { fontFamily: Typography.fonts.regular, fontSize: Typography.sizes.caption, color: Colors.textDisabled, textAlign: 'center', marginTop: Spacing.md },
});
