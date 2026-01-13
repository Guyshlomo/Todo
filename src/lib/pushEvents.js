import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

async function getProjectId() {
  // Works for EAS builds; may be undefined in some dev environments.
  return (
    Constants?.easConfig?.projectId ||
    Constants?.expoConfig?.extra?.eas?.projectId ||
    null
  );
}

export async function ensureExpoPushTokenSaved() {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;
    if (!userId) return null;

    const perms = await Notifications.getPermissionsAsync();
    if (perms.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== 'granted') return null;
    }

    const projectId = await getProjectId();
    let tokenResp = null;
    try {
      tokenResp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    } catch (e) {
      console.log('getExpoPushTokenAsync failed (missing projectId?):', e?.message ?? e);
      // Retry without args (helps some Expo Go/dev flows)
      tokenResp = await Notifications.getExpoPushTokenAsync();
    }
    const token = tokenResp?.data ?? null;
    if (!token) return null;

    // Persist token on user (RLS: users_update_self policy should allow this)
    const { error: upErr } = await supabase
      .from('users')
      .update({ expo_push_token: token })
      .eq('id', userId);
    if (upErr) console.log('saving expo_push_token failed:', upErr);

    return token;
  } catch (_e) {
    return null;
  }
}

export async function notifyGroupEvent({ type, groupId, actorUserId }) {
  try {
    if (!type || !groupId) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token ?? null;
    await supabase.functions.invoke('notify-group', {
      body: { type, groupId, actorUserId },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
  } catch (_e) {
    // best-effort
  }
}


