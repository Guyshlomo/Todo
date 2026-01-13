import { supabase } from './supabase';
// Expo SDK 54: legacy API lives under this path (readAsStringAsync moved/deprecated in new API).
import * as FileSystem from 'expo-file-system/legacy';

function base64ToUint8Array(base64) {
  // Minimal base64 decoder (no Buffer dependency)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let clean = String(base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  if (!clean) return new Uint8Array(0);
  const padding = (clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0);
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

/**
 * Uploads a proof image to Supabase Storage and returns the public URL.
 * @param {string} userId - The UUID of the user.
 * @param {string} challengeId - The UUID of the challenge (group).
 * @param {string} uri - The local URI of the image.
 * @returns {Promise<string|null>} The public URL or null.
 */
export async function uploadProofImage({ userId, challengeId, uri }) {
  if (!userId || !challengeId || !uri) return null;

  // Path: proofs / challengeId / userId / timestamp.jpg
  const timestamp = new Date().getTime();
  const fileName = `${timestamp}.jpg`;
  const path = `${challengeId}/${userId}/${fileName}`;

  try {
    // Use FileSystem to reliably read local bytes (prevents 0-byte uploads seen with fetch(uri) on some devices).
    const base64 = await FileSystem.readAsStringAsync(uri, {
      // Some Expo/RN environments don't expose EncodingType enum consistently.
      // Passing the raw string keeps this compatible.
      encoding: 'base64',
    });
    const bytes = base64ToUint8Array(base64);
    if (!bytes || bytes.length === 0) {
      throw new Error('proof-image-is-empty');
    }

    const bucketsToTry = ['proofs', 'avatars'];
    let lastError = null;

    for (const bucket of bucketsToTry) {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, bytes, {
          upsert: false,
          contentType: 'image/jpeg',
        });

      if (!uploadError) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data?.publicUrl ?? null;
      }

      lastError = uploadError;
      const msg = String(uploadError?.message || '');
      const isBucketMissing =
        msg.toLowerCase().includes('bucket') && msg.toLowerCase().includes('not found');

      // If bucket doesn't exist, try next bucket. Otherwise, fail fast.
      if (!isBucketMissing) {
        console.error('Proof upload error:', uploadError);
        throw uploadError;
      }
    }

    // If we got here, buckets were missing.
    console.error('Proof upload error:', lastError);
    throw lastError;
  } catch (error) {
    console.error('Error in uploadProofImage:', error);
    throw error;
  }
}

function tryParseSupabasePublicObjectUrl(url) {
  if (!url || typeof url !== 'string') return null;
  // Example:
  // https://xxx.supabase.co/storage/v1/object/public/proofs/<path>
  const m = url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  const bucket = m[1];
  const path = decodeURIComponent(m[2]);
  return bucket && path ? { bucket, path } : null;
}

/**
 * If a public URL is not readable due to bucket privacy/RLS, try to create a signed URL.
 * Returns the original URL if it can't be parsed/signed.
 */
export async function resolveProofImageUrl(url, expiresInSeconds = 60 * 60) {
  const parsed = tryParseSupabasePublicObjectUrl(url);
  if (!parsed) return url;
  const { bucket, path } = parsed;
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch (_e) {
    // ignore
  }

  // If client-side signing is blocked by Storage/RLS, sign via Edge Function (service role).
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token ?? null;
    const { data, error } = await supabase.functions.invoke('sign-proof-url', {
      body: { bucket, path, expiresIn: expiresInSeconds },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch (_e) {
    // ignore
  }

  return url;
}

