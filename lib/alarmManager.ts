import { NativeModules, Platform } from 'react-native';

const { AlarmManagerModule } = NativeModules;

/**
 * Schedules an exact alarm via native AlarmManager.
 * @param alarmId Unique identifier of the alarm
 * @param timeMs Epoch time in milliseconds when the alarm should trigger
 */
export async function scheduleAlarm(alarmId: string, timeMs: number): Promise<void> {
  if (Platform.OS !== 'android') {
    console.log(`[AlarmManager Bridge] Mock schedule on ${Platform.OS} for alarm ${alarmId} at ${new Date(timeMs).toISOString()}`);
    return;
  }
  
  if (!AlarmManagerModule) {
    console.warn('[AlarmManager Bridge] AlarmManagerModule is not linked or not available.');
    return;
  }

  try {
    await AlarmManagerModule.scheduleAlarm(alarmId, timeMs);
  } catch (error) {
    console.error(`[AlarmManager Bridge] Failed to schedule alarm ${alarmId}:`, error);
    throw error;
  }
}

/**
 * Cancels a scheduled alarm in AlarmManager.
 * @param alarmId Unique identifier of the alarm
 */
export async function cancelAlarm(alarmId: string): Promise<void> {
  if (Platform.OS !== 'android') {
    console.log(`[AlarmManager Bridge] Mock cancel on ${Platform.OS} for alarm ${alarmId}`);
    return;
  }

  if (!AlarmManagerModule) {
    console.warn('[AlarmManager Bridge] AlarmManagerModule is not linked or not available.');
    return;
  }

  try {
    await AlarmManagerModule.cancelAlarm(alarmId);
  } catch (error) {
    console.error(`[AlarmManager Bridge] Failed to cancel alarm ${alarmId}:`, error);
    throw error;
  }
}

/**
 * FIX 4: Read the alarm_id that AlarmReceiver stored in SharedPreferences when it fired.
 * Returns the pending alarm_id string, or null if the app was NOT launched by an alarm.
 * Clears the stored value after reading (one-shot).
 * PRD Section 5.4 (Full Screen Alarm trigger sequence)
 */
export async function getInitialAlarmId(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  if (!AlarmManagerModule) {
    console.warn('[AlarmManager Bridge] AlarmManagerModule is not linked or not available.');
    return null;
  }

  try {
    return await AlarmManagerModule.getInitialAlarmId();
  } catch (error) {
    console.error('[AlarmManager Bridge] Failed to read initial alarm_id:', error);
    return null;
  }
}

/**
 * FIX 5: Returns true if the app can schedule exact alarms.
 * On Android 12+ (API 31+), SCHEDULE_EXACT_ALARM requires explicit user grant.
 * On older versions, always returns true.
 * PRD Section 9.12 (Android Permissions)
 */
export async function canScheduleExactAlarms(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  if (!AlarmManagerModule) {
    console.warn('[AlarmManager Bridge] AlarmManagerModule is not linked or not available.');
    return false;
  }

  try {
    return await AlarmManagerModule.canScheduleExactAlarms();
  } catch (error) {
    console.error('[AlarmManager Bridge] Failed to check exact alarm permission:', error);
    return false;
  }
}

/**
 * FIX 5: Open the system Special App Access settings screen for SCHEDULE_EXACT_ALARM.
 * Call this when canScheduleExactAlarms() returns false.
 * PRD Section 9.12 and Section 5.1 (Permission Required screen)
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;

  if (!AlarmManagerModule) {
    console.warn('[AlarmManager Bridge] AlarmManagerModule is not linked or not available.');
    return;
  }

  try {
    await AlarmManagerModule.openExactAlarmSettings();
  } catch (error) {
    console.error('[AlarmManager Bridge] Failed to open exact alarm settings:', error);
  }
}
