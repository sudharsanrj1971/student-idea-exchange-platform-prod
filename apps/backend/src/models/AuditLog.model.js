import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'BAN_USER',
        'UNBAN_USER',
        'ROLE_CHANGE',
        'GLOBAL_NOTICE',
        'TERMINATE_SESSION',
        'OBSERVE_SESSION',
        'RESET_PASSWORD',
      ],
    },
    targetId: { type: mongoose.Schema.Types.ObjectId }, // UserID or SessionID
    details: { type: mongoose.Schema.Types.Mixed }, // Arbitrary metadata
    ipAddress: { type: String },
  },
  { timestamps: true }
);

// Auto-delete logs after 90 days to keep DB lean
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
