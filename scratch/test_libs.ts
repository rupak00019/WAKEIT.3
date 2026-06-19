import * as path from 'path';

// --- RUNTIME MODULE REQUIRE HOOKS ---
// Since we are running in Node, we mock React Native and other external native modules.
const Module = require('module');
const originalRequire = Module.prototype.require;

const mockReactNative = {
  NativeModules: {
    AlarmManagerModule: {
      async scheduleAlarm(alarmId: string, timeMs: number) {},
      async cancelAlarm(alarmId: string) {}
    }
  },
  Platform: { OS: 'android' },
  Vibration: { vibrate() {}, cancel() {} },
  Alert: { alert() {} }
};

const mockExpoSqlite = {
  openDatabaseAsync: async () => ({
    execAsync: async () => {},
    runAsync: async () => {},
    getAllAsync: async () => [],
    getFirstAsync: async () => null
  })
};

const mockAsyncStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
  clear: async () => {},
};

const mockSupabase = {
  createClient: () => mockSupabase,
  from: () => ({
    select: () => ({
      eq: () => ({
        order: () => Promise.resolve({ data: [], error: null })
      })
    })
  }),
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => {}
  },
  functions: {
    invoke: async () => ({ data: { success: true }, error: null })
  }
};

const mockZustand = {
  create: (creator: any) => {
    let state: any = {};
    const set = (partialOrFn: any) => {
      const nextState = typeof partialOrFn === 'function' ? partialOrFn(state) : partialOrFn;
      state = { ...state, ...nextState };
    };
    const get = () => state;
    const api = { getState: get, setState: set };
    state = creator(set, get, api);
    
    const storeHook = () => state;
    storeHook.getState = get;
    storeHook.setState = set;
    return storeHook;
  }
};

const mockExpoFileSystem = {
  documentDirectory: 'file:///mock-documents/',
  downloadAsync: async () => ({ status: 200, uri: 'file:///mock-documents/file.mp3' })
};

const mockMessaging = () => ({
  setBackgroundMessageHandler: () => {},
  requestPermission: async () => 1,
  getToken: async () => 'mock-token',
  onMessage: () => () => {}
});
(mockMessaging as any).AuthorizationStatus = {
  AUTHORIZED: 1,
  PROVISIONAL: 2
};

const mockNotifee = {
  createChannel: async () => 'default',
  displayNotification: async () => {},
  AndroidImportance: { HIGH: 4 }
};

const mockPurchases = {
  configure: () => {},
  logIn: async () => ({ customerInfo: { entitlements: { active: {} } } }),
  getOfferings: async () => ({ current: null }),
  purchasePackage: async () => ({ customerInfo: { entitlements: { active: {} } } }),
  restorePurchases: async () => ({ entitlements: { active: {} } })
};

Module.prototype.require = function (id: string) {
  if (id === 'react-native') return mockReactNative;
  if (id === 'expo-sqlite') return mockExpoSqlite;
  if (id === '@react-native-async-storage/async-storage') return mockAsyncStorage;
  if (id === '@supabase/supabase-js') return mockSupabase;
  if (id === 'zustand') return mockZustand;
  if (id === 'expo-file-system/legacy') return { ...mockExpoFileSystem, __esModule: true };
  if (id === '@react-native-firebase/messaging') return { default: mockMessaging, __esModule: true };
  if (id === '@notifee/react-native') return { default: mockNotifee, AndroidImportance: mockNotifee.AndroidImportance, __esModule: true };
  if (id === 'react-native-purchases') return { default: mockPurchases, __esModule: true };
  return originalRequire.apply(this, arguments as any);
};

