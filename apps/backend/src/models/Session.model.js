import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  socketId: { type: String, required: true },
  name: { type: String },
  avatar: { type: String, default: null }, // Resolved profile image URL
  joinedAt: { type: Date, default: Date.now },
}, { _id: false });

const producerSchema = new mongoose.Schema({
  producerId: { type: String, required: true },
  socketId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String },
  kind: { type: String },
  appData: { type: Object },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const sessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Session title is required'],
      trim: true,
      maxlength: [200, 'Title too long'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description too long'],
    },
    linkCode: {
      type: String,
      unique: true,
      index: true,
      required: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    scheduledAt: { type: Date },
    isActive: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    participants: [participantSchema],
    maxParticipants: { type: Number, default: 1200 },
    recordingEnabled: { type: Boolean, default: false },
    // Mediasoup router ID for this session
    routerId: { type: String, default: null },
    workerId: { type: Number, default: null },
    processId: { type: String, default: null, index: true },
    activeProducers: [producerSchema],
  },
  { timestamps: true }
);

// Scalability index for dashboard queries
sessionSchema.index({ 'participants.userId': 1 });

// FIX Bug Class 6: Compound index for active session listing.
// The admin dashboard query `{ isActive: true }` sorted by `{ createdAt: -1 }` was
// doing a full collection scan. This compound index makes it an index scan.
sessionSchema.index({ isActive: 1, createdAt: -1 });

// Soft-delete filter
sessionSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: false });
  next();
});

export const Session = mongoose.model('Session', sessionSchema);
