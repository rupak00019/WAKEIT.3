"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleAlarm = scheduleAlarm;
exports.cancelAlarm = cancelAlarm;
const react_native_1 = require("react-native");
const { AlarmManagerModule } = react_native_1.NativeModules;
/**
 * Schedules an exact alarm via native AlarmManager.
 * @param alarmId Unique identifier of the alarm
 * @param timeMs Epoch time in milliseconds when the alarm should trigger
 */
async function scheduleAlarm(alarmId, timeMs) {
    if (react_native_1.Platform.OS !== 'android') {
        console.log(`[AlarmManager Bridge] Mock schedule on ${react_native_1.Platform.OS} for alarm ${alarmId} at ${new Date(timeMs).toISOString()}`);
        return;
    }
    if (!AlarmManagerModule) {
        console.warn('[AlarmManager Bridge] AlarmManagerModule is not linked or not available.');
        return;
    }
    try {
        await AlarmManagerModule.scheduleAlarm(alarmId, timeMs);
    }
    catch (error) {
        console.error(`[AlarmManager Bridge] Failed to schedule alarm ${alarmId}:`, error);
        throw error;
    }
}
/**
 * Cancels a scheduled alarm in AlarmManager.
 * @param alarmId Unique identifier of the alarm
 */
async function cancelAlarm(alarmId) {
    if (react_native_1.Platform.OS !== 'android') {
        console.log(`[AlarmManager Bridge] Mock cancel on ${react_native_1.Platform.OS} for alarm ${alarmId}`);
        return;
    }
    if (!AlarmManagerModule) {
        console.warn('[AlarmManager Bridge] AlarmManagerModule is not linked or not available.');
        return;
    }
    try {
        await AlarmManagerModule.cancelAlarm(alarmId);
    }
    catch (error) {
        console.error(`[AlarmManager Bridge] Failed to cancel alarm ${alarmId}:`, error);
        throw error;
    }
}
