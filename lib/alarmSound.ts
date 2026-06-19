import { Audio } from 'expo-av';
import { Vibration, Platform } from 'react-native';

let soundInstance: Audio.Sound | null = null;
let isVibrating = false;

/**
 * Starts continuous alarm sound loop (at max volume) and heavy vibration pattern.
 */
export async function startAlarmSoundAndVibration() {
  if (soundInstance) {
    // Sound is already playing/initializing
    return;
  }

  // 1. Start continuous vibration pattern [delay, vibrate, delay, vibrate]
  if (!isVibrating) {
    const vibrationPattern = [500, 1000, 500, 1000];
    Vibration.vibrate(vibrationPattern, true); // repeat
    isVibrating = true;
  }

  // 2. Play digital watches alarm sound in loop
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' },
      { shouldPlay: true, isLooping: true, volume: 1.0 }
    );
    soundInstance = sound;
  } catch (err) {
    console.warn('[AlarmSound] Failed to play remote sound:', err);
  }
}

/**
 * Stops any active alarm sound and vibration.
 */
export async function stopAlarmSoundAndVibration() {
  if (isVibrating) {
    Vibration.cancel();
    isVibrating = false;
  }

  if (soundInstance) {
    try {
      await soundInstance.stopAsync();
      await soundInstance.unloadAsync();
    } catch (e) {
      console.warn('[AlarmSound] Failed to stop/unload sound:', e);
    }
    soundInstance = null;
  }
}
