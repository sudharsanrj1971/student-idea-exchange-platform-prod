import mongoose from 'mongoose';
import { User } from '../src/models/User.model.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './apps/backend/.env' });

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const testEmail = 'test-' + Date.now() + '@example.com';
  const user = new User({
    name: 'Test User',
    email: testEmail,
    passwordHash: 'password'
  });

  console.log('Initial profilePic:', user.profilePic);
  
  await user.save();
  console.log('Saved user profilePic:', user.profilePic);

  const fetched = await User.findById(user._id);
  console.log('Fetched user profilePic:', fetched.profilePic);

  await User.deleteOne({ _id: user._id });
  await mongoose.disconnect();
}

test().catch(console.error);