// --- IMPORT THE LIBRARIES AND STORES ---
const { supabase } = require('../lib/supabase');
const {
  insertOrUpdateAlarm,
  cancelAlarm,
  deleteAlarmsForGroup,
  getFutureAlarms,
  getAllAlarms,
  getAlarm,
  insertOfflineCompletion,
  getOfflineCompletions,
  deleteOfflineCompletion,
  syncOfflineCompletions
} = require('../lib/sqlite');
const {
  handleAlarmSync,
  handleAlarmUpdate,
  handleAlarmCancel,
  handleMemberRemoved,
  displayNotification,
  requestUserPermission,
  getFCMToken,
  subscribeToForegroundNotifications
} = require('../lib/fcm');
const {
  scheduleAlarm,
  cancelAlarm: nativeCancelAlarm
} = require('../lib/alarmManager');
const {
  initializeRevenueCat,
  updateStoreEntitlements,
  getRCOfferings,
  purchaseRCPackage,
  restoreRCPurchases
} = require('../lib/revenuecat');
const { useAuthStore } = require('../store/authStore');
const { useGroupStore } = require('../store/groupStore');
const { useAlarmStore } = require('../store/alarmStore');

async function testAll() {
  console.log('==================================================');
  console.log('WAKEIT LIBRARIES AND STORES SANITY VERIFICATION');
  console.log('==================================================\n');

  try {
    // 1. Supabase Client
    console.log('--- Testing lib/supabase.ts ---');
    if (!supabase) throw new Error('Supabase client is null');
    console.log('  PASS: Supabase client exists.\n');

    // 2. Local SQLite Operations
    console.log('--- Testing lib/sqlite.ts ---');
    const alarm = {
      alarm_id: 'test_alarm_id',
      group_id: 'test_group_id',
      alarm_time_utc: new Date().toISOString(),
      alarm_time_local: '2026-06-17T08:00:00',
      difficulty: 'easy',
      is_recurring: 0,
      status: 'scheduled'
    };
    await insertOrUpdateAlarm(alarm);
    await getAlarm('test_alarm_id');
    await getFutureAlarms();
    await getAllAlarms();
    await cancelAlarm('test_alarm_id');
    await deleteAlarmsForGroup('test_group_id');
    await insertOfflineCompletion('test_alarm_id', 'completed', new Date().toISOString(), 1);
    await getOfflineCompletions();
    await deleteOfflineCompletion(1);
    await syncOfflineCompletions(supabase);
    console.log('  PASS: All SQLite CRUD operations completed without errors.\n');

    // 3. FCM handlers and helper methods
    console.log('--- Testing lib/fcm.ts ---');
    await handleAlarmSync({ alarm_id: 'sync_test', alarm_time_utc: new Date().toISOString(), group_id: 'group1' });
    await handleAlarmUpdate({ alarm_id: 'sync_test', alarm_time_utc: new Date().toISOString() });
    await handleAlarmCancel({ alarm_id: 'sync_test' });
    await handleMemberRemoved({ group_id: 'group1' });
    await displayNotification('Title', 'Body');
    await requestUserPermission();
    await getFCMToken();
    const unsub = subscribeToForegroundNotifications();
    if (typeof unsub === 'function') unsub();
    console.log('  PASS: All FCM handlers and helpers completed without errors.\n');

    // 4. Native Alarm Manager
    console.log('--- Testing lib/alarmManager.ts ---');
    await scheduleAlarm('test_id', Date.now() + 10000);
    await nativeCancelAlarm('test_id');
    console.log('  PASS: Native Alarm Manager bridge completed without errors.\n');

    // 5. RevenueCat Subscriptions
    console.log('--- Testing lib/revenuecat.ts ---');
    await initializeRevenueCat('user_id');
    updateStoreEntitlements({});
    await getRCOfferings();
    await purchaseRCPackage({} as any);
    await restoreRCPurchases();
    console.log('  PASS: All RevenueCat helper methods completed without errors.\n');

    // 6. State Stores
    console.log('--- Testing Zustand Stores ---');
    const authStore = useAuthStore.getState();
    authStore.setLoading(false);
    authStore.isAdmin();
    
    const groupStore = useGroupStore.getState();
    groupStore.setLoading(false);
    
    const alarmStore = useAlarmStore.getState();
    alarmStore.setLoading(false);
    console.log('  PASS: Zustand stores (authStore, groupStore, alarmStore) configured correctly and active.\n');

    console.log('==================================================');
    console.log('ALL LIBRARY AND STORE FUNCTIONS VERIFIED SUCCESSFULLY!');
    console.log('==================================================');
  } catch (err: any) {
    console.error('FAIL: A library or store function threw an error:');
    console.error(err);
    process.exit(1);
  }
}

testAll();
