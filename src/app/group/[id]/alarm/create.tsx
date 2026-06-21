import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Switch,
  Pressable,
  StatusBar,
  Modal,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlarmStore } from '@/store/alarmStore';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Colors, Typography, Spacing } from '@/constants/theme';

const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', emoji: '🟢', description: 'Simple addition' },
  { key: 'medium', label: 'Medium', emoji: '🟡', description: 'Multiplication' },
  { key: 'hard', label: 'Hard', emoji: '🔴', description: 'Multi-step' },
] as const;

function formatTimeDisplay(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function getFirstOccurrenceFromDate(alarmDate: Date, recurrenceDays: number[]): Date {
  const hours = alarmDate.getHours();
  const minutes = alarmDate.getMinutes();
  const now = new Date();

  for (let i = 0; i <= 7; i++) {
    const candidate = new Date();
    candidate.setDate(now.getDate() + i);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate > now && recurrenceDays.includes(candidate.getDay())) {
      return candidate;
    }
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

// Returns a Date set to tomorrow at the given time
function getDefaultAlarmDate(): Date {
  const d = new Date();
  d.setHours(7, 0, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d;
}

function getDefaultEndDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 59, 0);
  return d;
}

export default function CreateAlarm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { createAlarm } = useAlarmStore();

  const [title, setTitle] = useState('');
  const [alarmDate, setAlarmDate] = useState<Date>(getDefaultAlarmDate());
  const [endDate, setEndDate] = useState<Date>(getDefaultEndDate());
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [soundUrl, setSoundUrl] = useState('radar.mp3');
  const [soundLabel, setSoundLabel] = useState('Radar Sirens');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // Picker visibility
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Load sound if changed on the sound screen
  useFocusEffect(
    React.useCallback(() => {
      const loadSound = async () => {
        const storedSound = await AsyncStorage.getItem('@selected_alarm_sound');
        const storedMeta = await AsyncStorage.getItem('@selected_alarm_sound_meta');
        if (storedSound) setSoundUrl(storedSound);
        if (storedMeta) {
          try {
            const meta = JSON.parse(storedMeta);
            setSoundLabel(meta.name || storedSound || 'Radar Sirens');
          } catch {}
        }
      };
      loadSound();
    }, [])
  );

  const toggleDay = (dayValue: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(dayValue) ? prev.filter((d) => d !== dayValue) : [...prev, dayValue]
    );
  };

  // ---- Picker handlers ----
  const onTimeChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selected) {
      setAlarmDate((prev) => {
        const updated = new Date(prev);
        updated.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        return updated;
      });
    }
  };

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) {
      setAlarmDate((prev) => {
        const updated = new Date(prev);
        updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
        return updated;
      });
    }
  };

  const onEndDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowEndDatePicker(false);
    if (selected) setEndDate(selected);
  };

  // ---- Save ----
  const handleSave = async () => {
    if (!id) return;
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter an alarm title.');
      return;
    }
    if (title.length > 50) {
      Alert.alert('Title Too Long', 'Alarm title must be 50 characters or less.');
      return;
    }

    const now = new Date();
    const minFuture = new Date(now.getTime() + 2 * 60 * 1000);

    let finalAlarmTimeUtc = '';

    if (isRecurring) {
      if (recurrenceDays.length === 0) {
        Alert.alert('Selection Error', 'Please select at least one repeat day.');
        return;
      }
      const maxEndDate = new Date();
      maxEndDate.setDate(maxEndDate.getDate() + 30);
      if (endDate < now) {
        Alert.alert('Invalid End Date', 'Recurrence end date must be in the future.');
        return;
      }
      if (endDate > maxEndDate) {
        Alert.alert('Limit Exceeded', 'Recurrence end date cannot be more than 30 days away.');
        return;
      }
      const firstOccur = getFirstOccurrenceFromDate(alarmDate, recurrenceDays);
      finalAlarmTimeUtc = firstOccur.toISOString();
    } else {
      if (alarmDate < minFuture) {
        Alert.alert('Invalid Time', 'Alarm must be at least 2 minutes in the future.');
        return;
      }
      finalAlarmTimeUtc = alarmDate.toISOString();
    }

    setSaving(true);
    try {
      const res = await createAlarm({
        group_id: id,
        title: title.trim(),
        alarm_time: finalAlarmTimeUtc,
        difficulty,
        sound_url: soundUrl,
        is_recurring: isRecurring,
        recurrence_days: isRecurring ? recurrenceDays : undefined,
        recurrence_end_date: isRecurring
          ? `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
          : undefined,
      });

      if (res.success) {
        Alert.alert('✅ Alarm Scheduled', 'The group alarm has been set successfully!', [
          { text: 'Done', onPress: () => router.replace(`/group/${id}`) },
        ]);
      } else {
        Alert.alert('Failed', res.error || 'Failed to create alarm.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  // ---- iOS picker wrapper (shown in a modal) ----
  const IOSPickerModal = ({
    visible,
    mode,
    value,
    minimumDate,
    maximumDate,
    onChange,
    onDone,
  }: {
    visible: boolean;
    mode: 'date' | 'time';
    value: Date;
    minimumDate?: Date;
    maximumDate?: Date;
    onChange: (e: DateTimePickerEvent, d?: Date) => void;
    onDone: () => void;
  }) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onDone}>
              <Text style={styles.modalDoneBtn}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={value}
            mode={mode}
            display="spinner"
            onChange={onChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            style={styles.iosPicker}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Android pickers — render inline when visible */}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={alarmDate}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={onTimeChange}
        />
      )}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={alarmDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={onDateChange}
        />
      )}
      {Platform.OS === 'android' && showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
          maximumDate={(() => { const m = new Date(); m.setDate(m.getDate() + 30); return m; })()}
          onChange={onEndDateChange}
        />
      )}

      {/* iOS pickers — modal sheet */}
      {Platform.OS === 'ios' && (
        <>
          <IOSPickerModal
            visible={showTimePicker}
            mode="time"
            value={alarmDate}
            onChange={onTimeChange}
            onDone={() => setShowTimePicker(false)}
          />
          <IOSPickerModal
            visible={showDatePicker}
            mode="date"
            value={alarmDate}
            minimumDate={new Date()}
            onChange={onDateChange}
            onDone={() => setShowDatePicker(false)}
          />
          <IOSPickerModal
            visible={showEndDatePicker}
            mode="date"
            value={endDate}
            minimumDate={new Date()}
            maximumDate={(() => { const m = new Date(); m.setDate(m.getDate() + 30); return m; })()}
            onChange={onEndDateChange}
            onDone={() => setShowEndDatePicker(false)}
          />
        </>
      )}

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Schedule Alarm</Text>
          <Text style={styles.subtitle}>Set a wake-up challenge for your entire group</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Input
            label="Alarm Title"
            placeholder="e.g. Morning Standup"
            value={title}
            onChangeText={setTitle}
          />

          {/* Time picker row */}
          <View style={styles.pickerFieldGroup}>
            <Text style={styles.pickerFieldLabel}>Alarm Time</Text>
            <Pressable
              style={styles.pickerRow}
              onPress={() => setShowTimePicker(true)}
              android_ripple={{ color: Colors.accent }}
            >
              <Text style={styles.pickerIcon}>🕐</Text>
              <Text style={styles.pickerValue}>{formatTimeDisplay(alarmDate)}</Text>
              <Text style={styles.pickerChevron}>›</Text>
            </Pressable>
          </View>

          {/* Date picker row — only for one-time alarms */}
          {!isRecurring && (
            <View style={styles.pickerFieldGroup}>
              <Text style={styles.pickerFieldLabel}>Date</Text>
              <Pressable
                style={styles.pickerRow}
                onPress={() => setShowDatePicker(true)}
                android_ripple={{ color: Colors.accent }}
              >
                <Text style={styles.pickerIcon}>📅</Text>
                <Text style={styles.pickerValue}>{formatDateDisplay(alarmDate)}</Text>
                <Text style={styles.pickerChevron}>›</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Difficulty selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Challenge Difficulty</Text>
          <View style={styles.diffRow}>
            {DIFFICULTIES.map((diff) => {
              const selected = difficulty === diff.key;
              return (
                <Pressable
                  key={diff.key}
                  style={[styles.diffCard, selected && styles.diffCardSelected]}
                  onPress={() => setDifficulty(diff.key)}
                >
                  <Text style={styles.diffEmoji}>{diff.emoji}</Text>
                  <Text style={[styles.diffLabel, selected && styles.diffLabelSelected]}>
                    {diff.label}
                  </Text>
                  <Text style={[styles.diffDesc, selected && styles.diffDescSelected]}>
                    {diff.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sound section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alarm Sound</Text>
          <View style={styles.soundRow}>
            <View style={styles.soundIconBox}>
              <Text style={styles.soundIcon}>🎵</Text>
            </View>
            <View style={styles.soundInfo}>
              <Text style={styles.soundName} numberOfLines={1}>{soundLabel}</Text>
              <Text style={styles.soundDesc}>Tap to change</Text>
            </View>
            <Button
              title="Change"
              onPress={() => router.push(`/group/${id}/alarm/sound`)}
              variant="secondary"
              style={styles.soundBtn}
            />
          </View>
        </View>

        {/* Recurrence */}
        <View style={styles.section}>
          <View style={styles.recurrenceHeader}>
            <View>
              <Text style={styles.sectionTitle}>Recurring Alarm</Text>
              <Text style={styles.recurrenceDesc}>Repeat on selected days of the week</Text>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: Colors.divider, true: Colors.primary }}
              thumbColor={isRecurring ? Colors.surface : '#f4f3f4'}
            />
          </View>

          {isRecurring && (
            <View style={styles.recurrenceDetails}>
              <Text style={styles.fieldLabel}>Repeat Days</Text>
              <View style={styles.daysRow}>
                {DAYS_OF_WEEK.map((day) => {
                  const selected = recurrenceDays.includes(day.value);
                  return (
                    <Pressable
                      key={day.value}
                      style={[styles.dayBtn, selected && styles.dayBtnSelected]}
                      onPress={() => toggleDay(day.value)}
                    >
                      <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                        {day.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* End date picker row */}
              <Text style={styles.fieldLabel}>End Date (max 30 days)</Text>
              <Pressable
                style={styles.pickerRow}
                onPress={() => setShowEndDatePicker(true)}
                android_ripple={{ color: Colors.accent }}
              >
                <Text style={styles.pickerIcon}>📅</Text>
                <Text style={styles.pickerValue}>{formatDateDisplay(endDate)}</Text>
                <Text style={styles.pickerChevron}>›</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Actions */}
        <Button title="Schedule Alarm" onPress={handleSave} loading={saving} style={styles.saveBtn} />
        <Button title="Cancel" onPress={() => router.back()} variant="link" style={styles.cancelBtn} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  // Picker field
  pickerFieldGroup: {
    marginTop: Spacing.sm,
  },
  pickerFieldLabel: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 10,
  },
  pickerIcon: {
    fontSize: 20,
  },
  pickerValue: {
    flex: 1,
    fontFamily: Typography.fonts.semibold,
    fontSize: Typography.sizes.bodyLarge,
    color: Colors.dark,
  },
  pickerChevron: {
    fontSize: 22,
    color: Colors.textSecondary,
  },
  // iOS modal picker
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalDoneBtn: {
    fontFamily: Typography.fonts.bold,
    fontSize: Typography.sizes.body,
    color: Colors.primary,
  },
  iosPicker: {
    backgroundColor: Colors.surface,
  },
  // Section
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  sectionTitle: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    fontWeight: '700',
    color: Colors.dark,
    marginBottom: 4,
  },
  // Difficulty
  diffRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.sm,
  },
  diffCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    backgroundColor: Colors.background,
  },
  diffCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.accent,
  },
  diffEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  diffLabel: {
    fontFamily: Typography.fonts.regular,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  diffLabelSelected: { color: Colors.dark },
  diffDesc: {
    fontFamily: Typography.fonts.regular,
    fontSize: 10,
    color: Colors.textDisabled,
    marginTop: 2,
    textAlign: 'center',
  },
  diffDescSelected: { color: Colors.textSecondary },
  // Sound
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 12,
  },
  soundIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundIcon: { fontSize: 22 },
  soundInfo: { flex: 1 },
  soundName: {
    fontFamily: Typography.fonts.regular,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark,
  },
  soundDesc: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  soundBtn: {
    width: 80,
    height: 36,
    marginVertical: 0,
  },
  // Recurrence
  recurrenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recurrenceDesc: {
    fontFamily: Typography.fonts.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  recurrenceDetails: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  fieldLabel: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  dayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  dayBtnSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  dayText: {
    fontFamily: Typography.fonts.regular,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  dayTextSelected: { color: Colors.surface },
  saveBtn: { marginTop: Spacing.md },
  cancelBtn: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
});
