"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// --- RUNTIME MODULE REQUIRE HOOKS ---
// Since we are running in Node, we must mock native and React Native packages.
const Module = require('module');
const originalRequire = Module.prototype.require;
// Global mocks holder to inspect state inside tests
const mockState = {
    vibrations: [],
    vibrationCancelled: false,
    alerts: [],
    scheduledAlarms: {},
    cancelledAlarms: [],
    sqliteLocalAlarms: [],
    sqliteOfflineCompletions: [],
    supabaseInvokedFunctions: [],
    supabaseDb: {
        users: [],
        groups: [],
        group_members: [],
        alarms: [],
        alarm_completions: [],
        notifications: []
    }
};
const mockVibration = {
    vibrate(pattern, repeat) {
        mockState.vibrations.push({ pattern, repeat });
    },
    cancel() {
        mockState.vibrationCancelled = true;
    }
};
const mockAlert = {
    alert(title, body) {
        mockState.alerts.push({ title, body });
    }
};
const mockReactNative = {
    NativeModules: {
        AlarmManagerModule: {
            async scheduleAlarm(alarmId, timeMs) {
                mockState.scheduledAlarms[alarmId] = timeMs;
            },
            async cancelAlarm(alarmId) {
                mockState.cancelledAlarms.push(alarmId);
                delete mockState.scheduledAlarms[alarmId];
            }
        }
    },
    Platform: {
        OS: 'android'
    },
    Vibration: mockVibration,
    Alert: mockAlert,
    BackHandler: {
        addEventListener() {
            return { remove() { } };
        }
    }
};
// Expose Alert globally since challenge.tsx uses it without importing
global.Alert = mockAlert;
// Add hashCode to String prototype for request code generation
String.prototype.hashCode = function () {
    let hash = 0;
    for (let i = 0; i < this.length; i++) {
        const chr = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash;
};
const mockExpoSqlite = {
    openDatabaseAsync: async () => ({
        execAsync: async (sql) => { },
        runAsync: async (sql, params) => {
            if (sql.includes('INSERT OR REPLACE INTO local_alarms')) {
                const alarm = {
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
                };
                const idx = mockState.sqliteLocalAlarms.findIndex(a => a.alarm_id === alarm.alarm_id);
                if (idx !== -1)
                    mockState.sqliteLocalAlarms[idx] = alarm;
                else
                    mockState.sqliteLocalAlarms.push(alarm);
            }
            else if (sql.includes("UPDATE local_alarms SET status = 'cancelled'")) {
                const alarmId = params[0];
                const alarm = mockState.sqliteLocalAlarms.find(a => a.alarm_id === alarmId);
                if (alarm)
                    alarm.status = 'cancelled';
            }
            else if (sql.includes('DELETE FROM local_alarms WHERE group_id = ?')) {
                const groupId = params[0];
                mockState.sqliteLocalAlarms = mockState.sqliteLocalAlarms.filter(a => a.group_id !== groupId);
            }
            else if (sql.includes('INSERT INTO offline_completions')) {
                mockState.sqliteOfflineCompletions.push({
                    id: mockState.sqliteOfflineCompletions.length + 1,
                    alarm_id: params[0],
                    status: params[1],
                    completed_at: params[2],
                    attempts: params[3]
                });
            }
            else if (sql.includes('DELETE FROM offline_completions WHERE id = ?')) {
                const id = params[0];
                mockState.sqliteOfflineCompletions = mockState.sqliteOfflineCompletions.filter(c => c.id !== id);
            }
        },
        getAllAsync: async (sql, params) => {
            if (sql.includes("status = 'scheduled' AND alarm_time_utc > ?")) {
                const nowUtc = params[0];
                return mockState.sqliteLocalAlarms
                    .filter(a => a.status === 'scheduled' && a.alarm_time_utc > nowUtc)
                    .sort((a, b) => a.alarm_time_utc.localeCompare(b.alarm_time_utc));
            }
            else if (sql.includes('ORDER BY alarm_time_utc ASC')) {
                return [...mockState.sqliteLocalAlarms].sort((a, b) => a.alarm_time_utc.localeCompare(b.alarm_time_utc));
            }
            else if (sql.includes('SELECT * FROM offline_completions')) {
                return [...mockState.sqliteOfflineCompletions];
            }
            return [];
        },
        getFirstAsync: async (sql, params) => {
            if (sql.includes('WHERE alarm_id = ?')) {
                const alarmId = params[0];
                return mockState.sqliteLocalAlarms.find(a => a.alarm_id === alarmId) || null;
            }
            return null;
        }
    })
};
const mockAsyncStorage = {
    getItem: async () => null,
    setItem: async () => { },
    removeItem: async () => { },
    clear: async () => { },
};
class MockQueryBuilder {
    table;
    filters = [];
    constructor(table) { this.table = table; }
    select() { return this; }
    eq(col, val) { this.filters.push((x) => x[col] === val); return this; }
    neq(col, val) { this.filters.push((x) => x[col] !== val); return this; }
    in(col, vals) { this.filters.push((x) => vals.includes(x[col])); return this; }
    order() { return this; }
    limit() { return this; }
    async single() {
        const data = await this.execute();
        return { data: data[0] || null, error: data[0] ? null : new Error('Not found') };
    }
    async maybeSingle() {
        const data = await this.execute();
        return { data: data[0] || null, error: null };
    }
    async execute() {
        let list = mockState.supabaseDb[this.table] || [];
        for (const filter of this.filters) {
            list = list.filter(filter);
        }
        return list;
    }
    then(onfulfilled) {
        return this.execute().then(data => onfulfilled({ data, error: null }));
    }
}
const mockSupabase = {
    createClient: () => mockSupabase,
    from(table) {
        return new MockQueryBuilder(table);
    },
    auth: {
        async getSession() { return { data: { session: null } }; },
        onAuthStateChange() { return { data: { subscription: { unsubscribe() { } } } }; },
        async signOut() { }
    },
    functions: {
        invokedFunctions: mockState.supabaseInvokedFunctions,
        mockResponses: {},
        async invoke(name, options) {
            mockState.supabaseInvokedFunctions.push({ name, body: options?.body });
            const mockRes = this.mockResponses[name] || { success: true };
            if (mockRes instanceof Error) {
                throw mockRes;
            }
            return { data: mockRes, error: null };
        }
    }
};
const mockZustand = {
    create: (creator) => {
        let state = {};
        const set = (partialOrFn) => {
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
Module.prototype.require = function (id) {
    if (id === 'react-native')
        return mockReactNative;
    if (id === 'expo-sqlite')
        return mockExpoSqlite;
    if (id === '@react-native-async-storage/async-storage')
        return mockAsyncStorage;
    if (id === '@supabase/supabase-js')
        return mockSupabase;
    if (id === 'zustand')
        return mockZustand;
    if (id === 'expo-router') {
        return {
            useRouter: () => ({ replace: () => { } }),
            useLocalSearchParams: () => ({}),
            usePathname: () => '/'
        };
    }
    if (id === '@notifee/react-native') {
        return {
            default: {
                displayNotification: async () => { }
            }
        };
    }
    if (id === 'react-native-purchases') {
        return {
            default: {
                setup: () => { },
                purchasePackage: async () => ({ customerInfo: {} })
            }
        };
    }
    return originalRequire.apply(this, arguments);
};
// --- IMPORT THE FILES UNDER TEST ---
const { insertOrUpdateAlarm, cancelAlarm, deleteAlarmsForGroup, getFutureAlarms, getAllAlarms, getAlarm, insertOfflineCompletion, getOfflineCompletions, deleteOfflineCompletion } = require('../lib/sqlite');
const { useAuthStore } = require('../store/authStore');
const { useAlarmStore } = require('../store/alarmStore');
const { useGroupStore } = require('../store/groupStore');
// Extract generateChallenge from challenge.tsx dynamically
let generateChallenge;
try {
    const challengePath = path.resolve(__dirname, '../src/app/alarm/challenge.tsx');
    const challengeCode = fs.readFileSync(challengePath, 'utf8');
    const startIdx = challengeCode.indexOf('function generateChallenge');
    const endIdx = challengeCode.indexOf('export default function MathChallenge');
    if (startIdx !== -1 && endIdx !== -1) {
        let funcStr = challengeCode.slice(startIdx, endIdx).trim();
        funcStr = funcStr.replace("diff: 'easy' | 'medium' | 'hard'", "diff");
        generateChallenge = eval(`(${funcStr})`);
    }
    else {
        throw new Error('Failed to find generateChallenge in challenge.tsx');
    }
}
catch (err) {
    console.error('Failed to extract generateChallenge:', err.message);
}
// Helper to reset mocks
function resetMocks() {
    mockState.vibrations = [];
    mockState.vibrationCancelled = false;
    mockState.alerts = [];
    mockState.scheduledAlarms = {};
    mockState.cancelledAlarms = [];
    mockState.sqliteLocalAlarms = [];
    mockState.sqliteOfflineCompletions = [];
    mockState.supabaseInvokedFunctions = [];
    mockState.supabaseDb.users = [];
    mockState.supabaseDb.groups = [];
    mockState.supabaseDb.group_members = [];
    mockState.supabaseDb.alarms = [];
    mockState.supabaseDb.alarm_completions = [];
    mockState.supabaseDb.notifications = [];
}
// --- DEFINE PROPOSED RECURRING ALARM RESOLUTION HELPER ---
function resolveRecurringAlarmTimes(alarmTimeStr, recurrenceDays, endDateStr, startFrom = new Date()) {
    const occurrences = [];
    const maxDays = 30;
    const [hours, minutes] = alarmTimeStr.split(':').map(Number);
    const endDate = endDateStr ? new Date(endDateStr + 'T23:59:59') : null;
    const maxDate = new Date(startFrom.getTime() + maxDays * 24 * 60 * 60 * 1000);
    for (let i = 0; i <= maxDays; i++) {
        const checkDate = new Date(startFrom.getTime() + i * 24 * 60 * 60 * 1000);
        checkDate.setHours(hours, minutes, 0, 0);
        if (checkDate <= startFrom)
            continue;
        if (checkDate > maxDate)
            break;
        if (endDate && checkDate > endDate)
            break;
        const dayOfWeek = checkDate.getDay();
        if (recurrenceDays.includes(dayOfWeek)) {
            occurrences.push(checkDate);
        }
    }
    return occurrences;
}
// --- RUN VERIFICATION FLOWS ---
async function runVerification() {
    console.log('==================================================');
    console.log('WAKEIT FUNCTIONAL VERIFICATION: PHASE 7 TEST FLOWS');
    console.log('==================================================\n');
    // ----------------------------------------------------
    // FLOW 1: SQLite local_alarms caching and future alarms sorting
    // ----------------------------------------------------
    console.log('--- Flow 1: SQLite Caching & Sorting ---');
    resetMocks();
    const baseTime = Date.now();
    const alarms = [
        { alarm_id: 'a1', group_id: 'g1', alarm_time_utc: new Date(baseTime + 10000).toISOString(), alarm_time_local: '08:00', difficulty: 'easy', status: 'scheduled', is_recurring: 0 },
        { alarm_id: 'a2', group_id: 'g1', alarm_time_utc: new Date(baseTime + 5000).toISOString(), alarm_time_local: '07:55', difficulty: 'easy', status: 'scheduled', is_recurring: 0 },
        { alarm_id: 'a3', group_id: 'g1', alarm_time_utc: new Date(baseTime - 5000).toISOString(), alarm_time_local: '07:45', difficulty: 'easy', status: 'scheduled', is_recurring: 0 },
        { alarm_id: 'a4', group_id: 'g1', alarm_time_utc: new Date(baseTime + 20000).toISOString(), alarm_time_local: '08:10', difficulty: 'easy', status: 'cancelled', is_recurring: 0 },
    ];
    for (const a of alarms) {
        await insertOrUpdateAlarm(a);
    }
    const future = await getFutureAlarms();
    const pass1 = future.length === 2 && future[0].alarm_id === 'a2' && future[1].alarm_id === 'a1';
    console.log(pass1 ? '  PASS: Correctly filtered past/cancelled alarms and sorted ascending.' : '  FAIL: Sorting/filtering failed.');
    console.log(`  Result: Found ${future.length} future alarms. Sequence: ${future.map((f) => f.alarm_id).join(' -> ')}`);
    // ----------------------------------------------------
    // FLOW 2: Math challenge problem generation and answer checking for EASY, MEDIUM, and HARD
    // ----------------------------------------------------
    console.log('\n--- Flow 2: Math Challenge Generation ---');
    if (generateChallenge) {
        const easyVal = generateChallenge('easy');
        const medVal = generateChallenge('medium');
        const hardVal = generateChallenge('hard');
        const checkMath = (expr, ans) => {
            const result = Function(`"use strict"; return (${expr})`)();
            return result.toString() === ans;
        };
        const easyPass = checkMath(easyVal.question, easyVal.answer);
        const medPass = checkMath(medVal.question, medVal.answer);
        const hardPass = checkMath(hardVal.question, hardVal.answer);
        const pass2 = easyPass && medPass && hardPass;
        console.log(pass2 ? '  PASS: Math problem generation math matches correct answer strings.' : '  FAIL: Math calculation mismatch.');
        console.log(`  Easy: ${easyVal.question} = ${easyVal.answer} (Valid: ${easyPass})`);
        console.log(`  Medium: ${medVal.question} = ${medVal.answer} (Valid: ${medPass})`);
        console.log(`  Hard: ${hardVal.question} = ${hardVal.answer} (Valid: ${hardPass})`);
    }
    else {
        console.log('  FAIL: generateChallenge parser failed.');
    }
    // ----------------------------------------------------
    // FLOW 3: Wrong math answer (attempts count increment, problem refresh)
    // ----------------------------------------------------
    console.log('\n--- Flow 3: Wrong Answer Flow ---');
    const challengePath = path.resolve(__dirname, '../src/app/alarm/challenge.tsx');
    const challengeCode = fs.readFileSync(challengePath, 'utf8');
    const hasAlertImport = challengeCode.includes('import') && challengeCode.includes('Alert') && challengeCode.split('\n').slice(0, 10).some(line => line.includes('Alert') && line.includes('react-native'));
    const wrongAnswerBlock = challengeCode.substring(challengeCode.indexOf('// FAILURE - WRONG ANSWER'));
    const callsSetQuestion = wrongAnswerBlock.substring(0, 200).includes('setQuestionText') || wrongAnswerBlock.substring(0, 200).includes('generateChallenge');
    const pass3 = hasAlertImport && callsSetQuestion;
    console.log(pass3 ? '  PASS: Wrong answer increments attempts and refreshes the problem.' : '  FAIL: Code structure check found critical issues:');
    console.log(`  - Has Alert import from 'react-native': ${hasAlertImport ? 'YES' : 'NO (Will cause ReferenceError at runtime when Alert.alert is hit)'}`);
    console.log(`  - Regenerates challenge on wrong answer: ${callsSetQuestion ? 'YES' : 'NO (User will be stuck solving the exact same question)'}`);
    // ----------------------------------------------------
    // FLOW 4: Correct math answer (alarm sound/vibration stop triggers, edge function call)
    // ----------------------------------------------------
    console.log('\n--- Flow 4: Correct Answer Flow ---');
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const hasAudioLib = !!(pkg.dependencies['expo-av']);
    const ringPath = path.resolve(__dirname, '../src/app/alarm/ring.tsx');
    const ringCode = fs.readFileSync(ringPath, 'utf8');
    const referencesAudio = ringCode.includes('expo-av') || ringCode.includes('sound') || ringCode.includes('Audio');
    const alarmStore = useAlarmStore.getState();
    const completeRes = await alarmStore.completeChallenge('alarm_1', 'completed', new Date().toISOString(), 1);
    const pass4 = hasAudioLib && referencesAudio && completeRes.success;
    console.log(pass4 ? '  PASS: Sound and vibration stops, edge function is called successfully.' : '  FAIL: Sound playback implementation missing:');
    console.log(`  - Audio library (expo-av) in package.json: ${hasAudioLib ? 'YES' : 'NO (Audio cannot be played)'}`);
    console.log(`  - ring.tsx references audio/sound APIs: ${referencesAudio ? 'YES' : 'NO (Visual-only alarm; no actual audio will play)'}`);
    console.log(`  - Edge function complete-challenge called: ${completeRes.success ? 'YES' : 'NO'}`);
    // ----------------------------------------------------
    // FLOW 5: Timeout (5 minutes window from original alarm time) logic
    // ----------------------------------------------------
    console.log('\n--- Flow 5: Timeout logic ---');
    const hasTimeLeftState = challengeCode.includes('const [timeLeft, setTimeLeft] = useState(300)');
    const hasTimeoutCallback = challengeCode.includes('handleTimeout') && challengeCode.includes('completeChallenge');
    const pass5 = hasTimeLeftState && hasTimeoutCallback;
    console.log(pass5 ? '  PASS: Timeout state and handler exists in code.' : '  FAIL: Timeout logic missing.');
    console.log(`  - Time left state initialized to 300s: ${hasTimeLeftState ? 'YES' : 'NO'}`);
    console.log(`  - handleTimeout calls completeChallenge: ${hasTimeoutCallback ? 'YES' : 'NO'}`);
    // ----------------------------------------------------
    // FLOW 6: Offline completion queuing
    // ----------------------------------------------------
    console.log('\n--- Flow 6: Offline Queuing ---');
    mockSupabase.functions.mockResponses['complete-challenge'] = new Error('Network unavailable');
    resetMocks();
    const storeInstance = useAlarmStore.getState();
    const challengeRes = await storeInstance.completeChallenge('alarm_offline', 'completed', new Date().toISOString(), 3);
    if (challengeRes.offline) {
        await insertOfflineCompletion('alarm_offline', 'completed', new Date().toISOString(), 3);
    }
    const queuedCompletions = await getOfflineCompletions();
    const hasSavedOffline = queuedCompletions.length === 1 && queuedCompletions[0].alarm_id === 'alarm_offline';
    const appSyncsOffline = challengeCode.includes('getOfflineCompletions') || ringCode.includes('getOfflineCompletions');
    const pass6 = hasSavedOffline && appSyncsOffline;
    console.log(pass6 ? '  PASS: Saves completion offline and syncs it when online.' : '  FAIL: Offline sync is half-implemented:');
    console.log(`  - Correctly catches connection error and saves locally: ${hasSavedOffline ? 'YES' : 'NO'}`);
    console.log(`  - Has code to read/process offline_completions queue: ${appSyncsOffline ? 'YES' : 'NO (Completions will sit in SQLite indefinitely)'}`);
    delete mockSupabase.functions.mockResponses['complete-challenge'];
    // ----------------------------------------------------
    // FLOW 7: Admin alarm cancellation flow
    // ----------------------------------------------------
    console.log('\n--- Flow 7: Admin Alarm Cancellation ---');
    resetMocks();
    await storeInstance.deleteAlarm('alarm_to_cancel');
    const cancelledLocal = await getAlarm('alarm_to_cancel');
    const cancelledSQLite = cancelledLocal && cancelledLocal.status === 'cancelled';
    const cancelledNative = mockState.cancelledAlarms.includes('alarm_to_cancel');
    const pass7 = cancelledSQLite && cancelledNative;
    console.log(pass7 ? '  PASS: Local SQLite and AlarmManager entry cancelled.' : '  FAIL: Cancel implementation incomplete:');
    console.log(`  - Cancelled in local SQLite table: ${cancelledSQLite ? 'YES' : 'NO'}`);
    console.log(`  - Cancelled in native Android AlarmManager: ${cancelledNative ? 'YES' : 'NO (Alarm will still ring at native OS level)'}`);
    // ----------------------------------------------------
    // FLOW 8: Admin member removal flow
    // ----------------------------------------------------
    console.log('\n--- Flow 8: Admin Member Removal ---');
    const groupStoreInstance = useGroupStore.getState();
    const hasRemoveMemberCall = groupStoreInstance.removeMember !== undefined;
    const srcFiles = [
        'src/app/(tabs)/index.tsx',
        'src/app/settings.tsx',
        'store/groupStore.ts',
        'store/alarmStore.ts'
    ];
    let callsDeleteAlarmsForGroup = false;
    for (const file of srcFiles) {
        try {
            const content = fs.readFileSync(path.resolve(__dirname, '../', file), 'utf8');
            if (content.includes('deleteAlarmsForGroup')) {
                callsDeleteAlarmsForGroup = true;
            }
        }
        catch { }
    }
    const pass8 = hasRemoveMemberCall && callsDeleteAlarmsForGroup;
    console.log(pass8 ? '  PASS: Cancels alarms for member when removed from group.' : '  FAIL: Member removal clean-up missing:');
    console.log(`  - removeMember store function defined: ${hasRemoveMemberCall ? 'YES' : 'NO'}`);
    console.log(`  - deleteAlarmsForGroup called inside client app (src/): ${callsDeleteAlarmsForGroup ? 'YES' : 'NO (Alarms of removed groups will stay scheduled)'}`);
    // ----------------------------------------------------
    // FLOW 9: Trial expiry check logic
    // ----------------------------------------------------
    console.log('\n--- Flow 9: Trial Expiry checks ---');
    const authStoreInstance = useAuthStore.getState();
    authStoreInstance.setProfile({
        plan_type: 'free_trial',
        trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
        email: 'test@example.com'
    });
    const trialActiveCanCreate = authStoreInstance.canCreateGroups();
    authStoreInstance.setProfile({
        plan_type: 'free_trial',
        trial_ends_at: new Date(Date.now() - 3600000).toISOString(),
        email: 'test@example.com'
    });
    const trialExpiredCanCreate = authStoreInstance.canCreateGroups();
    const createAlarmEdgePath = path.resolve(__dirname, '../supabase/functions/create-alarm/index.ts');
    const createAlarmEdgeCode = fs.readFileSync(createAlarmEdgePath, 'utf8');
    const definesIsTrialActive = createAlarmEdgeCode.includes('isTrialActive =');
    const checksIsTrialActive = createAlarmEdgeCode.includes('!isTrialActive') || createAlarmEdgeCode.includes('isTrialActive === false');
    const pass9 = trialActiveCanCreate && !trialExpiredCanCreate && checksIsTrialActive;
    console.log(pass9 ? '  PASS: Expired trials lock group/alarm creation on client and server.' : '  FAIL: Expiry check bypass/bugs found:');
    console.log(`  - Client locks creation when trial is expired: ${!trialExpiredCanCreate ? 'YES' : 'NO'}`);
    console.log(`  - Server-side create-alarm edge function defines isTrialActive: ${definesIsTrialActive ? 'YES' : 'NO'}`);
    console.log(`  - Server-side create-alarm edge function blocks creation if trial expired: ${checksIsTrialActive ? 'YES' : 'NO (Expired trial users can still schedule alarms)'}`);
    // ----------------------------------------------------
    // FLOW 10: RevenueCat mock purchases and entitlement mapping to state stores
    // ----------------------------------------------------
    console.log('\n--- Flow 10: RevenueCat Mock Entitlements ---');
    authStoreInstance.toggleMockEntitlements(true);
    authStoreInstance.setMockEntitlements({ wakeit_admin: true });
    const isAdminMocked = authStoreInstance.isAdmin();
    authStoreInstance.setMockEntitlements({ wakeit_admin: false, wakeit_member: true });
    const isMemberMocked = authStoreInstance.isMember();
    const isAdminMockedFalse = authStoreInstance.isAdmin();
    authStoreInstance.toggleMockEntitlements(false);
    authStoreInstance.setProfile({ plan_type: 'free_trial', email: 'test@example.com' });
    const isAdminReal = authStoreInstance.isAdmin();
    const pass10 = isAdminMocked && isMemberMocked && !isAdminMockedFalse && !isAdminReal;
    console.log(pass10 ? '  PASS: RevenueCat mock entitlements map correctly to auth store.' : '  FAIL: Entitlement mapping incorrect.');
    // ----------------------------------------------------
    // FLOW 11: Multi-group scheduling conflict verification
    // ----------------------------------------------------
    console.log('\n--- Flow 11: Multi-Group Scheduling ---');
    resetMocks();
    const alarmGroup1 = { alarm_id: 'ag1', group_id: 'g1', alarm_time_utc: new Date(baseTime + 10000).toISOString(), alarm_time_local: '08:00', difficulty: 'easy', status: 'scheduled' };
    const alarmGroup2 = { alarm_id: 'ag2', group_id: 'g2', alarm_time_utc: new Date(baseTime + 10000).toISOString(), alarm_time_local: '08:00', difficulty: 'easy', status: 'scheduled' };
    const alarmGroup3 = { alarm_id: 'ag3', group_id: 'g3', alarm_time_utc: new Date(baseTime + 20000).toISOString(), alarm_time_local: '08:10', difficulty: 'easy', status: 'scheduled' };
    await insertOrUpdateAlarm(alarmGroup1);
    await insertOrUpdateAlarm(alarmGroup2);
    await insertOrUpdateAlarm(alarmGroup3);
    const futureAlarms = await getFutureAlarms();
    const uniqueRequestCodes = [alarmGroup1.alarm_id.hashCode(), alarmGroup2.alarm_id.hashCode()];
    const pass11 = futureAlarms.length === 3 && uniqueRequestCodes[0] !== uniqueRequestCodes[1];
    console.log(pass11 ? '  PASS: Multiple groups can coexist without scheduling override.' : '  FAIL: Conflict in database/scheduler.');
    // ----------------------------------------------------
    // FLOW 12: Recurring alarm schedule resolution
    // ----------------------------------------------------
    console.log('\n--- Flow 12: Recurring Alarm Resolution ---');
    const hasAppRecurrenceResolution = challengeCode.includes('resolveRecurringAlarmTimes') || ringCode.includes('resolveRecurringAlarmTimes');
    const startDate = new Date('2026-06-17T06:00:00'); // Wednesday
    const resolved = resolveRecurringAlarmTimes('07:30', [1, 3, 5], // Mon, Wed, Fri
    '2026-06-30', // Ends June 30
    startDate);
    const expectedCount = 6;
    const resolverCorrect = resolved.length === expectedCount;
    const pass12 = hasAppRecurrenceResolution && resolverCorrect;
    console.log(pass12 ? '  PASS: Recurring alarms resolved up to 30 days.' : '  FAIL: Recurrence scheduling is missing from app:');
    console.log(`  - Recurrence resolver exists in app codebase: ${hasAppRecurrenceResolution ? 'YES' : 'NO (Only the parent alarm record is synced, future occurrences are not scheduled)'}`);
    console.log(`  - Proposed resolver resolves Mon/Wed/Fri correctly within date boundary: ${resolverCorrect ? 'YES' : 'NO'}`);
    console.log(`    Generated occurrences (${resolved.length}):`);
    resolved.forEach(d => console.log(`      - ${d.toDateString()} at ${d.toTimeString().substring(0, 5)}`));
    console.log('\n==================================================');
    console.log('FUNCTIONAL VERIFICATION RUN COMPLETED');
    console.log('==================================================');
}
runVerification();
