import * as SQLite from 'expo-sqlite';
import { scheduleAlarm, cancelAlarm as nativeCancelAlarm } from './alarmManager';

export interface LocalAlarm {
  alarm_id: string;
  group_id: string;
  group_name?: string;
  alarm_time_utc: string;
  alarm_time_local: string;
  difficulty: string;
  sound_path?: string;
  is_recurring: number; // 0 = false, 1 = true
  recurrence_days?: string; // JSON string of array e.g. "[1,3,5]"
  recurrence_end?: string; // Date string "YYYY-MM-DD" or null
  status: string; // scheduled / cancelled / completed
  created_at?: string;
}

export interface OfflineCompletion {
  id: number;
  alarm_id: string;
  status: string;
  completed_at: string;
  attempts: number;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDB() {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('wakeit.db');
    // Create tables if they don't exist
    await dbInstance.execAsync(`
      CREATE TABLE IF NOT EXISTS local_alarms (
        alarm_id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        group_name TEXT,
        alarm_time_utc TEXT NOT NULL,
        alarm_time_local TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        sound_path TEXT,
        is_recurring INTEGER DEFAULT 0,
        recurrence_days TEXT,
        recurrence_end TEXT,
        status TEXT DEFAULT 'scheduled',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS offline_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alarm_id TEXT NOT NULL,
        status TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }
  return dbInstance;
}

/**
 * Resolves a recurring alarm into concrete individual occurrences (up to 30 days lookahead).
 */
function resolveRecurrence(alarm: LocalAlarm): LocalAlarm[] {
  if (alarm.is_recurring !== 1 || !alarm.recurrence_days) {
    return [alarm];
  }

  const occurrences: LocalAlarm[] = [];
  try {
    const days: number[] = typeof alarm.recurrence_days === 'string'
      ? JSON.parse(alarm.recurrence_days)
      : alarm.recurrence_days;

    if (!Array.isArray(days) || days.length === 0) {
      return [alarm];
    }

    const startDateLocal = new Date(alarm.alarm_time_local);
    const endDateLimit = new Date(startDateLocal.getTime() + 30 * 24 * 60 * 60 * 1000);
    let endDate = endDateLimit;

    if (alarm.recurrence_end) {
      // Set to end of the recurrence end date
      const parsedEnd = new Date(alarm.recurrence_end + 'T23:59:59');
      if (!isNaN(parsedEnd.getTime()) && parsedEnd < endDateLimit) {
        endDate = parsedEnd;
      }
    }

    // Loop through each day from start date to end date
    let current = new Date(startDateLocal.getTime());

    while (current <= endDate) {
      const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, etc.
      if (days.includes(dayOfWeek)) {
        const occurrenceLocal = new Date(current.getTime());
        occurrenceLocal.setHours(
          startDateLocal.getHours(),
          startDateLocal.getMinutes(),
          startDateLocal.getSeconds(),
          startDateLocal.getMilliseconds()
        );

        if (occurrenceLocal.getTime() >= startDateLocal.getTime()) {
          const year = occurrenceLocal.getFullYear();
          const month = String(occurrenceLocal.getMonth() + 1).padStart(2, '0');
          const date = String(occurrenceLocal.getDate()).padStart(2, '0');
          const localDateStr = `${year}-${month}-${date}`;
          
          const hours = String(occurrenceLocal.getHours()).padStart(2, '0');
          const minutes = String(occurrenceLocal.getMinutes()).padStart(2, '0');
          const seconds = String(occurrenceLocal.getSeconds()).padStart(2, '0');
          const localTimeStr = `${localDateStr}T${hours}:${minutes}:${seconds}`;

          occurrences.push({
            ...alarm,
            alarm_id: `${alarm.alarm_id}_${localDateStr}`,
            alarm_time_utc: occurrenceLocal.toISOString(),
            alarm_time_local: localTimeStr,
            is_recurring: 0 // concretized single occurrence
          });
        }
      }
      current.setDate(current.getDate() + 1);
    }
  } catch (err) {
    console.error('Error resolving recurrence days:', err);
    return [alarm];
  }

  return occurrences.length > 0 ? occurrences : [alarm];
}

export async function insertOrUpdateAlarm(alarm: LocalAlarm): Promise<void> {
  const db = await getDB();
  
  // 1. If it's a recurring alarm, first clean up any previous resolved occurrences
  const deletePattern = `${alarm.alarm_id}_%`;
  await db.runAsync(
    `DELETE FROM local_alarms WHERE alarm_id = ? OR alarm_id LIKE ?`,
    [alarm.alarm_id, deletePattern]
  );

  // 2. Resolve into occurrences (if not recurring, returns array with only the alarm itself)
  const resolvedAlarms = resolveRecurrence(alarm);

  // 3. Write each occurrence to SQLite and synchronize with native AlarmManager
  for (const item of resolvedAlarms) {
    await db.runAsync(
      `INSERT OR REPLACE INTO local_alarms (
        alarm_id, group_id, group_name, alarm_time_utc, alarm_time_local,
        difficulty, sound_path, is_recurring, recurrence_days, recurrence_end, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.alarm_id,
        item.group_id,
        item.group_name || null,
        item.alarm_time_utc,
        item.alarm_time_local,
        item.difficulty,
        item.sound_path || null,
        item.is_recurring,
        item.recurrence_days || null,
        item.recurrence_end || null,
        item.status || 'scheduled'
      ]
    );

    // Sync with AlarmManager
    const timeMs = new Date(item.alarm_time_utc).getTime();
    if (item.status === 'scheduled' && timeMs > Date.now()) {
      try {
        await scheduleAlarm(item.alarm_id, timeMs);
      } catch (err) {
        console.error(`Failed to schedule alarm ${item.alarm_id} natively:`, err);
      }
    } else {
      try {
        await nativeCancelAlarm(item.alarm_id);
      } catch (err) {
        console.error(`Failed to cancel alarm ${item.alarm_id} natively:`, err);
      }
    }
  }
}

