import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { insertOrUpdateAlarm, cancelAlarm, deleteAlarmsForGroup, getAlarm } from './sqlite';

// --- HELPER FUNCTIONS ---

export async function handleAlarmSync(data: any) {
  const alarm_id = data.alarm_id;
  const alarm_time_utc = data.alarm_time_utc;
  const difficulty = data.difficulty || 'easy';
  const sound_url = data.sound_url;
  const group_id = data.group_id;
  const group_name = data.group_name || '';
  const is_recurring = data.is_recurring === 'true' ? 1 : 0;
  const recurrence_days = data.recurrence_days || '';
  const recurrence_end = data.recurrence_end_date || '';

  if (!alarm_id || !alarm_time_utc || !group_id) {
    console.warn('[FCM Handler] Missing fields in alarm_sync data:', data);
    return;
  }

  // 1. Parse alarm_time_utc -> convert to local timezone -> alarm_time_local
  const dateUtc = new Date(alarm_time_utc);
  const offsetMs = dateUtc.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(dateUtc.getTime() - offsetMs);
  const alarm_time_local = localDate.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss

  // 2. Download sound if sound_url is provided and not empty
  let sound_path = undefined;
  if (sound_url) {
    try {
      const filename = sound_url.substring(sound_url.lastIndexOf('/') + 1) || `${alarm_id}.mp3`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;
      const downloadResult = await FileSystem.downloadAsync(sound_url, localUri);
      if (downloadResult.status === 200) {
        sound_path = downloadResult.uri;
      }
    } catch (err) {
      console.error('[FCM Handler] Failed to download alarm sound:', err);
    }
  }

  // 3. Upsert row into local SQLite local_alarms table
  const alarm = {
    alarm_id,
    group_id,
    group_name,
    alarm_time_utc,
    alarm_time_local,
    difficulty,
    sound_path,
    is_recurring,
    recurrence_days,
    recurrence_end,
    status: 'scheduled'
  };

  await insertOrUpdateAlarm(alarm);
}

export async function handleAlarmUpdate(data: any) {
  const alarm_id = data.alarm_id;
  const alarm_time_utc = data.alarm_time_utc;
  const difficulty = data.difficulty;
  const sound_url = data.sound_url;

  if (!alarm_id) {
    console.warn('[FCM Handler] Missing alarm_id in alarm_update data');
    return;
  }

  // Fetch the existing alarm from sqlite to preserve fields if not supplied in data
  const existing = await getAlarm(alarm_id);

  // 1. Cancel existing AlarmManager entries and update status
  await cancelAlarm(alarm_id);

  // 2. Download sound if sound_url is provided
  let sound_path = existing?.sound_path;
  if (sound_url && sound_url !== existing?.sound_path) {
    try {
      const filename = sound_url.substring(sound_url.lastIndexOf('/') + 1) || `${alarm_id}.mp3`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;
      const downloadResult = await FileSystem.downloadAsync(sound_url, localUri);
      if (downloadResult.status === 200) {
        sound_path = downloadResult.uri;
      }
    } catch (err) {
      console.error('[FCM Handler] Failed to download updated alarm sound:', err);
    }
  }

  // Parse local time
  const targetUtcStr = alarm_time_utc || existing?.alarm_time_utc;
  let alarm_time_local = existing?.alarm_time_local || '';
  if (targetUtcStr) {
    const dateUtc = new Date(targetUtcStr);
    const offsetMs = dateUtc.getTimezoneOffset() * 60 * 1000;
    const localDate = new Date(dateUtc.getTime() - offsetMs);
    alarm_time_local = localDate.toISOString().slice(0, 19);
  }

  // 3. Re-insert updated row into local_alarms
  const updatedAlarm = {
    alarm_id,
    group_id: existing?.group_id || data.group_id || '',
    group_name: existing?.group_name || data.group_name || '',
    alarm_time_utc: targetUtcStr || '',
    alarm_time_local,
    difficulty: difficulty || existing?.difficulty || 'easy',
    sound_path,
    is_recurring: existing?.is_recurring || 0,
    recurrence_days: existing?.recurrence_days,
    recurrence_end: existing?.recurrence_end,
    status: 'scheduled'
  };

  await insertOrUpdateAlarm(updatedAlarm);
}

export async function handleAlarmCancel(data: any) {
  const alarm_id = data.alarm_id;
  if (!alarm_id) return;
  await cancelAlarm(alarm_id);
}

export async function handleMemberRemoved(data: any) {
  const group_id = data.group_id;
  if (!group_id) return;

  // 1. Cancel and delete alarms for the group
  await deleteAlarmsForGroup(group_id);

  // 2. Update local state (groupStore) to remove this group
  try {
    const { useGroupStore } = await import('../store/groupStore');
    const store = useGroupStore.getState();
    if (store && store.groups) {
      const updatedGroups = store.groups.filter(g => g.id !== group_id);
      store.setGroups(updatedGroups);
      if (store.selectedGroupId === group_id) {
        store.setSelectedGroupId(null);
      }
    }
  } catch (err) {
    console.error('[FCM Handler] Failed to update groupStore in background:', err);
  }
}

// --- DISPLAY NOTIFICATION UTILS ---

export async function displayNotification(title: string, body: string, data?: any) {
  const channelId = await notifee.createChannel({
    id: 'default',
    name: 'Default Channel',
    importance: AndroidImportance.HIGH,
  });

  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId,
      pressAction: {
        id: 'default',
      },
    },
    data,
  });
}

// --- INITIALIZATION AND LISTENERS ---

// Register Background Message Handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM Background] Received message:', remoteMessage);
  const data = remoteMessage.data;
  if (!data) return;

  switch (data.type) {
    case 'alarm_sync':
      await handleAlarmSync(data);
      break;
    case 'alarm_update':
      await handleAlarmUpdate(data);
      break;
    case 'alarm_cancel':
      await handleAlarmCancel(data);
      break;
    case 'member_removed':
      await handleMemberRemoved(data);
      break;
  }
});

export async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('[FCM] Permission granted status:', authStatus);
  }
  return enabled;
}

export async function getFCMToken(): Promise<string | null> {
  try {
    return await messaging().getToken();
  } catch (err) {
    console.error('[FCM] Failed to get token:', err);
    return null;
  }
}

export function subscribeToForegroundNotifications() {
  return messaging().onMessage(async remoteMessage => {
    console.log('[FCM Foreground] Received message:', remoteMessage);
    const data = remoteMessage.data;
    if (!data) return;

    if (data.type === 'alarm_sync') {
      await handleAlarmSync(data);
    } else if (data.type === 'alarm_update') {
      await handleAlarmUpdate(data);
    } else if (data.type === 'alarm_cancel') {
      await handleAlarmCancel(data);
    } else if (data.type === 'member_removed') {
      await handleMemberRemoved(data);
    } else {
      // Show foreground UI notification using Notifee
      const title = remoteMessage.notification?.title || (typeof data.title === 'string' ? data.title : 'WakeIt');
      const body = remoteMessage.notification?.body || (typeof data.body === 'string' ? data.body : '');
      await displayNotification(title, body, data);
    }
  });
}
