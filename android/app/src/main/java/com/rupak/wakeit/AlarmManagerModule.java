package com.rupak.wakeit;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class AlarmManagerModule extends ReactContextBaseJavaModule {
    private static final String TAG = "AlarmManagerModule";
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
}
