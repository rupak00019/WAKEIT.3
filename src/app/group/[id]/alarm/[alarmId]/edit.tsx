import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlarmStore } from '@/store/alarmStore';
import { supabase } from '@/lib/supabase';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
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

function getLocalDateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function getFirstOccurrence(timeStr: string, recurrenceDays: number[]): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  
  // Try today and the next 7 days
  for (let i = 0; i <= 7; i++) {
    const candidate = new Date();
    candidate.setDate(now.getDate() + i);
    candidate.setHours(hours, minutes, 0, 0);
    
    if (candidate > now && recurrenceDays.includes(candidate.getDay())) {
      return candidate;
    }
  }
  
  // Fallback
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

export default function EditAlarm() {
  const { id: groupId, alarmId } = useLocalSearchParams<{ id: string; alarmId: string }>();
  const router = useRouter();
  const { updateAlarm } = useAlarmStore();

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('07:00');
  const [dateStr, setDateStr] = useState(getLocalDateString(new Date()));
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [soundUrl, setSoundUrl] = useState('radar.mp3');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAlarmDetails = async () => {
      if (!alarmId) return;
      try {
        const { data, error } = await supabase
          .from('alarms')
          .select('*')
          .eq('id', alarmId)
          .single();

        if (error) throw error;
        if (data) {
          // Verify if alarm is within 1 minute of triggering
          const alarmTime = new Date(data.alarm_time);
          if (alarmTime.getTime() - Date.now() < 60000) {
            Alert.alert(
              'Cannot Edit',
              'This alarm rings soon and cannot be edited.',
              [{ text: 'OK', onPress: () => router.back() }]
            );
            return;
          }

          setTitle(data.title);
          setDifficulty(data.difficulty);
          setSoundUrl(data.sound_url || 'radar.mp3');
          setIsRecurring(data.is_recurring);
          setRecurrenceDays(data.recurrence_days || []);
          setEndDate(data.recurrence_end_date || '');

          // Convert alarm_time ISO UTC string to local HH:MM and YYYY-MM-DD
          const localDateObj = new Date(data.alarm_time);
          const hours = String(localDateObj.getHours()).padStart(2, '0');
          const minutes = String(localDateObj.getMinutes()).padStart(2, '0');
          setTime(`${hours}:${minutes}`);

          setDateStr(getLocalDateString(localDateObj));
        }
      } catch (err: any) {
        Alert.alert('Error', 'Failed to retrieve alarm settings: ' + err.message);
        router.back();
      } finally {
        setLoading(false);
      }
    };
    fetchAlarmDetails();
  }, [alarmId]);

  // Load sound if changed on the sound screen
  useFocusEffect(
    React.useCallback(() => {
      const loadSound = async () => {
        const storedSound = await AsyncStorage.getItem('@selected_alarm_sound');
        if (storedSound) {
          setSoundUrl(storedSound);
        }
      };
      loadSound();
    }, [])
  );

  const toggleDay = (dayValue: number) => {
    if (recurrenceDays.includes(dayValue)) {
      setRecurrenceDays(recurrenceDays.filter((d) => d !== dayValue));
    } else {
      setRecurrenceDays([...recurrenceDays, dayValue]);
    }
  };

  const handleSave = async () => {
    if (!alarmId || !groupId) return;
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Alarm title is required.');
      return;
    }
    if (title.length > 50) {
      Alert.alert('Validation Error', 'Alarm title must be 50 characters or less.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      Alert.alert('Validation Error', 'Time must be in HH:MM 24-hour format (e.g. 07:30).');
      return;
    }

    let finalAlarmTimeUtc = '';

    if (isRecurring) {
      if (recurrenceDays.length === 0) {
        Alert.alert('Selection Error', 'Please select at least one repeat day.');
        return;
      }
      if (!endDate) {
        Alert.alert('Missing End Date', 'Please enter a recurrence end date.');
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        Alert.alert('Invalid Date Format', 'End date must be in YYYY-MM-DD format.');
        return;
      }
      
      const now = new Date();
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      const endDateTime = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
      
      if (isNaN(endDateTime.getTime())) {
        Alert.alert('Invalid Date', 'Please enter a valid end date.');
        return;
      }

      if (endDateTime < now) {
        Alert.alert('Invalid End Date', 'Recurrence end date must be in the future.');
        return;
      }

      const maxEndDate = new Date();
      maxEndDate.setDate(maxEndDate.getDate() + 30);
      if (endDateTime > maxEndDate) {
        Alert.alert('Limit Exceeded', 'Recurrence end date cannot be more than 30 days in the future.');
        return;
      }

      const firstOccur = getFirstOccurrence(time, recurrenceDays);
      finalAlarmTimeUtc = firstOccur.toISOString();
    } else {
      // One-time alarm
      if (!dateStr) {
        Alert.alert('Missing Date', 'Please enter a date.');
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        Alert.alert('Invalid Date Format', 'Date must be in YYYY-MM-DD format.');
        return;
      }
      
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      const alarmTimeDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

      if (isNaN(alarmTimeDate.getTime())) {
        Alert.alert('Invalid Date', 'Please enter a valid date.');
        return;
      }

      const now = new Date();
      const minFuture = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes future
      if (alarmTimeDate < minFuture) {
        Alert.alert('Invalid Date/Time', 'Alarm time must be at least 2 minutes in the future.');
        return;
      }

      finalAlarmTimeUtc = alarmTimeDate.toISOString();
    }

    setSaving(true);
    try {
      const res = await updateAlarm({
        alarm_id: alarmId,
        title: title.trim(),
        alarm_time: finalAlarmTimeUtc,
        difficulty,
        sound_url: soundUrl,
        is_recurring: isRecurring,
        recurrence_days: isRecurring ? recurrenceDays : [],
        recurrence_end_date: isRecurring ? endDate : undefined,
      });

      if (res.success) {
        Alert.alert('Success', 'Alarm updated successfully!', [
          { text: 'OK', onPress: () => router.replace(`/group/${groupId}/alarm/${alarmId}`) }
        ]);
      } else {
        Alert.alert('Failed', res.error || 'Failed to update alarm');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.infoText}>Loading alarm configuration...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Edit Group Alarm</Text>
          <Text style={styles.subtitle}>Modify scheduled time or wake-up challenge difficulty</Text>
        </View>

        <View style={styles.card}>
          <Input
            label="Alarm Title"
            placeholder="e.g. Morning Standup"
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label="Time (24h format, HH:MM)"
            placeholder="e.g. 07:30"
            value={time}
            onChangeText={setTime}
            maxLength={5}
            keyboardType="numbers-and-punctuation"
          />
          {!isRecurring && (
            <Input
              label="Date (YYYY-MM-DD)"
              placeholder="e.g. 2026-06-18"
              value={dateStr}
              onChangeText={setDateStr}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
            />
          )}
        </View>

        {/* Difficulty Selector */}
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

        {/* Sound Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alarm Sound</Text>
          <View style={styles.soundRow}>
            <View style={styles.soundIconBox}>
              <Text style={styles.soundIcon}>🎵</Text>
            </View>
            <View style={styles.soundInfo}>
              <Text style={styles.soundName}>{soundUrl}</Text>
              <Text style={styles.soundDesc}>Tap to change preset</Text>
            </View>
            <Button
              title="Change"
              onPress={() => router.push(`/group/${groupId}/alarm/sound`)}
              variant="secondary"
              style={styles.soundBtn}
            />
          </View>
        </View>

        {/* Recurrence Fields */}
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

              <Input
                label="End Date (Optional, max 30 days, YYYY-MM-DD)"
                placeholder="e.g. 2026-07-15"
                value={endDate}
                onChangeText={setEndDate}
                maxLength={10}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          )}
        </View>

        <Button title="Save Changes" onPress={handleSave} loading={saving} style={styles.saveBtn} />
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
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontFamily: Typography.fonts.regular,
    fontSize: Typography.sizes.body,
    color: Colors.textSecondary,
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
  diffLabelSelected: {
    color: Colors.dark,
  },
  diffDesc: {
    fontFamily: Typography.fonts.regular,
    fontSize: 10,
    color: Colors.textDisabled,
    marginTop: 2,
    textAlign: 'center',
  },
  diffDescSelected: {
    color: Colors.textSecondary,
  },
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
  soundIcon: {
    fontSize: 22,
  },
  soundInfo: {
    flex: 1,
  },
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
  dayTextSelected: {
    color: Colors.surface,
  },
  saveBtn: {
    marginTop: Spacing.md,
  },
  cancelBtn: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
});
