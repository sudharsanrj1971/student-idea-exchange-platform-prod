import mongoose from 'mongoose';
import crypto from 'crypto';

const UserProfileSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  profilePic: { 
    type: String, 
    default: '' 
  },
  googleId: { 
    type: String, 
    default: null 
  },
  profileSource: { 
    type: String, 
    enum: ['google_oauth', 'gmail_sync', 'gravatar', 'uploaded', 'generated'],
    default: 'generated'
  },
  isEmailVerified: { 
    type: Boolean, 
    default: false 
  },
  lastSynced: { 
    type: Date, 
    default: null 
  }
}, { timestamps: true });

async function checkUrlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.status === 200;
  } catch { return false; }
}

// Auto-generate profile pic before save if missing
UserProfileSchema.pre('save', async function(next) {
  if (!this.profilePic || this.profilePic === '') {
    const hash = crypto.createHash('md5')
      .update(this.email.trim().toLowerCase())
      .digest('hex');
    
    // Try Gravatar first
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?d=404`;
    const gravatarExists = await checkUrlExists(gravatarUrl);
    
    if (gravatarExists) {
      this.profilePic = `https://www.gravatar.com/avatar/${hash}?s=200`;
      this.profileSource = 'gravatar';
    } else {
      // Fallback: generate avatar from name
      try {
        const User = mongoose.model('User');
        const user = await User.findById(this.userId);
        const name = user?.name || this.email.split('@')[0];
        this.profilePic = `https://ui-avatars.com/api/?name=${
          encodeURIComponent(name)
        }&size=200&background=4F46E5&color=fff&bold=true`;
        this.profileSource = 'generated';
      } catch (err) {
        // Absolute fallback if User model not yet loaded or user not found
        const name = this.email.split('@')[0];
        this.profilePic = `https://ui-avatars.com/api/?name=${
          encodeURIComponent(name)
        }&size=200&background=4F46E5&color=fff&bold=true`;
        this.profileSource = 'generated';
      }
    }
  }
  next();
});

export const UserProfile = mongoose.model('UserProfile', UserProfileSchema);
