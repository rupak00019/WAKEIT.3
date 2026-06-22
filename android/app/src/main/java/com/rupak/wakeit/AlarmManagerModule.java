package com.rupak.wakeit;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class AlarmManagerModule extends ReactContextBaseJavaModule {
    private static final String TAG = "AlarmManagerModule";
    static final String PREFS_NAME = "WakeItAlarmPrefs";
    static final String KEY_ALARM_ID = "pending_alarm_id";
    private final ReactApplicationContext reactContext;

    public AlarmManagerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "AlarmManagerModule";
    }

    @ReactMethod
    public void scheduleAlarm(String alarmId, double timeMsDouble, Promise promise) {
        try {
            long timeMs = (long) timeMsDouble;
            Context context = getReactApplicationContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            if (alarmManager == null) {
                promise.reject("ALARM_SERVICE_NULL", "AlarmManager is not available.");
                return;
            }

            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.setAction("com.rupak.wakeit.ALARM_RING");
            intent.putExtra("alarm_id", alarmId);

            int requestCode = alarmId.hashCode();
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timeMs, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, timeMs, pendingIntent);
            }

            Log.d(TAG, "Scheduled alarm " + alarmId + " for " + timeMs);
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("SCHEDULE_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void cancelAlarm(String alarmId, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            if (alarmManager == null) {
                promise.reject("ALARM_SERVICE_NULL", "AlarmManager is not available.");
                return;
            }

            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.setAction("com.rupak.wakeit.ALARM_RING");
            intent.putExtra("alarm_id", alarmId);

            int requestCode = alarmId.hashCode();
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
            );

            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent);
                pendingIntent.cancel();
                Log.d(TAG, "Cancelled alarm " + alarmId);
            } else {
                Log.d(TAG, "Alarm " + alarmId + " was not scheduled or already cancelled");
            }
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("CANCEL_ERROR", e.getMessage());
        }
    }

    /**
     * FIX 4: Read the pending alarm_id that AlarmReceiver stored in SharedPreferences
     * when it fired. Returns the alarm_id string (or null) and clears it after reading.
     * Called by JS on app startup to detect if the app was opened by an alarm.
     * PRD Section 5.4 (Full Screen Alarm trigger sequence)
     */
    @ReactMethod
    public void getInitialAlarmId(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String alarmId = prefs.getString(KEY_ALARM_ID, null);
            if (alarmId != null) {
                // Clear after reading — only trigger once per alarm fire
                prefs.edit().remove(KEY_ALARM_ID).apply();
                Log.d(TAG, "getInitialAlarmId: returning alarm_id = " + alarmId);
            } else {
                Log.d(TAG, "getInitialAlarmId: no pending alarm");
            }
            promise.resolve(alarmId);
        } catch (Exception e) {
            promise.reject("PREFS_ERROR", e.getMessage());
        }
    }

    /**
     * FIX 5: Check if the app can schedule exact alarms.
     * On Android 12+ (API 31+), SCHEDULE_EXACT_ALARM requires explicit user grant.
     * On older versions, automatically returns true.
     * PRD Section 9.12 (Android Permissions)
     */
    @ReactMethod
    public void canScheduleExactAlarms(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                boolean canSchedule = alarmManager != null && alarmManager.canScheduleExactAlarms();
                promise.resolve(canSchedule);
            } else {
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.reject("PERMISSION_CHECK_ERROR", e.getMessage());
        }
    }

    /**
     * FIX 5: Open the system Special App Access screen for SCHEDULE_EXACT_ALARM.
     * Required on Android 12+ for the user to explicitly grant the permission.
     * PRD Section 9.12 and Section 5.1 (Permission Required screen)
     */
    @ReactMethod
    public void openExactAlarmSettings(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                promise.resolve(null);
            } else {
                promise.resolve(null);
            }
        } catch (Exception e) {
            promise.reject("SETTINGS_ERROR", e.getMessage());
        }
    }
}
