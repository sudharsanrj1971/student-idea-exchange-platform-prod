import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../src/models/User.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const email = 'sudharsanrj1971@gmail.com';
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      console.log(`❌ User ${email} not found in DB!`);
    } else {
      console.log(`✅ User found:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Password Hash Length: ${user.passwordHash?.length}`);
      
      const testPassword = '205053';
      const isValid = await user.comparePassword(testPassword);
      console.log(`   Password Test ("${testPassword}"): ${isValid ? 'MATCH ✅' : 'FAIL ❌ (Double-hashing suspected)'}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

verifyAdmin();
