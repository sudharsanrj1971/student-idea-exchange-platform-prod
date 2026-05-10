import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../src/models/User.model.js';

dotenv.config({ path: path.resolve('apps/backend/.env') });

async function upgrade() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email address: node upgrade_to_admin.js <email>');
    process.exit(1);
  }

  let uri = process.env.MONGODB_URI;

  try {
    // Note: If the backend is running with MongoMemoryServer, you MUST provide the URI
    // Or this script won't find the same database.
    await mongoose.connect(uri);
    
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`User with email ${email} not found.`);
      process.exit(1);
    }

    user.role = 'admin';
    await user.save();
    
    console.log(`✅ SUCCESS: User ${email} has been promoted to ADMIN.`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

upgrade();