export async function cancelAlarm(alarm_id: string): Promise<void> {
  const db = await getDB();
  const deletePattern = `${alarm_id}_%`;

  // Find all matching alarms (both parent and occurrences) to cancel them natively
  const matchingAlarms = await db.getAllAsync<LocalAlarm>(
    `SELECT alarm_id FROM local_alarms WHERE alarm_id = ? OR alarm_id LIKE ?`,
    [alarm_id, deletePattern]
  );

  // 1. Update SQLite statuses to cancelled
  await db.runAsync(
    `UPDATE local_alarms SET status = 'cancelled' WHERE alarm_id = ? OR alarm_id LIKE ?`,
    [alarm_id, deletePattern]
  );

  // 2. Cancel natively
  for (const matching of matchingAlarms) {
    try {
      await nativeCancelAlarm(matching.alarm_id);
    } catch (err) {
      console.error(`Failed to cancel alarm ${matching.alarm_id} natively:`, err);
    }
  }
}

export async function deleteAlarmsForGroup(group_id: string): Promise<void> {
  const db = await getDB();
  
  // Find all group alarms first to cancel natively
  const groupAlarms = await db.getAllAsync<LocalAlarm>(
    `SELECT alarm_id FROM local_alarms WHERE group_id = ?`,
    [group_id]
  );

  // 1. Delete from SQLite
  await db.runAsync(
    `DELETE FROM local_alarms WHERE group_id = ?`,
    [group_id]
  );

  // 2. Cancel natively
  for (const alarm of groupAlarms) {
    try {
      await nativeCancelAlarm(alarm.alarm_id);
    } catch (err) {
      console.error(`Failed to cancel group alarm ${alarm.alarm_id} natively:`, err);
    }
  }
}

export async function getFutureAlarms(): Promise<LocalAlarm[]> {
  const db = await getDB();
  const nowUtc = new Date().toISOString();
  const rows = await db.getAllAsync<LocalAlarm>(
    `SELECT * FROM local_alarms WHERE status = 'scheduled' AND alarm_time_utc > ? ORDER BY alarm_time_utc ASC`,
    [nowUtc]
  );
  return rows;
}

export async function getAllAlarms(): Promise<LocalAlarm[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<LocalAlarm>(
    `SELECT * FROM local_alarms ORDER BY alarm_time_utc ASC`
  );
  return rows;
}

export async function getAlarm(alarm_id: string): Promise<LocalAlarm | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<LocalAlarm>(
    `SELECT * FROM local_alarms WHERE alarm_id = ?`,
    [alarm_id]
  );
  return row;
}

// Offline completions helpers
export async function insertOfflineCompletion(alarm_id: string, status: string, completed_at: string, attempts: number): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO offline_completions (alarm_id, status, completed_at, attempts) VALUES (?, ?, ?, ?)`,
    [alarm_id, status, completed_at, attempts]
  );
}

export async function getOfflineCompletions(): Promise<OfflineCompletion[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<OfflineCompletion>(
    `SELECT * FROM offline_completions ORDER BY created_at ASC`
  );
  return rows;
}

export async function deleteOfflineCompletion(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `DELETE FROM offline_completions WHERE id = ?`,
    [id]
  );
}

/**
 * Synchronizes offline completions queue with the Supabase backend.
 */
export async function syncOfflineCompletions(supabaseClient: any): Promise<void> {
  const completions = await getOfflineCompletions();
  if (completions.length === 0) return;

  console.log(`[Offline Sync] Found ${completions.length} offline completions. Syncing with server...`);

  for (const item of completions) {
    try {
      const { data, error } = await supabaseClient.functions.invoke('complete-challenge', {
        body: {
          alarm_id: item.alarm_id,
          status: item.status,
          completed_at: item.completed_at,
          attempts: item.attempts
        }
      });

      if (error || !data.success) {
        throw new Error(error?.message || 'Server did not return a success flag');
      }

      // Sync successful, remove from local queue
      await deleteOfflineCompletion(item.id);
      console.log(`[Offline Sync] Synced completion successfully for alarm ${item.alarm_id}`);
    } catch (err) {
      console.error(`[Offline Sync] Failed to sync completion for alarm ${item.alarm_id}:`, err);
      // Halt execution on error to preserve order
      break;
    }
  }
}
