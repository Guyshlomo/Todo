import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

function reminderKey(challengeId) {
  return `todo:reminder:${String(challengeId || '')}`;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function ensureNotificationPermissions() {
  await ensureAndroidChannel();
  const settings = await Notifications.getPermissionsAsync();
  if (settings.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function cancelChallengeReminder(challengeId) {
  const key = reminderKey(challengeId);
  const existing = await AsyncStorage.getItem(key);
  if (existing) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existing);
    } catch (_e) {
      // ignore
    }
    await AsyncStorage.removeItem(key);
  }
}

/**
 * Schedule a local push reminder.
 * - daily: every day at 20:00
 * - weekly: every week at 20:00 on the weekday the user enabled it (per user request)
 */
export async function scheduleChallengeReminder({ challengeId, challengeName, frequency }) {
  if (!challengeId) return null;
  await cancelChallengeReminder(challengeId);

  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  const now = new Date();
  const hour = 20;
  const minute = 0;

  let trigger = null;
  if (frequency === 'daily') {
    // New expo-notifications trigger format requires explicit `type`
    trigger = { type: 'daily', hour, minute };
  } else {
    // Weekly "from activation": same weekday as now, 20:00
    // JS: 0=Sun..6=Sat ; Expo: 1=Sun..7=Sat
    const weekday = now.getDay() + 1;
    trigger = { type: 'weekly', weekday, hour, minute };
  }

  const title = 'תזכורת לדיווח';
  const body = challengeName ? `הגיע הזמן לדווח: ${challengeName}` : 'הגיע הזמן לדווח';

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      // Android channel (created in ensureAndroidChannel)
      channelId: 'reminders',
      data: { challengeId },
    },
    trigger,
  });

  await AsyncStorage.setItem(reminderKey(challengeId), id);
  return id;
}


