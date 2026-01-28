import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
// Lazy load native modules to avoid crashes on iOS 26 with New Architecture

function base64ToUint8Array(base64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = String(base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  if (!clean) return new Uint8Array(0);
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytesLen = Math.floor((clean.length * 3) / 4) - padding;
  const bytes = new Uint8Array(bytesLen);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = chars.indexOf(clean[i]);
    const e2 = chars.indexOf(clean[i + 1]);
    const e3 = clean[i + 2] === '=' ? 64 : chars.indexOf(clean[i + 2]);
    const e4 = clean[i + 3] === '=' ? 64 : chars.indexOf(clean[i + 3]);
    const n = (e1 << 18) | (e2 << 12) | ((e3 & 63) << 6) | (e4 & 63);
    if (p < bytesLen) bytes[p++] = (n >> 16) & 255;
    if (p < bytesLen && e3 !== 64) bytes[p++] = (n >> 8) & 255;
    if (p < bytesLen && e4 !== 64) bytes[p++] = n & 255;
  }
  return bytes;
}

export async function pickAvatarImage() {
  // Lazy load to avoid early native module initialization on iOS 26
  const ImagePicker = await import('expo-image-picker');
  const Linking = await import('expo-linking');
  
  const { status } = await ImagePicker.default.requestMediaLibraryPermissionsAsync();
  // iOS can return 'limited' when the user grants access to selected photos.
  if (status !== 'granted' && status !== 'limited') {
    try {
      // Best-effort: open app settings so the user can enable Photos permission
      await Linking.default.openSettings();
    } catch (_e) {
      // ignore
    }
    throw new Error('אין הרשאה לגלריה. אפשר לאשר בהגדרות ואז לנסות שוב.');
  }

  const res = await ImagePicker.default.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (res.canceled) return null;
  return res.assets?.[0]?.uri ?? null;
}

export function pendingAvatarKey(email) {
  return `pendingAvatar:${String(email || '').trim().toLowerCase()}`;
}

export async function savePendingAvatar(email, uri) {
  if (!email || !uri) return;
  await AsyncStorage.setItem(pendingAvatarKey(email), uri);
}

export async function takePendingAvatar(email) {
  if (!email) return null;
  const key = pendingAvatarKey(email);
  const uri = await AsyncStorage.getItem(key);
  if (uri) await AsyncStorage.removeItem(key);
  return uri;
}

export async function uploadAvatarToSupabase({ userId, uri }) {
  if (!userId || !uri) return null;

  // NOTE: requires a Storage bucket named 'avatars' + policies for authenticated uploads.
  const path = `${userId}/avatar.jpg`;

  // Lazy load FileSystem to avoid early native module initialization on iOS 26
  const FileSystem = await import('expo-file-system/legacy');
  
  // Read bytes reliably (fetch(uri) can produce 0-byte uploads on some devices)
  const base64 = await FileSystem.default.readAsStringAsync(uri, { encoding: 'base64' });
  const bytes = base64ToUint8Array(base64);
  if (!bytes || bytes.length === 0) throw new Error('avatar-image-is-empty');

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { upsert: true, contentType: 'image/jpeg' });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = data?.publicUrl ?? null;
  if (!publicUrl) return null;

  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);

  if (updateError) throw updateError;
  return publicUrl;
}


