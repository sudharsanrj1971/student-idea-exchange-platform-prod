import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: { type: String }, // denormalized
    registerNo: { type: String }, // denormalized studentId
    ipAddress: { type: String },
    joinTime: { type: Date, default: Date.now },
    leaveTime: { type: Date, default: null },
    duration: { type: Number, default: 0 }, // seconds
    reconnectCount: { type: Number, default: 0 },
  },
  { timestamps: false }
);

// Compound index — idempotent upsert queries
attendanceSchema.index({ sessionId: 1, userId: 1, joinTime: 1 });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
