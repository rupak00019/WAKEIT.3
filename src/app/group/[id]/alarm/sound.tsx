/**
 * Sound Selection Screen
 * PRD §5.5 — Three tabs:
 *  1. Presets: tappable list of 5 bundled sounds with live playback preview
 *  2. Upload:  real file picker (expo-document-picker) → upload to Supabase Storage 'audio' bucket
 *  3. Record:  real microphone recording (expo-audio recorder) → upload to Supabase Storage
 *
 * On selection/upload/record-save, stores the public URL (or preset file key)
 * in AsyncStorage '@selected_alarm_sound' and navigates back.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Preset Row component (own player instance per row to avoid conflicts)
// ---------------------------------------------------------------------------

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
        // Auto-stop after 5 seconds
        setTimeout(() => {
          try {
            player.pause();
            player.seekTo(0);
          } catch {}
          setPlaying(false);
        }, 5000);
      }
    } catch (err) {
      console.warn('[SoundSelection] preview error:', err);
    }
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
        <Text style={[styles.presetName, isSelected && styles.presetNameSelected]}>
          {preset.name}
        </Text>
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

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function SoundSelection() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('presets');
  const [selectedPreset, setSelectedPreset] = useState<string>('radar');

  // Upload state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadProgressAnim = useRef(new Animated.Value(0)).current;

  // Record state
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingUploading, setRecordingUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // expo-audio recorder
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Load currently saved sound on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_META).then((v) => {
      if (v) {
        try {
          const meta = JSON.parse(v);
          if (meta.type === 'preset') setSelectedPreset(meta.id);
        } catch {}
      }
    });
  }, []);

  // Request microphone permission on mount
  useEffect(() => {
    AudioModule.requestRecordingPermissionsAsync().then((status) => {
      if (!status.granted) {
        console.warn('[SoundSelection] Microphone permission not granted');
      }
    });
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const saveSelection = async (soundValue: string, meta: Record<string, string>) => {
    await AsyncStorage.setItem(STORAGE_KEY, soundValue);
    await AsyncStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
  };

  const uploadFileToSupabase = async (
    localUri: string,
    fileName: string,
    mimeType: string
  ): Promise<string | null> => {
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to ArrayBuffer
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const storagePath = `alarm_sounds/${Date.now()}_${fileName}`;

      const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(storagePath, bytes.buffer as ArrayBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (error) {
        console.error('[SoundSelection] upload error:', error.message);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(storagePath);

      return urlData?.publicUrl ?? null;
    } catch (err: any) {
      console.error('[SoundSelection] upload exception:', err.message);
      return null;
    }
  };

  // -----------------------------------------------------------------------
  // Preset handlers
  // -----------------------------------------------------------------------

  const handleSelectPreset = async (preset: (typeof PRESETS)[0]) => {
    setSelectedPreset(preset.id);
    await saveSelection(preset.uri, { type: 'preset', id: preset.id, name: preset.name });
    Alert.alert('✅ Sound Selected', `"${preset.name}" will play when your alarm rings.`, [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  // -----------------------------------------------------------------------
  // Upload handlers
  // -----------------------------------------------------------------------

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const { uri, name, mimeType, size } = asset;

      // Validate size (max 10 MB)
      if (size && size > 10 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Please choose an audio file under 10 MB.');
        return;
      }

      setUploading(true);
      Animated.timing(uploadProgressAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: false,
      }).start();

      const publicUrl = await uploadFileToSupabase(
        uri,
        name ?? `upload_${Date.now()}.mp3`,
        mimeType ?? 'audio/mpeg'
      );

      setUploading(false);
      uploadProgressAnim.setValue(0);

      if (!publicUrl) {
        Alert.alert('Upload Failed', 'Could not upload file to storage. Please try again.');
        return;
      }

      const displayName = name ?? 'Custom Sound';
      setUploadedFileName(displayName);
      await saveSelection(publicUrl, { type: 'upload', name: displayName, url: publicUrl });

      Alert.alert('✅ Upload Successful', `"${displayName}" has been uploaded and selected.`, [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setUploading(false);
      Alert.alert('Error', err.message || 'Failed to pick file.');
    }
  };

  // -----------------------------------------------------------------------
  // Recording handlers
  // -----------------------------------------------------------------------

  const startRecording = async () => {
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      Alert.alert('Recording Error', err.message || 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri) {
        setRecordingUri(uri);
      }
    } catch (err: any) {
      Alert.alert('Recording Error', err.message || 'Could not stop recording.');
    }
  };

  const handleSaveRecording = async () => {
    if (!recordingUri) return;

    setRecordingUploading(true);
    const fileName = `voice_memo_${Date.now()}.m4a`;
    const publicUrl = await uploadFileToSupabase(recordingUri, fileName, 'audio/x-m4a');
    setRecordingUploading(false);

    if (!publicUrl) {
      Alert.alert('Upload Failed', 'Could not upload your recording. Please try again.');
      return;
    }

    await saveSelection(publicUrl, { type: 'record', name: 'Voice Recording', url: publicUrl });
    Alert.alert('✅ Recording Saved', 'Your voice recording will play when the alarm rings.', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  const discardRecording = () => {
    setRecordingUri(null);
    setRecordingSeconds(0);
  };

  const formatSeconds = (s: number) => {
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const uploadProgressWidth = uploadProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Alarm Sound</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['presets', 'upload', 'record'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === 'presets' ? '🎵 Presets' : tab === 'upload' ? '📁 Upload' : '🎙 Record'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------------------------------------------------- */}
        {/* PRESETS TAB                                                       */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'presets' && (
          <View>
            <Text style={styles.sectionHint}>
              Tap ▶ to preview a sound. Tap the row to select it.
            </Text>
            {PRESETS.map((preset) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                isSelected={selectedPreset === preset.id}
                onSelect={handleSelectPreset}
              />
            ))}
          </View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* UPLOAD TAB                                                        */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'upload' && (
          <View style={styles.centeredSection}>
            <View style={styles.uploadIllustration}>
              <Text style={styles.uploadIllustrationIcon}>📁</Text>
            </View>
            <Text style={styles.uploadTitle}>Upload Audio File</Text>
            <Text style={styles.uploadSubtitle}>
              Choose an MP3, WAV, or M4A file from your device.{'\n'}Maximum file size: 10 MB.
            </Text>

            {uploadedFileName && (
              <View style={styles.uploadedBadge}>
                <Text style={styles.uploadedBadgeText}>✓ {uploadedFileName}</Text>
              </View>
            )}

            {uploading ? (
              <View style={styles.progressContainer}>
                <Text style={styles.progressLabel}>Uploading…</Text>
                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressBar, { width: uploadProgressWidth }]} />
                </View>
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />
              </View>
            ) : (
              <Pressable style={styles.uploadPickerBtn} onPress={handlePickFile}>
                <Text style={styles.uploadPickerBtnText}>Choose File</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* RECORD TAB                                                        */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === 'record' && (
          <View style={styles.centeredSection}>
            {/* Idle / Recording state */}
            {!recordingUri && (
              <>
                <View
                  style={[
                    styles.recordOrb,
                    recorderState.isRecording && styles.recordOrbActive,
                  ]}
                >
                  <Text style={styles.recordOrbIcon}>
                    {recorderState.isRecording ? '🔴' : '🎙'}
                  </Text>
                </View>

                <Text style={styles.recordTitle}>
                  {recorderState.isRecording ? 'Recording…' : 'Record Wake-up Message'}
                </Text>
                <Text style={styles.recordSubtitle}>
                  {recorderState.isRecording
                    ? formatSeconds(recordingSeconds)
                    : 'Record a custom voice message to play when your alarm rings.'}
                </Text>

                <Pressable
                  style={[
                    styles.recordBtn,
                    recorderState.isRecording && styles.recordBtnStop,
                  ]}
                  onPress={recorderState.isRecording ? stopRecording : startRecording}
                >
                  <Text style={styles.recordBtnText}>
                    {recorderState.isRecording ? '⏹ Stop Recording' : '● Start Recording'}
                  </Text>
                </Pressable>
              </>
            )}

            {/* Preview + save state */}
            {recordingUri && !recorderState.isRecording && (
              <>
                <View style={styles.recordSavedOrb}>
                  <Text style={styles.recordOrbIcon}>✅</Text>
                </View>
                <Text style={styles.recordTitle}>Recording Complete</Text>
                <Text style={styles.recordSubtitle}>
                  Duration: {formatSeconds(recordingSeconds)}
                </Text>

                <View style={styles.recordActions}>
                  <Pressable style={styles.discardBtn} onPress={discardRecording}>
                    <Text style={styles.discardBtnText}>↩ Redo</Text>
                  </Pressable>

                  {recordingUploading ? (
                    <View style={styles.savingContainer}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.savingText}>Uploading…</Text>
                    </View>
                  ) : (
                    <Pressable style={styles.saveRecordingBtn} onPress={handleSaveRecording}>
                      <Text style={styles.saveRecordingBtnText}>💾 Use This Sound</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            <Text style={styles.recordHint}>
              Recordings are uploaded to secure cloud storage.{'\n'}Only you and your group can
              hear them.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 48,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  backBtn: {
    width: 60,
  },
  backBtnText: {
    fontFamily: Typography.fonts.medium,
    fontSize: Typography.sizes.body,
    color: Colors.primary,
  },
  headerTitle: {
    fontFamily: Typography.fonts.bold,
    fontSize: Typography.sizes.h2,
    color: Colors.dark,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabLabel: {
    fontFamily: Typography.fonts.semibold,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.primary,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 48,
  },

  // Presets
  sectionHint: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  presetRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F0FAF4',
  },
  presetEmojiBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetEmojiBgSelected: {
    backgroundColor: Colors.primary,
  },
  presetEmoji: {
    fontSize: 22,
  },
  presetInfo: {
    flex: 1,
  },
  presetName: {
    fontFamily: Typography.fonts.semibold,
    fontSize: Typography.sizes.body,
    color: Colors.dark,
  },
  presetNameSelected: {
    color: Colors.primary,
  },
  presetDesc: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  playBtnActive: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  playBtnText: {
    fontSize: 16,
    color: Colors.dark,
  },
  playBtnTextActive: {
    color: Colors.surface,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  checkBadgeText: {
    color: Colors.surface,
    fontSize: 13,
    fontWeight: '700',
  },

  // Upload
  centeredSection: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  uploadIllustration: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  uploadIllustrationIcon: {
    fontSize: 44,
  },
  uploadTitle: {
    fontFamily: Typography.fonts.bold,
    fontSize: Typography.sizes.h2,
    color: Colors.dark,
    marginBottom: Spacing.sm,
  },
  uploadSubtitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  uploadedBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  uploadedBadgeText: {
    fontFamily: Typography.fonts.semibold,
    fontSize: Typography.sizes.body,
    color: '#166534',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressLabel: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.divider,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  uploadPickerBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  uploadPickerBtnText: {
    fontFamily: Typography.fonts.bold,
    fontSize: Typography.sizes.button,
    color: Colors.surface,
  },

  // Record
  recordOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 3,
    borderColor: Colors.divider,
  },
  recordOrbActive: {
    backgroundColor: '#FEE2E2',
    borderColor: Colors.error,
  },
  recordSavedOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  recordOrbIcon: {
    fontSize: 52,
  },
  recordTitle: {
    fontFamily: Typography.fonts.bold,
    fontSize: Typography.sizes.h2,
    color: Colors.dark,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  recordSubtitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    lineHeight: 22,
  },
  recordBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: Spacing.md,
  },
  recordBtnStop: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  recordBtnText: {
    fontFamily: Typography.fonts.bold,
    fontSize: Typography.sizes.button,
    color: Colors.surface,
  },
  recordActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.md,
  },
  discardBtn: {
    borderWidth: 1.5,
    borderColor: Colors.divider,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  discardBtnText: {
    fontFamily: Typography.fonts.semibold,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  savingText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
  },
  saveRecordingBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveRecordingBtnText: {
    fontFamily: Typography.fonts.bold,
    fontSize: Typography.sizes.body,
    color: Colors.surface,
  },
  recordHint: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    color: Colors.textDisabled,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.md,
  },
});
