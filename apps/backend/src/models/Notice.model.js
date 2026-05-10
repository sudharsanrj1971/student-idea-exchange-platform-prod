import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String },
    content: { type: String, required: true },
    type: {
      type: String,
      enum: ['toast', 'banner', 'popup'],
      default: 'toast',
    },
    target: {
      type: String,
      enum: ['global', 'role:student', 'role:teacher'],
      default: 'global',
    },
    expiresAt: { type: Date, index: { expires: 0 } }, // TTL based on custom expiry
  },
  { timestamps: true }
);

export const Notice = mongoose.model('Notice', noticeSchema);
