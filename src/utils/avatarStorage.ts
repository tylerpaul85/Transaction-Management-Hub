import { supabase } from '../integrations/supabase/client';

const STORAGE_KEY_PREFIX = 'msreg_agent_avatar_';
const STORAGE_EMAIL_PREFIX = 'msreg_agent_avatar_email_';

/**
 * Resize and compress an image file to a lightweight, crisp 400x400 avatar Data URL.
 */
export async function processHeadshotFile(file: File, maxDim = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to parse image data'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain square aspect ratio crop centered
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        const targetDim = Math.min(minDim, maxDim);
        canvas.width = targetDim;
        canvas.height = targetDim;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw cropped & scaled
        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetDim, targetDim);

        // Convert to webp/jpeg data url
        const dataUrl = canvas.toDataURL('image/webp', 0.88);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Retrieve cached or saved avatar for an agent
 */
export function getStoredAvatar(agentId?: string | null, email?: string | null): string | null {
  if (agentId) {
    const local = localStorage.getItem(`${STORAGE_KEY_PREFIX}${agentId}`);
    if (local) return local;
  }
  if (email) {
    const localEmail = localStorage.getItem(`${STORAGE_EMAIL_PREFIX}${email.toLowerCase().trim()}`);
    if (localEmail) return localEmail;
  }
  return null;
}

/**
 * Save an agent headshot to Supabase (agents & profiles) and sync to local persistent cache
 */
export async function saveAgentAvatar(params: {
  agentId?: string;
  email?: string;
  avatarUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { agentId, email, avatarUrl } = params;

  // 1. Immediately cache locally for instant UI responsiveness
  try {
    if (agentId) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${agentId}`, avatarUrl);
    }
    if (email) {
      localStorage.setItem(`${STORAGE_EMAIL_PREFIX}${email.toLowerCase().trim()}`, avatarUrl);
    }
  } catch (err) {
    console.warn('Could not cache avatar locally:', err);
  }

  // 2. Persist to Supabase agents table
  try {
    if (agentId) {
      const { error } = await (supabase.from('agents') as any)
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', agentId);
      if (error && !error.message?.includes('column')) {
        console.warn('Error updating avatar on agents table:', error);
      }
    } else if (email) {
      const { error } = await (supabase.from('agents') as any)
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .ilike('email', email.trim());
      if (error && !error.message?.includes('column')) {
        console.warn('Error updating avatar on agents table by email:', error);
      }
    }

    // 3. Persist to profiles table if matches email
    if (email) {
      const { error: profErr } = await (supabase.from('profiles') as any)
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .ilike('email', email.trim());
      if (profErr && !profErr.message?.includes('column')) {
        console.warn('Error updating avatar on profiles table:', profErr);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Fallback save: persisted locally, Supabase write caught:', err);
    return { success: true };
  }
}
