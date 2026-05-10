import nodemailer from 'nodemailer';
import { logger } from '../config/logger.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendWelcomeEmail(user) {
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
    logger.warn('[Email] SMTP not configured. Skipping welcome email for:', user.email);
    return;
  }

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: 'Welcome to iChange Platform!',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h1 style="color: #4f46e5;">Welcome to iChange, ${user.name}!</h1>
        <p>We're excited to have you on board. Your account has been successfully created.</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Email:</strong> ${user.email}</p>
          <p style="margin: 5px 0 0 0;"><strong>Role:</strong> ${user.role}</p>
        </div>
        <p>You can now log in to the platform and start participating in live learning sessions.</p>
        <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Login to Dashboard</a>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #6b7280;">If you didn't create this account, please ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('[Email] Welcome email sent to:', user.email);
  } catch (err) {
    logger.error('[Email] Failed to send welcome email:', err.message);
  }
}
