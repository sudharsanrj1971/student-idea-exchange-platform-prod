import mongoose from 'mongoose';
import { User } from '../src/models/User.model.js';
import { UserProfile } from '../src/models/UserProfile.model.js';
import { connectDB } from '../src/config/db.js';

async function check() {
  await connectDB();
  const email = 'sudharsanrj1971@gmail.com';
  const user = await User.findOne({ email });
  if (!user) {
    console.log('User not found');
    process.exit(0);
  }
  console.log('User avatar:', user.avatar);
  const profile = await UserProfile.findOne({ user_id: user._id });
  if (profile) {
    console.log('UserProfile:', {
      google_image_url: profile.google_image_url,
      gravatar_url: profile.gravatar_url,
      resolved_image_url: profile.resolved_image_url,
      image_source: profile.image_source
    });
  } else {
    console.log('UserProfile not found');
  }
  process.exit(0);
}

check();
