// Declare Node globals as any so tsc doesn't check their types
declare var require: any;
declare var process: any;

const Module = require('module');

// Create the mocks
interface MockAlarm {
  alarm_id: string;
  group_id: string;
  group_name?: string;
  alarm_time_utc: string;
  alarm_time_local: string;
  difficulty: string;
  sound_path?: string;
  is_recurring: number;
  recurrence_days?: string;
  recurrence_end?: string;
  status: string;
  created_at?: string;
}

const mockAlarms: MockAlarm[] = [];

const mockExpoSqlite = {
  openDatabaseAsync: async (dbName: string) => {
    console.log(`[SQLITE MOCK] Opened database: ${dbName}`);
    return {
      execAsync: async (sql: string) => {
        console.log(`[SQLITE MOCK] Executed SQL:\n${sql.trim()}`);
      },
      runAsync: async (sql: string, params: any[]) => {
        console.log(`[SQLITE MOCK] Run SQL: ${sql.trim()} with params:`, params);
        if (sql.includes('INSERT OR REPLACE INTO local_alarms')) {
          const alarm: MockAlarm = {
            alarm_id: params[0],
            group_id: params[1],
            group_name: params[2],
            alarm_time_utc: params[3],
            alarm_time_local: params[4],
            difficulty: params[5],
            sound_path: params[6],
            is_recurring: params[7],
            recurrence_days: params[8],
            recurrence_end: params[9],
            status: params[10],
            created_at: new Date().toISOString(),
          };
          const idx = mockAlarms.findIndex(a => a.alarm_id === alarm.alarm_id);
          if (idx !== -1) {
            mockAlarms[idx] = alarm;
          } else {
            mockAlarms.push(alarm);
          }
        } else if (sql.includes("UPDATE local_alarms SET status = 'cancelled'")) {
          const alarmId = params[0];
          const alarm = mockAlarms.find(a => a.alarm_id === alarmId);
          if (alarm) {
            alarm.status = 'cancelled';
          }
        } else if (sql.includes('DELETE FROM local_alarms WHERE group_id = ?')) {
          const groupId = params[0];
          let i = mockAlarms.length;
          while (i--) {
            if (mockAlarms[i].group_id === groupId) {
              mockAlarms.splice(i, 1);
            }
          }
        }
      },
      getAllAsync: async (sql: string, params?: any[]) => {
        console.log(`[SQLITE MOCK] GetAll SQL: ${sql.trim()} with params:`, params);
        if (sql.includes("status = 'scheduled' AND alarm_time_utc > ?")) {
          const nowUtc = params![0];
          return mockAlarms
            .filter(a => a.status === 'scheduled' && a.alarm_time_utc > nowUtc)
            .sort((a, b) => a.alarm_time_utc.localeCompare(b.alarm_time_utc));
        } else if (sql.includes('ORDER BY alarm_time_utc ASC')) {
          return [...mockAlarms].sort((a, b) => a.alarm_time_utc.localeCompare(b.alarm_time_utc));
        }
        return [];
      },
      getFirstAsync: async (sql: string, params?: any[]) => {
        console.log(`[SQLITE MOCK] GetFirst SQL: ${sql.trim()} with params:`, params);
        if (sql.includes('WHERE alarm_id = ?')) {
          const alarmId = params![0];
          return mockAlarms.find(a => a.alarm_id === alarmId) || null;
        }
        return null;
      }
    };
  }
};

const mockAsyncStorage = {
  getItem: async (key: string) => {
    console.log(`[ASYNC STORAGE MOCK] getItem: ${key}`);
    return null;
  },
  setItem: async (key: string, value: string) => {
    console.log(`[ASYNC STORAGE MOCK] setItem: ${key} -> ${value}`);
  },
  removeItem: async (key: string) => {
    console.log(`[ASYNC STORAGE MOCK] removeItem: ${key}`);
  },
  clear: async () => {
    console.log(`[ASYNC STORAGE MOCK] clear`);
  },
};

const mockReactNative = {
  NativeModules: {
    AlarmManagerModule: null
  },
  Platform: {
    OS: 'ios'
  }
};

// Hook require
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === 'expo-sqlite') {
    return mockExpoSqlite;
  }
  if (id === '@react-native-async-storage/async-storage') {
    return mockAsyncStorage;
  }
  if (id === 'react-native') {
    return mockReactNative;
  }
  return originalRequire.apply(this, arguments as any);
};

