package com.rupak.wakeit;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Build;
import android.util.Log;

import java.io.File;
import java.time.Instant;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "Device booted. Rescheduling future alarms...");
            rescheduleAlarms(context);
        }
    }

    private void rescheduleAlarms(Context context) {
        File dbFile = context.getDatabasePath("wakeit.db");
        if (!dbFile.exists()) {
            Log.w(TAG, "wakeit.db does not exist yet. No alarms to reschedule.");
            return;
        }

        SQLiteDatabase db = null;
        Cursor cursor = null;
        try {
            db = SQLiteDatabase.openDatabase(dbFile.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY);
            
            // Query for scheduled alarms
            String query = "SELECT alarm_id, alarm_time_utc, status FROM local_alarms WHERE status = 'scheduled'";
            cursor = db.rawQuery(query, null);

            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                Log.e(TAG, "AlarmManager system service not available");
                return;
            }

            int rescheduledCount = 0;
            long nowMs = System.currentTimeMillis();

            while (cursor.moveToNext()) {
                String alarmId = cursor.getString(cursor.getColumnIndexOrThrow("alarm_id"));
                String alarmTimeUtc = cursor.getString(cursor.getColumnIndexOrThrow("alarm_time_utc"));

                try {
                    // Parse ISO UTC string to epoch ms
                    long alarmTimeMs = Instant.parse(alarmTimeUtc).toEpochMilli();

                    // Only schedule if it's in the future
                    if (alarmTimeMs > nowMs) {
                        Intent alarmIntent = new Intent(context, AlarmReceiver.class);
                        alarmIntent.setAction("com.rupak.wakeit.ALARM_RING");
                        alarmIntent.putExtra("alarm_id", alarmId);

                        // Use unique request code per alarm (hash of uuid string)
                        int requestCode = alarmId.hashCode();

                        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                                context,
                                requestCode,
                                alarmIntent,
                                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        );

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarmTimeMs, pendingIntent);
                        } else {
                            alarmManager.setExact(AlarmManager.RTC_WAKEUP, alarmTimeMs, pendingIntent);
                        }
                        
                        rescheduledCount++;
                        Log.d(TAG, "Rescheduled alarm " + alarmId + " for " + alarmTimeUtc);
                    } else {
                        Log.d(TAG, "Skipping past scheduled alarm: " + alarmId);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error rescheduling alarm " + alarmId + ": " + e.getMessage());
                }
            }
            Log.i(TAG, "Finished rescheduling alarms. Total rescheduled: " + rescheduledCount);
        } catch (Exception e) {
            Log.e(TAG, "Failed to read database or reschedule alarms: " + e.getMessage());
        } finally {
            if (cursor != null) {
                cursor.close();
            }
            if (db != null) {
                db.close();
            }
        }
    }
}
