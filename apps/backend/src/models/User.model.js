import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getGravatarUrl } from '../utils/gravatar.js';

const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '7d' },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name too long'],
    },
    studentId: {
      type: String,
      trim: true,
      maxlength: [50, 'Student ID too long'],
      default: null,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    auth_provider: {
      type: String,
      enum: ['google', 'email'],
      default: 'email',
    },
    provider_id: {
      type: String,
      sparse: true,
      index: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: 'student',
    },
    refreshTokens: [refreshTokenSchema],
    profilePic: {
      type: String,
      // BUG FIX: The old `default: function()` ran before Mongoose populated fields,
      // so `this.email` was always `undefined` and the Gravatar URL was never generated.
      // Moved to a pre('save') hook below where all fields are guaranteed to be set.
      default: '',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash') && this.passwordHash) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 8);
  }
  next();
});

// BUG FIX: Generate Gravatar fallback profilePic if not already set.
// This runs AFTER all fields are populated, so `this.email` is guaranteed to exist.
// The old `default: function()` approach ran too early (before field hydration).
userSchema.pre('save', function (next) {
  if (!this.profilePic || this.profilePic.trim() === '') {
    const hash = crypto.createHash('md5')
      .update(this.email.trim().toLowerCase())
      .digest('hex');
    this.profilePic = `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`;
  }
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (plaintext) {
  if (!plaintext || !this.passwordHash) return false;
  return bcrypt.compare(plaintext, this.passwordHash);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokens;
  return obj;
};

export const User = mongoose.model('User', userSchema);
