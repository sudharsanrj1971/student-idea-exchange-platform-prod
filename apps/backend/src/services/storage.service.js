import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../config/logger.js';

const s3Client = process.env.S3_ACCESS_KEY ? new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
}) : null;

const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');

// Ensure local upload directory exists
if (!s3Client) {
  fs.mkdir(uploadDir, { recursive: true }).catch(err => logger.error('Failed to create upload dir', err));
}

/**
 * Upload file to S3 or Local storage
 * @param {string} fileName - Destination filename
 * @param {Buffer} buffer - File buffer
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
export async function uploadFile(fileName, buffer, contentType) {
  if (s3Client) {
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `avatars/${fileName}`,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      });
      await s3Client.send(command);
      return `${process.env.CDN_URL || `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`}/avatars/${fileName}`;
    } catch (err) {
      logger.error('S3 Upload Error', err);
      throw new Error('Storage service unavailable');
    }
  } else {
    // Local fallback
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer);
    
    // Ensure we have a trailing slash if backendUrl exists, or use absolute path
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl && process.env.NODE_ENV === 'production') {
      logger.warn('WARNING: BACKEND_URL is not set in production. Avatar URLs will be relative.');
    }
    
    const baseUrl = backendUrl ? backendUrl.replace(/\/$/, '') : '';
    return `${baseUrl}/uploads/avatars/${fileName}`;
  }
}
