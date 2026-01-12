import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export async function pickAvatarImage() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('נדרשת הרשאה לגלריה כדי לבחור תמונה');
  }

  const res = await ImagePicker.launchImageLibraryAsync({
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

  const resp = await fetch(uri);
  const blob = await resp.blob();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });

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


