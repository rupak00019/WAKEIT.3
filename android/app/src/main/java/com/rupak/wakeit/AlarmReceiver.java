package com.rupak.wakeit;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * FIX 3: AlarmReceiver fires when AlarmManager's setExactAndAllowWhileIdle triggers.
 * It now:
 *   1. Stores the alarm_id in SharedPreferences so JS can read it on startup (Fix 4).
 *   2. Shows a PRIORITY_MAX full-screen notification on the 'wakeit_alarm' channel.
 *   3. The notification's fullScreenIntent launches MainActivity, waking the locked screen.
 *   4. FLAG_SHOW_WHEN_LOCKED + FLAG_TURN_SCREEN_ON are set on MainActivity in onNewIntent.
 * PRD Section 5.4 and 9.5 (Notifee Channels / Full-Screen Alarm trigger)
 */
public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "AlarmReceiver";
    private static final String CHANNEL_ID = "wakeit_alarm";
    private static final int NOTIFICATION_ID = 9001;

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "AlarmReceiver.onReceive fired");

        String alarmId = intent.getStringExtra("alarm_id");
        Log.d(TAG, "alarm_id = " + alarmId);

        // Step 1: Persist alarm_id into SharedPreferences so JS can read it via
        // AlarmManagerModule.getInitialAlarmId() when the app starts. (Fix 4)
        if (alarmId != null) {
            SharedPreferences prefs = context.getSharedPreferences(
                AlarmManagerModule.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(AlarmManagerModule.KEY_ALARM_ID, alarmId).apply();
        }

        // Step 2: Ensure the 'wakeit_alarm' channel exists with highest importance.
        createAlarmChannel(context);

        // Step 3: Build full-screen launch intent pointing to MainActivity with alarm extras.
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        launchIntent.putExtra("alarm_id", alarmId);
        launchIntent.putExtra("from_alarm", true);

        int requestCode = alarmId != null ? alarmId.hashCode() : NOTIFICATION_ID;

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Step 4: Build the full-screen alarm notification.
        // FLAG_SHOW_WHEN_LOCKED and FLAG_TURN_SCREEN_ON are applied via MainActivity.kt
        // onNewIntent when it receives from_alarm=true.
        Uri alarmSoundUri = Settings.System.DEFAULT_ALARM_ALERT_URI;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("\u23f0 WAKEIT \u2014 Time to Wake Up!")
            .setContentText("Your group alarm is ringing. Tap to dismiss the challenge.")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // The full-screen intent wakes the device and shows the alarm screen
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setAutoCancel(false)
            .setOngoing(true)
            .setSound(alarmSoundUri)
            .setVibrate(new long[]{0, 500, 200, 500, 200, 500});

        NotificationManager nm =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (nm != null) {
            nm.notify(NOTIFICATION_ID, builder.build());
            Log.d(TAG, "Full-screen alarm notification posted (ID=" + NOTIFICATION_ID + ")");
        } else {
            Log.e(TAG, "NotificationManager is null — cannot post alarm notification");
        }
    }

    /**
     * Creates the 'wakeit_alarm' channel with IMPORTANCE_HIGH, alarm sound,
     * vibration, and DND bypass — matching PRD Section 7.9.
     */
    private void createAlarmChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // Don't overwrite if channel already exists
            if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "WAKEIT Alarm",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Full-screen alarm notifications for WAKEIT group alarms");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            channel.setBypassDnd(true);

            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            channel.setSound(Settings.System.DEFAULT_ALARM_ALERT_URI, audioAttrs);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            nm.createNotificationChannel(channel);
            Log.d(TAG, "wakeit_alarm notification channel created");
        }
    }
}
