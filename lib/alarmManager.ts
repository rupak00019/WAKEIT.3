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
