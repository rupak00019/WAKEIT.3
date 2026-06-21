import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { Vibration } from 'react-native';

let playerInstance: AudioPlayer | null = null;
let isVibrating = false;

/**
 * Starts continuous alarm sound loop (at max volume) and heavy vibration pattern.
 * Uses expo-audio (SDK 56 replacement for deprecated expo-av).
 */
export async function startAlarmSoundAndVibration() {
  if (playerInstance) {
    // Already playing
    return;
  }

  // 1. Start continuous vibration pattern
  if (!isVibrating) {
    const vibrationPattern = [500, 1000, 500, 1000];
    Vibration.vibrate(vibrationPattern, true); // repeat
    isVibrating = true;
  }

  // 2. Configure audio mode — play through speaker, stays active in background
  try {
    await setAudioModeAsync({
      playsInSilentModeIOS: true,
      interruptionModeIOS: 1, // INTERRUPTION_MODE_IOS_DO_NOT_MIX
      shouldDuckAndroid: false,
      interruptionModeAndroid: 1, // INTERRUPTION_MODE_ANDROID_DO_NOT_MIX
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });
  } catch (err) {
    console.warn('[AlarmSound] Failed to set audio mode:', err);
  }

  // 3. Create and play the alarm sound in a loop
  try {
    const player = new AudioPlayer(
      { uri: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg' },
      1000 // 1 second buffer
    );
    player.loop = true;
    player.volume = 1.0;
    player.play();
    playerInstance = player;
  } catch (err) {
    console.warn('[AlarmSound] Failed to play alarm sound:', err);
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

  if (playerInstance) {
    try {
      playerInstance.pause();
      playerInstance.remove();
    } catch (e) {
      console.warn('[AlarmSound] Failed to stop/remove sound:', e);
    }
    playerInstance = null;
  }
}
