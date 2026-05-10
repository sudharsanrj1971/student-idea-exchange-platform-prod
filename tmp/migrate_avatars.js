import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './apps/backend/src/models/User.model.js';
import { getGravatarUrl } from './apps/backend/src/utils/gravatar.js';

dotenv.config({ path: './apps/backend/.env' });

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({ 
      $or: [
        { avatar: null },
        { avatar: { $exists: false } }
      ]
    });
    
    console.log(`Found ${users.length} users to update`);

    for (const user of users) {
      user.avatar = getGravatarUrl(user.email);
      await user.save();
      console.log(`Updated user: ${user.email}`);
    }

    console.log('Migration complete');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
