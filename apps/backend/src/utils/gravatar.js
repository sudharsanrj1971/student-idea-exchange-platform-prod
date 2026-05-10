import crypto from 'crypto';

/**
 * Generate a Gravatar URL for a given email address.
 * @param {string} email - User's email address
 * @param {number} size - Desired size in pixels (default 200)
 * @returns {string} - Full Gravatar URL
 */
export function getGravatarUrl(email, size = 200) {
  if (!email) return `https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&s=${size}`;
  
  const trimmedEmail = email.trim().toLowerCase();
  const hash = crypto.createHash('md5').update(trimmedEmail).digest('hex');
  
  // Using '404' as default so we can detect non-existent Gravatars and show our branded fallback
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404&r=g`;
}

/**
 * FIX P5: Verify if a user has an active Gravatar image using HEAD request.
 * HEAD fetches only response headers (no body bytes), saving bandwidth on every login.
 * @param {string} email - User's email address
 * @returns {Promise<boolean>} - True if Gravatar exists
 */
export async function verifyGravatarExists(email) {
  if (!email) return false;
  
  const trimmedEmail = email.trim().toLowerCase();
  const hash = crypto.createHash('md5').update(trimmedEmail).digest('hex');
  const url = `https://www.gravatar.com/avatar/${hash}?d=404`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout (down from 5s)

  try {
    // HEAD request: fetches response headers only — no body bytes wasted
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok; // 200 = has Gravatar, 404 = no Gravatar
  } catch (error) {
    clearTimeout(timeoutId);
    return false;
  }
}
