import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: { type: String, required: true }, // denormalized for read speed
    senderAvatar: { type: String }, // denormalized for read speed
    text: {
      type: String,
      required: true,
      maxlength: [1000, 'Message too long'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['chat', 'system'],
      default: 'chat',
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    // Compound index for efficient session chat retrieval
  }
);

messageSchema.index({ sessionId: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