// Now import the files to test
import { supabase } from '../lib/supabase';
import {
  insertOrUpdateAlarm,
  cancelAlarm,
  deleteAlarmsForGroup,
  getFutureAlarms,
  getAllAlarms,
  getAlarm
} from '../lib/sqlite';

// Run tests...
async function runTests() {
  console.log('--- Test Run Started ---');

  // 1. Supabase Initialization Check
  console.log('Testing Supabase Client Import & Initialization...');
  try {
    if (supabase) {
      console.log('PASSED: Supabase client imported and initialized successfully.');
    } else {
      throw new Error('Supabase client is null or undefined.');
    }
  } catch (error: any) {
    console.error('FAILED: Supabase client initialization check failed:', error.message || error);
    process.exit(1);
  }

  console.log('\nTesting SQLite Database Helpers...');
  try {
    // Test alarm data
    const alarm1 = {
      alarm_id: 'alarm_1',
      group_id: 'group_1',
      group_name: 'Work Alarm',
      alarm_time_utc: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      alarm_time_local: '08:00 AM',
      difficulty: 'medium',
      is_recurring: 0,
      status: 'scheduled'
    };

    const alarm2 = {
      alarm_id: 'alarm_2',
      group_id: 'group_1',
      group_name: 'Work Alarm Secondary',
      alarm_time_utc: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
      alarm_time_local: '09:00 AM',
      difficulty: 'hard',
      is_recurring: 1,
      recurrence_days: '[1,3,5]',
      status: 'scheduled'
    };

    // Test Insert
    console.log('\nInserting alarm 1...');
    await insertOrUpdateAlarm(alarm1);
    console.log('Inserting alarm 2...');
    await insertOrUpdateAlarm(alarm2);

    // Test Query Single Alarm
    console.log('\nQuerying alarm 1...');
    const fetched1 = await getAlarm('alarm_1');
    if (!fetched1 || fetched1.alarm_id !== 'alarm_1') {
      throw new Error(`Failed to retrieve alarm_1, got ${JSON.stringify(fetched1)}`);
    }
    console.log('PASSED: Single alarm query returned correct alarm.');

    // Test Query All Alarms
    console.log('\nQuerying all alarms...');
    const allAlarms = await getAllAlarms();
    if (allAlarms.length !== 2) {
      throw new Error(`Expected 2 alarms, got ${allAlarms.length}`);
    }
    console.log('PASSED: Retrieve all alarms count is correct.');

    // Test Query Future Alarms
    console.log('\nQuerying future alarms...');
    const futureAlarms = await getFutureAlarms();
    if (futureAlarms.length !== 2) {
      throw new Error(`Expected 2 scheduled future alarms, got ${futureAlarms.length}`);
    }
    console.log('PASSED: Retrieve future alarms query works.');

    // Test Cancel Alarm
    console.log('\nCancelling alarm 1...');
    await cancelAlarm('alarm_1');
    const cancelledAlarm = await getAlarm('alarm_1');
    if (!cancelledAlarm || cancelledAlarm.status !== 'cancelled') {
      throw new Error(`Alarm 1 status should be cancelled, got: ${cancelledAlarm?.status}`);
    }
    console.log('PASSED: Alarm cancel updates status correctly.');

    // Verify it is excluded from future alarms
    console.log('\nVerifying cancelled alarm is excluded from future alarms...');
    const futureAlarmsAfterCancel = await getFutureAlarms();
    if (futureAlarmsAfterCancel.length !== 1) {
      throw new Error(`Expected 1 scheduled future alarm, got ${futureAlarmsAfterCancel.length}`);
    }
    console.log('PASSED: Cancelled alarms are excluded from future alarms list.');

    // Test Delete Group Alarms
    console.log('\nDeleting alarms for group_1...');
    await deleteAlarmsForGroup('group_1');
    const allAlarmsAfterDelete = await getAllAlarms();
    if (allAlarmsAfterDelete.length !== 0) {
      throw new Error(`Expected 0 alarms left, got ${allAlarmsAfterDelete.length}`);
    }
    console.log('PASSED: Delete group alarms deletes corresponding records.');

    console.log('\n--- SQLite DB Helper verification completed successfully! ---');
  } catch (error: any) {
    console.error('FAILED: SQLite DB helpers verification failed:', error.message || error);
    process.exit(1);
  }
}

runTests();
