import sharp from 'sharp';
import path from 'path';

/**
 * Process image: resize to multiple sizes and convert to WebP
 * @param {Buffer} buffer - Original image buffer
 * @returns {Promise<Object>} - Object containing buffers for different sizes
 */
export async function processImage(buffer) {
  const sizes = {
    sm: 64,
    md: 128,
    lg: 256
  };

  const results = {};

  for (const [key, size] of Object.entries(sizes)) {
    results[key] = await sharp(buffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 80 })
      .toBuffer();
  }

  // Also original size but compressed WebP
  results.original = await sharp(buffer)
    .webp({ quality: 85 })
    .toBuffer();

  return results;
}

/**
 * Generate a deterministic color based on a string (e.g. email)
 * @param {string} str - Input string
 * @returns {string} - Hex color code
 */
export function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}
