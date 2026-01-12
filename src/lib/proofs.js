import { supabase } from './supabase';

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
    const resp = await fetch(uri);
    const blob = await resp.blob();

    const bucketsToTry = ['proofs', 'avatars'];
    let lastError = null;

    for (const bucket of bucketsToTry) {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, blob, {
          upsert: false,
          contentType: blob.type || 'image/jpeg',
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

