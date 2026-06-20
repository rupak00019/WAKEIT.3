package com.rupak.wakeit;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "AlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Alarm triggered! Opening app...");

        String alarmId = intent.getStringExtra("alarm_id");

        // Start the main React Native Activity
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            launchIntent.putExtra("alarm_id", alarmId);
            context.startActivity(launchIntent);
        } else {
            Log.e(TAG, "Launch intent for package not found.");
        }
    }
}
